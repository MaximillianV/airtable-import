const redisService = require('./redis');

/**
 * Redis-based Session Management Service
 * 
 * Provides persistent session state management, progress tracking,
 * and real-time updates through Redis Pub/Sub
 */
class RedisSessionService {
  constructor() {
    this.prefix = 'session';
    this.progressPrefix = 'progress';
    this.channels = {
      progress: 'session:progress',
      complete: 'session:complete',
      debug: 'session:debug'
    };
  }

  /**
   * Generate session key
   */
  getSessionKey(sessionId) {
    return `${this.prefix}:${sessionId}`;
  }

  /**
   * Generate progress key for a specific table in a session
   */
  getProgressKey(sessionId, tableName = null) {
    return tableName 
      ? `${this.progressPrefix}:${sessionId}:${tableName}`
      : `${this.progressPrefix}:${sessionId}`;
  }

  /**
   * Store session data in Redis with expiration
   */
  async storeSession(sessionId, sessionData) {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, cannot store session');
        return false;
      }

      const key = this.getSessionKey(sessionId);
      const data = {
        ...sessionData,
        sessionId,
        storedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      await redisService.client.setex(key, redisService.ttl.session, JSON.stringify(data));
      
      console.log(`✅ Session stored in Redis: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('❌ Error storing session in Redis:', error.message);
      return false;
    }
  }

  /**
   * Update session data in Redis
   */
  async updateSession(sessionId, updates) {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, cannot update session');
        return false;
      }

      const key = this.getSessionKey(sessionId);
      const existing = await redisService.client.get(key);
      
      if (!existing) {
        console.warn(`⚠️ Session ${sessionId} not found in Redis for update`);
        return false;
      }

      const sessionData = JSON.parse(existing);
      const updatedData = {
        ...sessionData,
        ...updates,
        lastUpdated: new Date().toISOString()
      };

      await redisService.client.setex(key, redisService.ttl.session, JSON.stringify(updatedData));
      
      console.log(`✅ Session updated in Redis: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('❌ Error updating session in Redis:', error.message);
      return false;
    }
  }

  /**
   * Get session data from Redis
   */
  async getSession(sessionId) {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, cannot get session');
        return null;
      }

      const key = this.getSessionKey(sessionId);
      const data = await redisService.client.get(key);
      
      if (!data) {
        console.log(`💨 Session not found in Redis: ${sessionId}`);
        return null;
      }

      const sessionData = JSON.parse(data);
      console.log(`🎯 Session retrieved from Redis: ${sessionId}`);
      return sessionData;
    } catch (error) {
      console.error('❌ Error getting session from Redis:', error.message);
      return null;
    }
  }

  /**
   * Store progress data for a specific table in a session
   */
  async storeProgress(sessionId, tableName, progressData) {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, cannot store progress');
        return false;
      }

      const key = this.getProgressKey(sessionId, tableName);
      const data = {
        ...progressData,
        sessionId,
        tableName,
        timestamp: Date.now(),
        storedAt: new Date().toISOString()
      };

      await redisService.client.setex(key, redisService.ttl.sessionProgress, JSON.stringify(data));
      
      // Also store in session progress hash for quick access
      const sessionProgressKey = this.getProgressKey(sessionId);
      await redisService.client.hset(sessionProgressKey, tableName, JSON.stringify(data));
      await redisService.client.expire(sessionProgressKey, redisService.ttl.sessionProgress);
      
      console.log(`✅ Progress stored for ${tableName} in session ${sessionId}: ${progressData.status}`);
      return true;
    } catch (error) {
      console.error('❌ Error storing progress in Redis:', error.message);
      return false;
    }
  }

  /**
   * Get progress data for a specific table in a session
   */
  async getProgress(sessionId, tableName) {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, cannot get progress');
        return null;
      }

      const key = this.getProgressKey(sessionId, tableName);
      const data = await redisService.client.get(key);
      
      if (!data) {
        console.log(`💨 Progress not found for ${tableName} in session ${sessionId}`);
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      console.error('❌ Error getting progress from Redis:', error.message);
      return null;
    }
  }

  /**
   * Get all progress data for a session
   */
  async getAllProgress(sessionId) {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, cannot get progress');
        return {};
      }

      const key = this.getProgressKey(sessionId);
      const progressHash = await redisService.client.hgetall(key);
      
      const progress = {};
      for (const [tableName, data] of Object.entries(progressHash)) {
        try {
          progress[tableName] = JSON.parse(data);
        } catch (error) {
          console.warn(`⚠️ Error parsing progress data for ${tableName}: ${error.message}`);
        }
      }
      
      console.log(`🎯 Retrieved progress for ${Object.keys(progress).length} tables in session ${sessionId}`);
      return progress;
    } catch (error) {
      console.error('❌ Error getting all progress from Redis:', error.message);
      return {};
    }
  }

  /**
   * Publish progress update to Redis Pub/Sub
   */
  async publishProgress(sessionId, progressData) {
    try {
      if (!redisService.isConnected || !redisService.publisher) {
        console.warn('⚠️ Redis publisher not available, cannot publish progress');
        return false;
      }

      const channel = `${this.channels.progress}:${sessionId}`;
      const message = {
        sessionId,
        ...progressData,
        timestamp: Date.now(),
        publishedAt: new Date().toISOString()
      };

      await redisService.publisher.publish(channel, JSON.stringify(message));
      
      console.log(`📢 Progress published for session ${sessionId}: ${progressData.table} - ${progressData.status}`);
      return true;
    } catch (error) {
      console.error('❌ Error publishing progress:', error.message);
      return false;
    }
  }

  /**
   * Publish session completion to Redis Pub/Sub
   */
  async publishSessionComplete(sessionId, completionData) {
    try {
      if (!redisService.isConnected || !redisService.publisher) {
        console.warn('⚠️ Redis publisher not available, cannot publish completion');
        return false;
      }

      const channel = `${this.channels.complete}:${sessionId}`;
      const message = {
        sessionId,
        ...completionData,
        timestamp: Date.now(),
        publishedAt: new Date().toISOString()
      };

      // Publish to both session-specific channel and global channel
      await Promise.all([
        redisService.publisher.publish(channel, JSON.stringify(message)),
        redisService.publisher.publish(this.channels.complete, JSON.stringify(message))
      ]);
      
      console.log(`📢 Session completion published: ${sessionId} - ${completionData.status}`);
      return true;
    } catch (error) {
      console.error('❌ Error publishing session completion:', error.message);
      return false;
    }
  }

  /**
   * Publish debug message to Redis Pub/Sub
   */
  async publishDebug(sessionId, level, message, data = null) {
    try {
      if (!redisService.isConnected || !redisService.publisher) {
        console.warn('⚠️ Redis publisher not available, cannot publish debug');
        return false;
      }

      const channel = `${this.channels.debug}:${sessionId}`;
      const debugMessage = {
        sessionId,
        level,
        message,
        data,
        timestamp: Date.now(),
        publishedAt: new Date().toISOString()
      };

      await redisService.publisher.publish(channel, JSON.stringify(debugMessage));
      
      console.log(`🐛 Debug message published for session ${sessionId}: [${level.toUpperCase()}] ${message}`);
      return true;
    } catch (error) {
      console.error('❌ Error publishing debug message:', error.message);
      return false;
    }
  }

  /**
   * Subscribe to session updates
   */
  async subscribeToSession(sessionId, callbacks = {}) {
    try {
      if (!redisService.isConnected || !redisService.subscriber) {
        console.warn('⚠️ Redis subscriber not available, cannot subscribe');
        return false;
      }

      const progressChannel = `${this.channels.progress}:${sessionId}`;
      const completeChannel = `${this.channels.complete}:${sessionId}`;
      const debugChannel = `${this.channels.debug}:${sessionId}`;

      await redisService.subscriber.subscribe(progressChannel, completeChannel, debugChannel);
      
      // Setup message handlers
      redisService.subscriber.on('message', (channel, message) => {
        try {
          const data = JSON.parse(message);
          
          if (channel === progressChannel && callbacks.onProgress) {
            callbacks.onProgress(data);
          } else if (channel === completeChannel && callbacks.onComplete) {
            callbacks.onComplete(data);
          } else if (channel === debugChannel && callbacks.onDebug) {
            callbacks.onDebug(data);
          }
        } catch (error) {
          console.error('❌ Error handling subscription message:', error.message);
        }
      });
      
      console.log(`📡 Subscribed to session updates: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('❌ Error subscribing to session:', error.message);
      return false;
    }
  }

  /**
   * Unsubscribe from session updates
   */
  async unsubscribeFromSession(sessionId) {
    try {
      if (!redisService.isConnected || !redisService.subscriber) {
        console.warn('⚠️ Redis subscriber not available, cannot unsubscribe');
        return false;
      }

      const progressChannel = `${this.channels.progress}:${sessionId}`;
      const completeChannel = `${this.channels.complete}:${sessionId}`;
      const debugChannel = `${this.channels.debug}:${sessionId}`;

      await redisService.subscriber.unsubscribe(progressChannel, completeChannel, debugChannel);
      
      console.log(`📡 Unsubscribed from session updates: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('❌ Error unsubscribing from session:', error.message);
      return false;
    }
  }

  /**
   * Clean up expired session and progress data
   */
  async cleanupExpiredSessions() {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, cannot cleanup sessions');
        return 0;
      }

      const sessionKeys = await redisService.client.keys(`${this.prefix}:*`);
      const progressKeys = await redisService.client.keys(`${this.progressPrefix}:*`);
      
      let cleaned = 0;
      
      // Sessions are auto-expired by Redis TTL, but we can check for orphaned progress data
      for (const progressKey of progressKeys) {
        const ttl = await redisService.client.ttl(progressKey);
        if (ttl === -1) { // No expiration set
          await redisService.client.expire(progressKey, redisService.ttl.sessionProgress);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} session/progress items`);
      }
      
      return cleaned;
    } catch (error) {
      console.error('❌ Error cleaning up sessions:', error.message);
      return 0;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats() {
    try {
      if (!redisService.isConnected) {
        return { error: 'Redis not connected' };
      }

      const sessionKeys = await redisService.client.keys(`${this.prefix}:*`);
      const progressKeys = await redisService.client.keys(`${this.progressPrefix}:*`);
      
      const stats = {
        totalSessions: sessionKeys.length,
        totalProgressItems: progressKeys.length,
        activeSessions: 0,
        completedSessions: 0,
        failedSessions: 0
      };

      // Sample a few sessions to get status distribution
      const sampleSize = Math.min(sessionKeys.length, 10);
      for (let i = 0; i < sampleSize; i++) {
        try {
          const sessionData = await redisService.client.get(sessionKeys[i]);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            switch (session.status?.toLowerCase()) {
              case 'running':
              case 'pending':
                stats.activeSessions++;
                break;
              case 'completed':
              case 'partial_failed':
                stats.completedSessions++;
                break;
              case 'failed':
              case 'error':
                stats.failedSessions++;
                break;
            }
          }
        } catch (error) {
          // Skip invalid session data
        }
      }

      return stats;
    } catch (error) {
      console.error('❌ Error getting session stats:', error.message);
      return { error: error.message };
    }
  }
}

// Create singleton instance
const redisSessionService = new RedisSessionService();

module.exports = redisSessionService;