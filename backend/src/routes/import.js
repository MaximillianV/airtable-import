const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const ImportService = require('../services/import');
const { getUserSettings } = require('./settings');

const router = express.Router();

// Active import sessions
const activeSessions = new Map();

// Start import process
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { tableNames } = req.body;
    const userId = req.user.userId;

    if (!tableNames || !Array.isArray(tableNames) || tableNames.length === 0) {
      return res.status(400).json({ error: 'Table names array is required' });
    }

    // Get user settings
    const settings = getUserSettings(userId);
    if (!settings) {
      return res.status(400).json({ error: 'Please configure your settings first' });
    }

    const { airtableApiKey, airtableBaseId, databaseUrl } = settings;

    // Create import service instance
    const importService = new ImportService();
    const sessionId = `${userId}_${Date.now()}`;

    // Store session
    activeSessions.set(sessionId, {
      userId,
      importService,
      status: 'starting',
      startTime: new Date(),
      tableNames
    });

    // Start import process (async)
    (async () => {
      try {
        await importService.connect(airtableApiKey, airtableBaseId, databaseUrl);
        
        const results = await importService.importMultipleTables(tableNames, sessionId);
        
        // Update session status
        const session = activeSessions.get(sessionId);
        if (session) {
          session.status = 'completed';
          session.endTime = new Date();
          session.results = results;
        }

        await importService.disconnect();
      } catch (error) {
        console.error('Import error:', error);
        const session = activeSessions.get(sessionId);
        if (session) {
          session.status = 'error';
          session.error = error.message;
          session.endTime = new Date();
        }
      }
    })();

    res.json({
      sessionId,
      message: 'Import started successfully',
      tableNames
    });
  } catch (error) {
    console.error('Error starting import:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get import status
router.get('/status/:sessionId', authenticateToken, (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const responseData = {
      sessionId,
      status: session.status,
      startTime: session.startTime,
      tableNames: session.tableNames
    };

    if (session.endTime) {
      responseData.endTime = session.endTime;
    }

    if (session.results) {
      responseData.results = session.results;
    }

    if (session.error) {
      responseData.error = session.error;
    }

    res.json(responseData);
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List active sessions for user
router.get('/sessions', authenticateToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const userSessions = [];

    for (const [sessionId, session] of activeSessions.entries()) {
      if (session.userId === userId) {
        userSessions.push({
          sessionId,
          status: session.status,
          startTime: session.startTime,
          endTime: session.endTime,
          tableNames: session.tableNames
        });
      }
    }

    res.json(userSessions);
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test table access
router.post('/test-table', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.body;
    const userId = req.user.userId;

    if (!tableName) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    // Get user settings
    const settings = getUserSettings(userId);
    if (!settings) {
      return res.status(400).json({ error: 'Please configure your settings first' });
    }

    const { airtableApiKey, airtableBaseId } = settings;

    // Create import service instance
    const importService = new ImportService();
    
    try {
      importService.airtableService.connect(airtableApiKey, airtableBaseId);
      
      // Try to fetch a small sample of records
      const records = await importService.airtableService.getTableRecords(tableName);
      
      res.json({
        tableName,
        accessible: true,
        recordCount: records.length,
        message: `Table "${tableName}" is accessible with ${records.length} records`
      });
    } catch (error) {
      res.json({
        tableName,
        accessible: false,
        error: error.message,
        message: `Table "${tableName}" is not accessible: ${error.message}`
      });
    }
  } catch (error) {
    console.error('Error testing table:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Setup Socket.IO for real-time progress updates
function setupSocketIO(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('subscribe-progress', ({ sessionId, token }) => {
      // Verify JWT token
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const session = activeSessions.get(sessionId);
        if (session && session.userId === decoded.userId) {
          socket.join(`progress-${sessionId}`);
          
          // Setup progress callback for this session
          session.importService.addProgressCallback(sessionId, (data) => {
            io.to(`progress-${sessionId}`).emit('import-progress', data);
          });
          
          socket.emit('subscribed', { sessionId });
        } else {
          socket.emit('error', { message: 'Session not found or access denied' });
        }
      } catch (error) {
        socket.emit('error', { message: 'Invalid token' });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}

module.exports = { router, setupSocketIO, activeSessions };