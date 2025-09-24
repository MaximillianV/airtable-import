const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const redisService = require('../services/redis');
const redisSessionService = require('../services/redisSession');
const redisCacheService = require('../services/redisCache');

const router = express.Router();

/**
 * Redis API Routes
 * 
 * Provides frontend access to Redis data including:
 * - Session information and progress tracking
 * - Cache statistics and health monitoring
 * - Real-time data for dashboard and debugging
 */

/**
 * GET /api/redis/health
 * Get Redis connection status and basic health information
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const isConnected = redisService.isConnected;
    
    if (!isConnected) {
      return res.json({
        connected: false,
        status: 'disconnected',
        message: 'Redis service is not connected'
      });
    }

    // Get comprehensive Redis health information
    const info = await redisService.getInfo();
    const dbInfo = await redisService.getDatabaseInfo();
    
    res.json({
      connected: true,
      status: 'healthy',
      info: {
        version: dbInfo.redis_version,
        mode: dbInfo.redis_mode,
        database: redisService.config.db,
        host: redisService.config.host,
        port: redisService.config.port,
        keys: dbInfo.db_keys,
        memory: dbInfo.used_memory_human,
        persistence: dbInfo.persistence_enabled,
        dataDir: dbInfo.data_dir
      },
      statistics: {
        dbSize: info.dbSize,
        uptime: info.info?.uptime_in_seconds || 0,
        connectedClients: info.info?.connected_clients || 0
      }
    });
  } catch (error) {
    console.error('❌ Error getting Redis health:', error.message);
    res.status(500).json({
      connected: false,
      status: 'error',
      error: error.message
    });
  }
});

/**
 * GET /api/redis/sessions
 * Get all active and recent sessions from Redis
 */
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    if (!redisService.isConnected) {
      return res.json({
        sessions: [],
        message: 'Redis not connected - no session data available'
      });
    }

    // Get all session keys
    const sessionKeys = await redisService.client.keys('session:*');
    const sessions = [];

    // Retrieve session data for each key
    for (const key of sessionKeys) {
      try {
        const sessionData = await redisService.client.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          const sessionId = key.replace('session:', '');
          
          // Get progress data for this session
          const progressData = await redisSessionService.getAllProgress(sessionId);
          
          sessions.push({
            sessionId,
            ...session,
            progress: progressData,
            progressCount: Object.keys(progressData).length
          });
        }
      } catch (error) {
        console.warn(`⚠️ Error parsing session ${key}:`, error.message);
      }
    }

    // Sort sessions by start time (most recent first)
    sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    res.json({
      sessions,
      total: sessions.length,
      active: sessions.filter(s => s.status === 'running').length,
      completed: sessions.filter(s => s.status === 'completed').length,
      failed: sessions.filter(s => s.status === 'error' || s.status === 'failed').length
    });
  } catch (error) {
    console.error('❌ Error getting Redis sessions:', error.message);
    res.status(500).json({
      error: error.message,
      sessions: []
    });
  }
});

/**
 * GET /api/redis/sessions/:sessionId
 * Get detailed information about a specific session
 */
router.get('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!redisService.isConnected) {
      return res.status(503).json({
        error: 'Redis not connected',
        sessionId
      });
    }

    // Get session data
    const sessionData = await redisSessionService.getSession(sessionId);
    
    if (!sessionData) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId
      });
    }

    // Get all progress data for this session
    const progressData = await redisSessionService.getAllProgress(sessionId);

    // Get session statistics
    const stats = await redisSessionService.getSessionStats();

    res.json({
      sessionId,
      session: sessionData,
      progress: progressData,
      progressCount: Object.keys(progressData).length,
      globalStats: stats
    });
  } catch (error) {
    console.error('❌ Error getting Redis session:', error.message);
    res.status(500).json({
      error: error.message,
      sessionId: req.params.sessionId
    });
  }
});

/**
 * GET /api/redis/progress/:sessionId
 * Get real-time progress data for a specific session
 */
router.get('/progress/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!redisService.isConnected) {
      return res.status(503).json({
        error: 'Redis not connected',
        progress: {}
      });
    }

    const progressData = await redisSessionService.getAllProgress(sessionId);

    res.json({
      sessionId,
      progress: progressData,
      tableCount: Object.keys(progressData).length,
      lastUpdated: Math.max(...Object.values(progressData).map(p => p.timestamp || 0)) || null
    });
  } catch (error) {
    console.error('❌ Error getting Redis progress:', error.message);
    res.status(500).json({
      error: error.message,
      progress: {}
    });
  }
});

/**
 * GET /api/redis/cache/stats
 * Get Redis cache statistics and performance metrics
 */
router.get('/cache/stats', authenticateToken, async (req, res) => {
  try {
    if (!redisService.isConnected) {
      return res.json({
        connected: false,
        cache: { hitRate: '0%', totalKeys: 0 },
        message: 'Redis not connected'
      });
    }

    const cacheStats = await redisCacheService.getStats();
    
    res.json({
      connected: true,
      ...cacheStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error getting Redis cache stats:', error.message);
    res.status(500).json({
      error: error.message,
      connected: false
    });
  }
});

/**
 * GET /api/redis/cache/keys
 * Get all cache keys with optional filtering
 */
router.get('/cache/keys', authenticateToken, async (req, res) => {
  try {
    const { pattern = '*', limit = 100 } = req.query;

    if (!redisService.isConnected) {
      return res.json({
        keys: [],
        message: 'Redis not connected'
      });
    }

    // Get cache keys with pattern matching
    const searchPattern = pattern.includes('cache:') ? pattern : `cache:*${pattern}*`;
    let keys = await redisService.client.keys(searchPattern);
    
    // Limit results for performance
    if (keys.length > limit) {
      keys = keys.slice(0, parseInt(limit));
    }

    // Get TTL information for each key
    const keysWithTTL = await Promise.all(
      keys.map(async (key) => {
        try {
          const ttl = await redisService.client.ttl(key);
          const type = await redisService.client.type(key);
          return {
            key,
            ttl: ttl === -1 ? 'no expiration' : `${ttl}s`,
            type,
            category: key.split(':')[2] || 'unknown'
          };
        } catch (error) {
          return {
            key,
            ttl: 'error',
            type: 'unknown',
            category: 'unknown'
          };
        }
      })
    );

    res.json({
      keys: keysWithTTL,
      total: keysWithTTL.length,
      pattern: searchPattern,
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Error getting Redis cache keys:', error.message);
    res.status(500).json({
      error: error.message,
      keys: []
    });
  }
});

/**
 * DELETE /api/redis/cache/clear
 * Clear cache data with optional pattern matching
 */
router.delete('/cache/clear', authenticateToken, async (req, res) => {
  try {
    const { pattern } = req.body;

    if (!redisService.isConnected) {
      return res.status(503).json({
        error: 'Redis not connected',
        cleared: 0
      });
    }

    let clearedKeys = 0;

    if (pattern) {
      // Clear specific pattern
      const searchPattern = pattern.includes('cache:') ? pattern : `cache:*${pattern}*`;
      const keys = await redisService.client.keys(searchPattern);
      
      if (keys.length > 0) {
        clearedKeys = await redisService.client.del(...keys);
      }
    } else {
      // Clear all cache
      clearedKeys = await redisCacheService.clearAllCache();
    }

    res.json({
      success: true,
      cleared: clearedKeys,
      pattern: pattern || 'all cache data',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error clearing Redis cache:', error.message);
    res.status(500).json({
      error: error.message,
      cleared: 0
    });
  }
});

/**
 * POST /api/redis/debug/publish
 * Publish a debug message for testing pub/sub functionality
 */
router.post('/debug/publish', authenticateToken, async (req, res) => {
  try {
    const { channel, message, sessionId } = req.body;

    if (!redisService.isConnected) {
      return res.status(503).json({
        error: 'Redis not connected'
      });
    }

    if (!channel || !message) {
      return res.status(400).json({
        error: 'Channel and message are required'
      });
    }

    // Publish debug message
    const published = await redisSessionService.publishDebug(
      sessionId || 'debug-session',
      'info',
      message,
      { channel, timestamp: new Date().toISOString() }
    );

    res.json({
      success: published,
      channel,
      message,
      sessionId: sessionId || 'debug-session',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error publishing debug message:', error.message);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * GET /api/redis/stats
 * Get comprehensive Redis statistics and monitoring data
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    if (!redisService.isConnected) {
      return res.json({
        connected: false,
        message: 'Redis not connected',
        stats: {}
      });
    }

    // Gather all statistics
    const [
      redisInfo,
      cacheStats,
      sessionStats
    ] = await Promise.all([
      redisService.getInfo(),
      redisCacheService.getStats(),
      redisSessionService.getSessionStats()
    ]);

    res.json({
      connected: true,
      timestamp: new Date().toISOString(),
      redis: {
        version: redisInfo.info?.redis_version || 'unknown',
        uptime: redisInfo.info?.uptime_in_seconds || 0,
        dbSize: redisInfo.dbSize,
        memory: redisInfo.memory?.used_memory_human || 'unknown',
        clients: redisInfo.info?.connected_clients || 0
      },
      cache: cacheStats.cache,
      sessions: sessionStats,
      config: {
        host: redisService.config.host,
        port: redisService.config.port,
        database: redisService.config.db
      }
    });
  } catch (error) {
    console.error('❌ Error getting Redis stats:', error.message);
    res.status(500).json({
      error: error.message,
      connected: false
    });
  }
});

module.exports = { router };