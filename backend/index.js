require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./src/routes/auth');
const { router: importRoutes, setupSocketIO } = require('./src/routes/import');
const { router: redisRoutes } = require('./src/routes/redis');
const stagedWorkflowRoutes = require('./src/routes/staged-workflow');
const enhancedRelationshipRoutes = require('./src/routes/enhanced-relationship-analysis');
const modularAnalysisRoutes = require('./src/routes/modular-relationship-analysis');

// Initialize Redis services
const redisService = require('./src/services/redis');
const redisSessionService = require('./src/services/redisSession');
const redisCacheService = require('./src/services/redisCache');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/import', importRoutes);
app.use('/api/redis', redisRoutes);
app.use('/api/staged-workflow', stagedWorkflowRoutes);
app.use('/api/enhanced-relationship-analysis', enhancedRelationshipRoutes);
app.use('/api/modular-analysis', modularAnalysisRoutes);
app.use('/api/v2-import', require('./src/routes/v2-import'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Configuration status endpoint
app.get('/api/health/config', (req, res) => {
  const airtableConfigured = !!(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);
  const databaseConfigured = !!process.env.DATABASE_URL;
  
  res.json({
    airtableConfigured,
    databaseConfigured,
    configurationComplete: airtableConfigured && databaseConfigured
  });
});

// Setup Socket.IO
setupSocketIO(io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize Redis connection on startup
async function initializeRedis() {
  try {
    const redisEnabled = process.env.REDIS_ENABLED !== 'false';
    
    if (redisEnabled) {
      console.log('🔄 Initializing Redis connection...');
      const connected = await redisService.connect();
      
      if (connected) {
        console.log('✅ Redis services initialized successfully');
        
        // Start periodic cleanup of expired sessions
        const cleanupInterval = setInterval(async () => {
          await redisSessionService.cleanupExpiredSessions();
        }, 5 * 60 * 1000); // Every 5 minutes
        
        // Store cleanup interval for graceful shutdown
        global.cleanupInterval = cleanupInterval;
      } else {
        console.log('⚠️  Redis connection failed, using in-memory fallback');
      }
    } else {
      console.log('ℹ️  Redis disabled, using in-memory storage');
    }
  } catch (error) {
    console.error('❌ Redis initialization error:', error.message);
    console.log('⚠️  Continuing with in-memory storage');
  }
}

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize Redis after server starts
  await initializeRedis();
});

/**
 * Graceful shutdown handler for SIGINT (Ctrl+C) and SIGTERM
 * Ensures proper cleanup of Redis connections and other resources
 */
async function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Clear Redis cleanup interval if it exists
    if (global.cleanupInterval) {
      console.log('🔄 Clearing Redis cleanup interval...');
      clearInterval(global.cleanupInterval);
    }
    
    // Disconnect Redis services
    console.log('🔄 Disconnecting from Redis...');
    await redisService.disconnect();
    console.log('✅ Redis disconnected successfully');
    
    // Close the HTTP server
    console.log('🔄 Closing HTTP server...');
    server.close(() => {
      console.log('✅ HTTP server closed');
      console.log('👋 Graceful shutdown completed');
      process.exit(0);
    });
    
    // Force exit after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('❌ Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});