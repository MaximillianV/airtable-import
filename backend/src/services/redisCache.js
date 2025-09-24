const redisService = require('./redis');

/**
 * Redis-based Cache Service for Airtable Schema and Metadata
 * 
 * Replaces the in-memory SchemaCache with persistent Redis storage
 * Provides TTL-based expiration, cache statistics, and management
 */
class RedisCacheService {
  constructor() {
    this.prefix = 'airtable_cache';
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * Generate cache key with consistent naming convention
   */
  getCacheKey(type, baseId, identifier = null) {
    const key = identifier 
      ? `${this.prefix}:${type}:${baseId}:${identifier}`
      : `${this.prefix}:${type}:${baseId}`;
    return key;
  }

  /**
   * Cache table discovery results (tables with record counts)
   */
  async cacheTableDiscovery(baseId, tables) {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, skipping cache set');
        return false;
      }

      const key = this.getCacheKey('tables', baseId);
      const data = {
        tables,
        timestamp: Date.now(),
        cached_at: new Date().toISOString()
      };

      await redisService.client.setex(key, redisService.ttl.tableCache, JSON.stringify(data));
      this.stats.sets++;
      
      console.log(`✅ Cached table discovery for base ${baseId}: ${tables.length} tables`);
      return true;
    } catch (error) {
      console.error('❌ Error caching table discovery:', error.message);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get cached table discovery results
   */
  async getCachedTableDiscovery(baseId) {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, cache miss');
        this.stats.misses++;
        return null;
      }

      const key = this.getCacheKey('tables', baseId);
      const cached = await redisService.client.get(key);
      
      if (!cached) {
        this.stats.misses++;
        console.log(`💨 Cache miss for table discovery: ${baseId}`);
        return null;
      }

      const data = JSON.parse(cached);
      this.stats.hits++;
      
      console.log(`🎯 Cache hit for table discovery: ${baseId} (${data.tables.length} tables, cached ${Math.round((Date.now() - data.timestamp) / 1000)}s ago)`);
      return data.tables;
    } catch (error) {
      console.error('❌ Error getting cached table discovery:', error.message);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Cache table schema information
   */
  async cacheTableSchema(baseId, tableName, schema) {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, skipping cache set');
        return false;
      }

      const key = this.getCacheKey('schema', baseId, tableName);
      const data = {
        schema,
        tableName,
        timestamp: Date.now(),
        cached_at: new Date().toISOString()
      };

      await redisService.client.setex(key, redisService.ttl.schemaCache, JSON.stringify(data));
      this.stats.sets++;
      
      console.log(`✅ Cached schema for ${tableName} in base ${baseId}`);
      return true;
    } catch (error) {
      console.error('❌ Error caching table schema:', error.message);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get cached table schema
   */
  async getCachedTableSchema(baseId, tableName) {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, cache miss');
        this.stats.misses++;
        return null;
      }

      const key = this.getCacheKey('schema', baseId, tableName);
      const cached = await redisService.client.get(key);
      
      if (!cached) {
        this.stats.misses++;
        console.log(`💨 Cache miss for schema: ${tableName} in ${baseId}`);
        return null;
      }

      const data = JSON.parse(cached);
      this.stats.hits++;
      
      console.log(`🎯 Cache hit for schema: ${tableName} in ${baseId} (cached ${Math.round((Date.now() - data.timestamp) / 1000)}s ago)`);
      return data.schema;
    } catch (error) {
      console.error('❌ Error getting cached table schema:', error.message);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Cache table records (for small tables or samples)
   */
  async cacheTableRecords(baseId, tableName, records, ttl = null) {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, skipping cache set');
        return false;
      }

      const key = this.getCacheKey('records', baseId, tableName);
      const data = {
        records,
        tableName,
        recordCount: records.length,
        timestamp: Date.now(),
        cached_at: new Date().toISOString()
      };

      const cacheTtl = ttl || redisService.ttl.tableCache;
      await redisService.client.setex(key, cacheTtl, JSON.stringify(data));
      this.stats.sets++;
      
      console.log(`✅ Cached ${records.length} records for ${tableName} in base ${baseId}`);
      return true;
    } catch (error) {
      console.error('❌ Error caching table records:', error.message);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get cached table records
   */
  async getCachedTableRecords(baseId, tableName) {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, cache miss');
        this.stats.misses++;
        return null;
      }

      const key = this.getCacheKey('records', baseId, tableName);
      const cached = await redisService.client.get(key);
      
      if (!cached) {
        this.stats.misses++;
        console.log(`💨 Cache miss for records: ${tableName} in ${baseId}`);
        return null;
      }

      const data = JSON.parse(cached);
      this.stats.hits++;
      
      console.log(`🎯 Cache hit for records: ${tableName} in ${baseId} (${data.recordCount} records, cached ${Math.round((Date.now() - data.timestamp) / 1000)}s ago)`);
      return data.records;
    } catch (error) {
      console.error('❌ Error getting cached table records:', error.message);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Invalidate cache for a specific base (all tables and schemas)
   */
  async invalidateBase(baseId) {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, cannot invalidate cache');
        return false;
      }

      const patterns = [
        this.getCacheKey('tables', baseId),
        this.getCacheKey('schema', baseId, '*'),
        this.getCacheKey('records', baseId, '*')
      ];

      let deletedKeys = 0;
      
      for (const pattern of patterns) {
        if (pattern.includes('*')) {
          // Use SCAN for pattern matching to avoid blocking
          const keys = await redisService.client.keys(pattern);
          if (keys.length > 0) {
            await redisService.client.del(...keys);
            deletedKeys += keys.length;
          }
        } else {
          const result = await redisService.client.del(pattern);
          deletedKeys += result;
        }
      }

      this.stats.deletes += deletedKeys;
      console.log(`🗑️ Invalidated cache for base ${baseId}: ${deletedKeys} keys deleted`);
      return deletedKeys;
    } catch (error) {
      console.error('❌ Error invalidating base cache:', error.message);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Invalidate cache for a specific table
   */
  async invalidateTable(baseId, tableName) {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, cannot invalidate cache');
        return false;
      }

      const keys = [
        this.getCacheKey('schema', baseId, tableName),
        this.getCacheKey('records', baseId, tableName)
      ];

      const result = await redisService.client.del(...keys);
      this.stats.deletes += result;
      
      console.log(`🗑️ Invalidated cache for table ${tableName} in base ${baseId}: ${result} keys deleted`);
      return result;
    } catch (error) {
      console.error('❌ Error invalidating table cache:', error.message);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Clear all cache data
   */
  async clearAllCache() {
    try {
      if (!redisService.isConnected) {
        console.warn('⚠️ Redis not connected, cannot clear cache');
        return false;
      }

      const pattern = `${this.prefix}:*`;
      const keys = await redisService.client.keys(pattern);
      
      if (keys.length > 0) {
        await redisService.client.del(...keys);
        this.stats.deletes += keys.length;
        console.log(`🗑️ Cleared all cache data: ${keys.length} keys deleted`);
        return keys.length;
      } else {
        console.log('🗑️ No cache data to clear');
        return 0;
      }
    } catch (error) {
      console.error('❌ Error clearing cache:', error.message);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get cache statistics and health information
   */
  async getStats() {
    try {
      const redisStats = await redisService.getInfo();
      const cacheKeys = await redisService.client.keys(`${this.prefix}:*`);
      
      return {
        cache: {
          ...this.stats,
          hitRate: this.stats.hits + this.stats.misses > 0 
            ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2) + '%'
            : '0%',
          totalKeys: cacheKeys.length,
          keysByType: this.categorizeKeys(cacheKeys)
        },
        redis: {
          connected: redisService.isConnected,
          dbSize: redisStats.dbSize,
          memoryUsed: redisStats.memory?.used_memory_human || 'unknown'
        }
      };
    } catch (error) {
      console.error('❌ Error getting cache stats:', error.message);
      return {
        cache: { ...this.stats, error: error.message },
        redis: { connected: false, error: error.message }
      };
    }
  }

  /**
   * Categorize cache keys by type for statistics
   */
  categorizeKeys(keys) {
    const categories = {
      tables: 0,
      schemas: 0,
      records: 0,
      other: 0
    };

    for (const key of keys) {
      if (key.includes(':tables:')) {
        categories.tables++;
      } else if (key.includes(':schema:')) {
        categories.schemas++;
      } else if (key.includes(':records:')) {
        categories.records++;
      } else {
        categories.other++;
      }
    }

    return categories;
  }

  /**
   * Warm up cache for a specific base
   * Pre-populates cache with commonly accessed data
   */
  async warmupCache(baseId, airtableService) {
    try {
      console.log(`🔥 Starting cache warmup for base ${baseId}...`);
      
      // Cache table discovery first
      const tables = await airtableService.discoverTablesWithCounts();
      await this.cacheTableDiscovery(baseId, tables);
      
      // Cache schemas for all tables
      let schemasWarmed = 0;
      for (const table of tables) {
        try {
          const schema = await airtableService.getTableSchema(table.name);
          await this.cacheTableSchema(baseId, table.name, schema);
          schemasWarmed++;
        } catch (error) {
          console.warn(`⚠️ Failed to warm schema cache for table ${table.name}: ${error.message}`);
        }
      }
      
      console.log(`✅ Cache warmup completed for base ${baseId}: ${tables.length} tables, ${schemasWarmed} schemas`);
      return { tables: tables.length, schemas: schemasWarmed };
    } catch (error) {
      console.error('❌ Error during cache warmup:', error.message);
      throw error;
    }
  }
}

// Create singleton instance
const redisCacheService = new RedisCacheService();

module.exports = redisCacheService;