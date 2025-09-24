# Redis Implementation Plan for Airtable Import

## Overview
Integrate Redis to solve caching, session management, and real-time update challenges in the Airtable Import system.

## Current Problems Redis Will Solve

### 1. Volatile Cache (SchemaCache)
- **Problem**: In-memory cache lost on server restart
- **Impact**: Repeated expensive Airtable API calls
- **Redis Solution**: Persistent cache with TTL

### 2. Lost Import Progress
- **Problem**: Server restart loses all import session progress
- **Impact**: Users lose track of long-running imports
- **Redis Solution**: Progress persistence with real-time updates

### 3. Frontend-Backend Sync Issues
- **Problem**: Socket.IO events can be missed or lost
- **Impact**: Frontend shows wrong status (like "Invoice Lines" stuck at fetching)
- **Redis Solution**: Single source of truth for session state

### 4. Scalability Limitations
- **Problem**: Current setup doesn't scale across multiple server instances
- **Impact**: Can't handle high load or redundancy
- **Redis Solution**: Shared state across all server instances

## Implementation Phases

### Phase 1: Basic Redis Integration
1. **Add Redis Dependencies**
   ```bash
   npm install redis ioredis
   ```

2. **Create Redis Service Layer**
   ```javascript
   // services/redis.js
   class RedisService {
     constructor() {
       this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
       this.publisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
       this.subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
     }
   }
   ```

3. **Replace SchemaCache with Redis**
   - Move from in-memory Map to Redis Hash
   - Implement TTL-based expiration
   - Add cache statistics and management

### Phase 2: Session Progress Tracking
1. **Redis-Based Progress Storage**
   ```javascript
   // Store session progress in Redis
   await redis.hset(`session:${sessionId}:progress`, {
     [tableName]: JSON.stringify(progressData)
   });
   ```

2. **Real-Time Progress Updates**
   ```javascript
   // Publish progress updates
   await redis.publish(`session:${sessionId}:progress`, JSON.stringify(progressData));
   ```

3. **Session State Management**
   ```javascript
   // Store complete session state
   await redis.hset(`session:${sessionId}`, {
     status: 'RUNNING',
     startTime: new Date().toISOString(),
     tableNames: JSON.stringify(tableNames),
     results: JSON.stringify(results)
   });
   ```

### Phase 3: Enhanced Real-Time Updates
1. **Redis Pub/Sub Integration**
   - Replace Socket.IO with Redis Pub/Sub for backend communication
   - Keep Socket.IO for frontend communication but backed by Redis
   - Ensure all progress updates go through Redis first

2. **Session Completion Guarantees**
   ```javascript
   // Ensure session completion is always recorded
   await redis.multi()
     .hset(`session:${sessionId}`, 'status', 'COMPLETED')
     .hset(`session:${sessionId}`, 'endTime', new Date().toISOString())
     .publish(`session:${sessionId}:complete`, JSON.stringify(sessionData))
     .exec();
   ```

### Phase 4: Advanced Features
1. **Import Job Queue**
   ```javascript
   // Use Redis for job queuing
   await redis.lpush('import_queue', JSON.stringify({
     sessionId,
     tableNames,
     userId,
     priority: 'normal'
   }));
   ```

2. **Rate Limiting**
   ```javascript
   // Airtable API rate limiting
   const key = `rate_limit:airtable:${baseId}`;
   const count = await redis.incr(key);
   if (count === 1) await redis.expire(key, 1); // 1 second window
   if (count > 5) throw new Error('Rate limit exceeded');
   ```

3. **User Session Management**
   ```javascript
   // JWT token blacklisting
   await redis.setex(`blacklist:${token}`, ttl, 'true');
   ```

## File Structure

```
backend/src/
├── services/
│   ├── redis.js              # Core Redis service
│   ├── redisCache.js         # Redis-based schema cache
│   ├── redisSession.js       # Redis-based session management
│   ├── redisPubSub.js        # Redis pub/sub for real-time updates
│   └── redisQueue.js         # Redis-based job queue
├── middleware/
│   └── redisRateLimit.js     # Redis-based rate limiting
└── utils/
    └── redisHealth.js        # Redis health checks
```

## Benefits

### 1. **Persistence**
- Cache survives server restarts
- Import progress never lost
- Session state always available

### 2. **Scalability**
- Multiple server instances can share state
- Load balancing becomes possible
- Horizontal scaling ready

### 3. **Reliability**
- Single source of truth for all state
- Atomic operations prevent race conditions
- Built-in data expiration

### 4. **Performance**
- Faster than database queries for frequent operations
- Optimized data structures (Hash, List, Set, Sorted Set)
- Memory-based operations

### 5. **Real-Time Guarantees**
- Pub/Sub ensures all updates are received
- No more missed Socket.IO events
- Consistent state across all clients

## Implementation Priority

### High Priority (Fix Current Issues)
1. **Session Progress Persistence** - Fix the exact problem you experienced
2. **Redis-Based Schema Cache** - Eliminate duplicate API calls permanently
3. **Reliable Session Completion** - No more stuck progress states

### Medium Priority (Scalability)
4. **Redis Pub/Sub Integration** - Better real-time updates
5. **Import Job Queue** - Handle multiple concurrent imports
6. **Rate Limiting** - Prevent Airtable API abuse

### Future (Advanced Features)
7. **User Session Management** - JWT blacklisting, session storage
8. **Advanced Caching Strategies** - Smart cache warming, prefetching
9. **Analytics & Monitoring** - Redis-based metrics collection

## Development Approach

### Option A: Gradual Migration
- Keep existing code working
- Add Redis alongside current implementation
- Gradually migrate features one by one
- Zero downtime deployment

### Option B: Full Redis Implementation
- Implement comprehensive Redis solution
- Replace current caching and session management
- Single deployment with all Redis features

**Recommendation**: Start with Option A for safety, focusing on fixing the current session sync issues first.

## Next Steps

1. **Add Redis to development environment**
2. **Create RedisService layer**
3. **Implement Redis-based session progress tracking**
4. **Test with the current stuck session issue**
5. **Gradually replace other in-memory operations**

This would transform the application from a simple single-server setup to a production-ready, scalable system that can handle enterprise workloads.