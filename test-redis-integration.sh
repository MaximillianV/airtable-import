#!/bin/bash

# Quick verification script for Redis integration
echo "🔍 Testing Redis Integration Locally"
echo "======================================"

cd /root/airtable-import/backend

# Check if Redis is available
echo "1. Checking Redis availability..."
if redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is running"
else
    echo "⚠️  Redis not running, starting it..."
    redis-server --daemonize yes --port 6379 --bind 127.0.0.1 > /dev/null 2>&1
    sleep 2
    if redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis started successfully"
    else
        echo "❌ Failed to start Redis"
        exit 1
    fi
fi

# Test Redis services
echo ""
echo "2. Testing Redis services..."

# Create a simple test file
cat > test-redis-services.js << 'EOF'
const redisService = require('./src/services/redis');
const redisSessionService = require('./src/services/redisSession');
const redisCacheService = require('./src/services/redisCache');

(async () => {
  let exitCode = 0;
  
  try {
    console.log('🔄 Connecting to Redis...');
    const connected = await redisService.connect();
    
    if (!connected) {
      console.error('❌ Failed to connect to Redis');
      exitCode = 1;
    } else {
      console.log('✅ Redis connection successful');
      
      // Test cache service
      console.log('🔄 Testing cache service...');
      await redisCacheService.set('test:key', { message: 'Hello Redis!' }, 60);
      const cached = await redisCacheService.get('test:key');
      
      if (cached && cached.message === 'Hello Redis!') {
        console.log('✅ Cache service working');
      } else {
        console.error('❌ Cache service failed');
        exitCode = 1;
      }
      
      // Test session service
      console.log('🔄 Testing session service...');
      const sessionId = 'test-session-' + Date.now();
      await redisSessionService.storeSession(sessionId, {
        status: 'running',
        startTime: new Date().toISOString()
      });
      
      const session = await redisSessionService.getSession(sessionId);
      if (session && session.status === 'running') {
        console.log('✅ Session service working');
      } else {
        console.error('❌ Session service failed');
        exitCode = 1;
      }
      
      // Cleanup
      await redisService.disconnect();
    }
  } catch (error) {
    console.error('❌ Redis test failed:', error.message);
    exitCode = 1;
  }
  
  process.exit(exitCode);
})();
EOF

# Run the test
echo "Running Redis service tests..."
REDIS_URL=redis://localhost:6379 REDIS_ENABLED=true node test-redis-services.js

TEST_RESULT=$?
rm -f test-redis-services.js

echo ""
echo "3. Test Results:"
if [ $TEST_RESULT -eq 0 ]; then
    echo "🎉 All Redis integration tests passed!"
    echo ""
    echo "✅ Ready for CI/CD pipeline!"
    echo "✅ GitHub Actions workflow should now work properly"
    echo ""
    echo "📋 Summary:"
    echo "  - Redis service integration: ✅ Working"
    echo "  - Cache service: ✅ Working" 
    echo "  - Session service: ✅ Working"
    echo "  - Dependencies fixed: ✅ Complete"
    echo ""
else
    echo "❌ Some Redis tests failed"
    echo "Check the output above for details"
    exit 1
fi