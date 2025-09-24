/**
 * Schema Cache Service
 * 
 * Caches Airtable schema discovery results to eliminate duplicate API calls.
 * Stores table lists, record counts, and field schemas with TTL-based expiration.
 * 
 * Cache Structure:
 * - Tables Discovery: baseId -> { tables: [...], timestamp, ttl }
 * - Table Schemas: baseId:tableName -> { schema: {...}, timestamp, ttl }
 * 
 * Performance Benefits:
 * - Eliminates duplicate discoverTablesWithCounts() calls
 * - Reduces getTableSchema() calls when building naming wizards
 * - Significantly reduces Airtable API rate limit usage
 */

class SchemaCache {
  constructor() {
    // In-memory cache - could be extended to use Redis in production
    this.cache = new Map();
    
    // Default TTL: 5 minutes for table discovery, 10 minutes for schemas
    this.defaultTTL = {
      tables: 5 * 60 * 1000,  // 5 minutes - tables might be added/removed
      schemas: 10 * 60 * 1000, // 10 minutes - field schemas change less frequently
      records: 2 * 60 * 1000   // 2 minutes - record counts change frequently
    };
    
    // Start cleanup interval to remove expired entries
    this.startCleanupInterval();
    
    console.log('📋 Schema cache initialized with TTL settings:', {
      tables: `${this.defaultTTL.tables / 1000}s`,
      schemas: `${this.defaultTTL.schemas / 1000}s`, 
      records: `${this.defaultTTL.records / 1000}s`
    });
  }

  /**
   * Generate cache key for different types of cached data
   * @param {string} type - 'tables', 'schema', 'records'
   * @param {string} baseId - Airtable base ID 
   * @param {string} [tableName] - Table name for schema/record caches
   * @returns {string} Cache key
   */
  getCacheKey(type, baseId, tableName = null) {
    switch (type) {
      case 'tables':
        return `tables:${baseId}`;
      case 'schema':
        return `schema:${baseId}:${tableName}`;
      case 'records':
        return `records:${baseId}:${tableName}`;
      default:
        throw new Error(`Unknown cache type: ${type}`);
    }
  }

  /**
   * Check if cached data is still valid based on TTL
   * @param {Object} cachedItem - Cached item with timestamp and ttl
   * @returns {boolean} True if still valid
   */
  isValid(cachedItem) {
    if (!cachedItem || !cachedItem.timestamp || !cachedItem.ttl) {
      return false;
    }
    
    const now = Date.now();
    const expiresAt = cachedItem.timestamp + cachedItem.ttl;
    return now < expiresAt;
  }

  /**
   * Get tables discovery from cache
   * @param {string} baseId - Airtable base ID
   * @returns {Array|null} Cached tables array or null if not found/expired
   */
  getTablesDiscovery(baseId) {
    const key = this.getCacheKey('tables', baseId);
    const cached = this.cache.get(key);
    
    if (this.isValid(cached)) {
      console.log(`📋 Cache HIT for tables discovery: ${baseId} (age: ${Date.now() - cached.timestamp}ms)`);
      return cached.data;
    }
    
    console.log(`📋 Cache MISS for tables discovery: ${baseId}`);
    return null;
  }

  /**
   * Store tables discovery in cache
   * @param {string} baseId - Airtable base ID
   * @param {Array} tables - Tables array with counts and metadata
   * @param {number} [customTTL] - Custom TTL in milliseconds
   */
  setTablesDiscovery(baseId, tables, customTTL = null) {
    const key = this.getCacheKey('tables', baseId);
    const ttl = customTTL || this.defaultTTL.tables;
    
    const cacheItem = {
      data: tables,
      timestamp: Date.now(),
      ttl: ttl,
      type: 'tables'
    };
    
    this.cache.set(key, cacheItem);
    console.log(`📋 Cache SET for tables discovery: ${baseId} (${tables.length} tables, TTL: ${ttl/1000}s)`);
  }

  /**
   * Get table schema from cache
   * @param {string} baseId - Airtable base ID
   * @param {string} tableName - Table name
   * @returns {Object|null} Cached schema object or null if not found/expired
   */
  getTableSchema(baseId, tableName) {
    const key = this.getCacheKey('schema', baseId, tableName);
    const cached = this.cache.get(key);
    
    if (this.isValid(cached)) {
      console.log(`📋 Cache HIT for table schema: ${baseId}:${tableName} (age: ${Date.now() - cached.timestamp}ms)`);
      return cached.data;
    }
    
    console.log(`📋 Cache MISS for table schema: ${baseId}:${tableName}`);
    return null;
  }

  /**
   * Store table schema in cache
   * @param {string} baseId - Airtable base ID
   * @param {string} tableName - Table name
   * @param {Object} schema - Table schema with fields
   * @param {number} [customTTL] - Custom TTL in milliseconds
   */
  setTableSchema(baseId, tableName, schema, customTTL = null) {
    const key = this.getCacheKey('schema', baseId, tableName);
    const ttl = customTTL || this.defaultTTL.schemas;
    
    const cacheItem = {
      data: schema,
      timestamp: Date.now(),
      ttl: ttl,
      type: 'schema'
    };
    
    this.cache.set(key, cacheItem);
    console.log(`📋 Cache SET for table schema: ${baseId}:${tableName} (${schema.fields?.length || 0} fields, TTL: ${ttl/1000}s)`);
  }

  /**
   * Invalidate cache for a specific base (clears all related cache entries)
   * @param {string} baseId - Airtable base ID
   */
  invalidateBase(baseId) {
    let removedCount = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (key.includes(baseId)) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    console.log(`📋 Cache INVALIDATED for base ${baseId}: ${removedCount} entries removed`);
  }

  /**
   * Invalidate cache for a specific table (clears schema cache only)
   * @param {string} baseId - Airtable base ID
   * @param {string} tableName - Table name
   */
  invalidateTable(baseId, tableName) {
    const schemaKey = this.getCacheKey('schema', baseId, tableName);
    const recordsKey = this.getCacheKey('records', baseId, tableName);
    
    let removedCount = 0;
    if (this.cache.delete(schemaKey)) removedCount++;
    if (this.cache.delete(recordsKey)) removedCount++;
    
    console.log(`📋 Cache INVALIDATED for table ${baseId}:${tableName}: ${removedCount} entries removed`);
  }

  /**
   * Get cache statistics for monitoring
   * @returns {Object} Cache statistics
   */
  getStats() {
    const stats = {
      totalEntries: this.cache.size,
      entries: {
        tables: 0,
        schemas: 0,
        records: 0
      },
      oldestEntry: null,
      newestEntry: null
    };
    
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;
    
    for (const [key, value] of this.cache.entries()) {
      // Count by type
      if (key.startsWith('tables:')) stats.entries.tables++;
      else if (key.startsWith('schema:')) stats.entries.schemas++;
      else if (key.startsWith('records:')) stats.entries.records++;
      
      // Track age
      if (value.timestamp < oldestTimestamp) oldestTimestamp = value.timestamp;
      if (value.timestamp > newestTimestamp) newestTimestamp = value.timestamp;
    }
    
    if (stats.totalEntries > 0) {
      stats.oldestEntry = new Date(oldestTimestamp).toISOString();
      stats.newestEntry = new Date(newestTimestamp).toISOString();
    }
    
    return stats;
  }

  /**
   * Clean up expired cache entries
   * Called automatically by cleanup interval
   */
  cleanup() {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (!this.isValid(value)) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`📋 Cache cleanup completed: ${removedCount} expired entries removed`);
    }
  }

  /**
   * Start automatic cleanup interval to remove expired entries
   */
  startCleanupInterval() {
    // Run cleanup every 2 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 2 * 60 * 1000);
  }

  /**
   * Stop automatic cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const entriesRemoved = this.cache.size;
    this.cache.clear();
    console.log(`📋 Cache CLEARED: ${entriesRemoved} entries removed`);
  }
}

// Create singleton instance
const schemaCache = new SchemaCache();

module.exports = schemaCache;