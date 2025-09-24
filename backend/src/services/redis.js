const Redis = require('ioredis');

/**
 * Redis Service - Comprehensive Redis integration for the Airtable Import system
 * 
 * Provides:
 * - Connection management with automatic reconnection
 * - Pub/Sub for real-time updates
 * - Caching with TTL management
 * - Session state persistence
 * - Rate limiting capabilities
 * - Job queue functionality
 * - Health monitoring
 */
class RedisService {
  constructor() {
    this.client = null;
    this.publisher = null;
    this.subscriber = null;
    this.isConnected = false;
    this.retryAttempts = 0;
    this.maxRetries = 5;
    
    // Configuration from environment variables
    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      family: 4, // IPv4
    };

    // TTL configurations (in seconds)
    this.ttl = {
      session: 24 * 60 * 60,           // 24 hours for session data
      sessionProgress: 2 * 60 * 60,    // 2 hours for progress data
      schemaCache: 10 * 60,            // 10 minutes for schema cache
      tableCache: 5 * 60,              // 5 minutes for table metadata
      rateLimitWindow: 60,             // 1 minute for rate limiting
      userSession: 60 * 60,            // 1 hour for user sessions
    };
  }

  /**
   * Initialize Redis connections
   * Creates separate connections for client operations, publishing, and subscribing
   */
  async connect() {
    try {
      console.log('🔄 Connecting to Redis...');
      
      // Main client for general operations
      this.client = new Redis(this.config);
      
      // Separate connections for pub/sub to avoid blocking
      this.publisher = new Redis(this.config);
      this.subscriber = new Redis(this.config);

      // Setup event handlers
      this.setupEventHandlers();

      // Test connection
      await this.client.ping();
      
      this.isConnected = true;
      this.retryAttempts = 0;
      
      console.log('✅ Redis connected successfully');
      console.log(`📍 Redis Config: ${this.config.host}:${this.config.port} (DB: ${this.config.db})`);
      
      return true;
    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Setup Redis event handlers for connection management and error handling
   */
  setupEventHandlers() {
    // Main client events
    this.client.on('connect', () => {
      console.log('🔗 Redis client connected');
    });

    this.client.on('ready', () => {
      console.log('✅ Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      console.error('❌ Redis client error:', error.message);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('🔌 Redis client connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', (time) => {
      console.log(`🔄 Redis client reconnecting in ${time}ms...`);
    });

    // Publisher events
    this.publisher.on('error', (error) => {
      console.error('❌ Redis publisher error:', error.message);
    });

    // Subscriber events
    this.subscriber.on('error', (error) => {
      console.error('❌ Redis subscriber error:', error.message);
    });

    this.subscriber.on('message', (channel, message) => {
      this.handleSubscriberMessage(channel, message);
    });
  }

  /**
   * Handle incoming pub/sub messages
   */
  handleSubscriberMessage(channel, message) {
    try {
      const data = JSON.parse(message);
      console.log(`📨 Redis message received on ${channel}:`, data);
      
      // Emit to Socket.IO if available
      if (global.socketIO) {
        if (channel.includes(':progress')) {
          global.socketIO.emit('import-progress', data);
        } else if (channel.includes(':complete')) {
          global.socketIO.emit('session-complete', data);
        } else if (channel.includes(':debug')) {
          global.socketIO.emit('debug-log', data);
        }
      }
    } catch (error) {
      console.error('❌ Error handling Redis message:', error.message);
    }
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect() {
    console.log('🔄 Disconnecting from Redis...');
    
    try {
      if (this.subscriber) {
        await this.subscriber.disconnect();
      }
      if (this.publisher) {
        await this.publisher.disconnect();
      }
      if (this.client) {
        await this.client.disconnect();
      }
      
      this.isConnected = false;
      console.log('✅ Redis disconnected successfully');
    } catch (error) {
      console.error('❌ Error disconnecting from Redis:', error.message);
    }
  }

  /**
   * Check if Redis is connected and healthy
   */
  async healthCheck() {
    try {
      if (!this.isConnected || !this.client) {
        return { healthy: false, error: 'Not connected' };
      }

      const startTime = Date.now();
      await this.client.ping();
      const responseTime = Date.now() - startTime;

      return {
        healthy: true,
        responseTime: responseTime + 'ms',
        connected: this.isConnected,
        config: {
          host: this.config.host,
          port: this.config.port,
          db: this.config.db
        }
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        connected: false
      };
    }
  }

  /**
   * Get Redis connection info and statistics
   */
  async getInfo() {
    try {
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      const info = await this.client.info();
      const dbSize = await this.client.dbsize();
      const memory = await this.client.info('memory');
      
      return {
        connected: this.isConnected,
        dbSize,
        info: this.parseRedisInfo(info),
        memory: this.parseRedisInfo(memory),
        config: this.config
      };
    } catch (error) {
      throw new Error(`Failed to get Redis info: ${error.message}`);
    }
  }

  /**
   * Parse Redis INFO command output into structured data
   */
  parseRedisInfo(infoString) {
    const result = {};
    const lines = infoString.split('\r\n');
    
    for (const line of lines) {
      if (line && !line.startsWith('#') && line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = isNaN(value) ? value : Number(value);
      }
    }
    
    return result;
  }

  /**
   * Clear all data from current Redis database
   * WARNING: This will delete all data in the current DB
   */
  async flushDatabase() {
    try {
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      await this.client.flushdb();
      console.log('🗑️ Redis database flushed successfully');
      return true;
    } catch (error) {
      console.error('❌ Error flushing Redis database:', error.message);
      throw error;
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async getKeys(pattern = '*') {
    try {
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      return await this.client.keys(pattern);
    } catch (error) {
      console.error('❌ Error getting Redis keys:', error.message);
      throw error;
    }
  }
}

// Create singleton instance
const redisService = new RedisService();

module.exports = redisService;