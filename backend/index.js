require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createServer } = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./src/routes/auth');
const { router: importRoutes, setupSocketIO } = require('./src/routes/import');
const { router: settingsRoutes } = require('./src/routes/settings');
const { router: redisRoutes } = require('./src/routes/redis');

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
app.use('/api/settings', settingsRoutes);
app.use('/api/redis', redisRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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
        
        // Cleanup on exit
        process.on('SIGTERM', () => {
          clearInterval(cleanupInterval);
          redisService.disconnect();
        });
        
        process.on('SIGINT', () => {
          clearInterval(cleanupInterval);
          redisService.disconnect();
        });
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