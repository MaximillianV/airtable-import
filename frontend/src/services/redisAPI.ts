import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Redis API Service
 * 
 * Provides frontend access to Redis data through REST API endpoints
 * Enables real-time monitoring, session tracking, and cache management
 */
class RedisAPIService {
  
  /**
   * Get authenticated axios instance
   */
  private getAxiosInstance() {
    const token = localStorage.getItem('token');
    return axios.create({
      baseURL: `${API_BASE_URL}/redis`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get Redis health status and connection info
   */
  async getHealth(): Promise<{
    connected: boolean;
    status: string;
    info?: {
      version: string;
      mode: string;
      database: number;
      host: string;
      port: number;
      keys: number;
      memory: string;
      persistence: boolean;
      dataDir: string;
    };
    statistics?: {
      dbSize: number;
      uptime: number;
      connectedClients: number;
    };
    error?: string;
  }> {
    try {
      const api = this.getAxiosInstance();
      const response = await api.get('/health');
      return response.data;
    } catch (error: any) {
      console.error('Error getting Redis health:', error);
      return {
        connected: false,
        status: 'error',
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Get all sessions from Redis
   */
  async getSessions(): Promise<{
    sessions: Array<{
      sessionId: string;
      status: string;
      startTime: string;
      endTime?: string;
      tableNames: string[];
      progress: Record<string, any>;
      progressCount: number;
      results?: any[];
    }>;
    total: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    try {
      const api = this.getAxiosInstance();
      const response = await api.get('/sessions');
      return response.data;
    } catch (error: any) {
      console.error('Error getting Redis sessions:', error);
      return {
        sessions: [],
        total: 0,
        active: 0,
        completed: 0,
        failed: 0
      };
    }
  }

  /**
   * Get detailed information about a specific session
   */
  async getSession(sessionId: string): Promise<{
    sessionId: string;
    session: any;
    progress: Record<string, any>;
    progressCount: number;
    globalStats: any;
    error?: string;
  } | null> {
    try {
      const api = this.getAxiosInstance();
      const response = await api.get(`/sessions/${sessionId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting Redis session:', error);
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get real-time progress data for a session
   */
  async getProgress(sessionId: string): Promise<{
    sessionId: string;
    progress: Record<string, any>;
    tableCount: number;
    lastUpdated: number | null;
  }> {
    try {
      const api = this.getAxiosInstance();
      const response = await api.get(`/progress/${sessionId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting Redis progress:', error);
      return {
        sessionId,
        progress: {},
        tableCount: 0,
        lastUpdated: null
      };
    }
  }

  /**
   * Get Redis cache statistics
   */
  async getCacheStats(): Promise<{
    connected: boolean;
    cache: {
      hits: number;
      misses: number;
      sets: number;
      deletes: number;
      errors: number;
      hitRate: string;
      totalKeys: number;
      keysByType: Record<string, number>;
    };
    redis: {
      connected: boolean;
      dbSize: number;
      memoryUsed: string;
    };
    timestamp: string;
  }> {
    try {
      const api = this.getAxiosInstance();
      const response = await api.get('/cache/stats');
      return response.data;
    } catch (error: any) {
      console.error('Error getting Redis cache stats:', error);
      return {
        connected: false,
        cache: {
          hits: 0,
          misses: 0,
          sets: 0,
          deletes: 0,
          errors: 0,
          hitRate: '0%',
          totalKeys: 0,
          keysByType: {}
        },
        redis: {
          connected: false,
          dbSize: 0,
          memoryUsed: 'unknown'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get cache keys with optional filtering
   */
  async getCacheKeys(pattern?: string, limit?: number): Promise<{
    keys: Array<{
      key: string;
      ttl: string;
      type: string;
      category: string;
    }>;
    total: number;
    pattern: string;
    limit: number;
  }> {
    try {
      const api = this.getAxiosInstance();
      const params = new URLSearchParams();
      if (pattern) params.append('pattern', pattern);
      if (limit) params.append('limit', limit.toString());
      
      const response = await api.get(`/cache/keys?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting Redis cache keys:', error);
      return {
        keys: [],
        total: 0,
        pattern: pattern || '*',
        limit: limit || 100
      };
    }
  }

  /**
   * Clear cache data
   */
  async clearCache(pattern?: string): Promise<{
    success: boolean;
    cleared: number;
    pattern: string;
    timestamp: string;
    error?: string;
  }> {
    try {
      const api = this.getAxiosInstance();
      const response = await api.delete('/cache/clear', {
        data: { pattern }
      });
      return response.data;
    } catch (error: any) {
      console.error('Error clearing Redis cache:', error);
      return {
        success: false,
        cleared: 0,
        pattern: pattern || 'all cache data',
        timestamp: new Date().toISOString(),
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Get comprehensive Redis statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    timestamp: string;
    redis: {
      version: string;
      uptime: number;
      dbSize: number;
      memory: string;
      clients: number;
    };
    cache: {
      hits: number;
      misses: number;
      hitRate: string;
      totalKeys: number;
    };
    sessions: {
      totalSessions: number;
      activeSessions: number;
      completedSessions: number;
      failedSessions: number;
    };
    config: {
      host: string;
      port: number;
      database: number;
    };
  }> {
    try {
      const api = this.getAxiosInstance();
      const response = await api.get('/stats');
      return response.data;
    } catch (error: any) {
      console.error('Error getting Redis stats:', error);
      return {
        connected: false,
        timestamp: new Date().toISOString(),
        redis: {
          version: 'unknown',
          uptime: 0,
          dbSize: 0,
          memory: 'unknown',
          clients: 0
        },
        cache: {
          hits: 0,
          misses: 0,
          hitRate: '0%',
          totalKeys: 0
        },
        sessions: {
          totalSessions: 0,
          activeSessions: 0,
          completedSessions: 0,
          failedSessions: 0
        },
        config: {
          host: 'unknown',
          port: 0,
          database: 0
        }
      };
    }
  }

  /**
   * Publish debug message for testing
   */
  async publishDebugMessage(channel: string, message: string, sessionId?: string): Promise<{
    success: boolean;
    channel: string;
    message: string;
    sessionId: string;
    timestamp: string;
    error?: string;
  }> {
    try {
      const api = this.getAxiosInstance();
      const response = await api.post('/debug/publish', {
        channel,
        message,
        sessionId
      });
      return response.data;
    } catch (error: any) {
      console.error('Error publishing debug message:', error);
      return {
        success: false,
        channel,
        message,
        sessionId: sessionId || 'debug-session',
        timestamp: new Date().toISOString(),
        error: error.response?.data?.error || error.message
      };
    }
  }
}

// Create and export singleton instance
const redisAPI = new RedisAPIService();
export default redisAPI;