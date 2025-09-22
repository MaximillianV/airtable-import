const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const ImportService = require('../services/import');
const { getUserSettings } = require('./settings');
const DatabaseService = require('../services/database');

const router = express.Router();

// Initialize database service for import session management
const db = new DatabaseService();

/**
 * Initialize import routes database connection
 */
async function initializeImportService() {
  try {
    await db.connect();
    console.log('✅ Import routes database connection established');
  } catch (error) {
    console.error('❌ Failed to connect import routes to database:', error.message);
  }
}

// Initialize on startup
initializeImportService();

/**
 * Start import process endpoint
 * Creates import session in database and starts Airtable data import
 */
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { tableNames } = req.body;
    const userId = req.user.userId;

    // Validate input parameters
    if (!tableNames || !Array.isArray(tableNames) || tableNames.length === 0) {
      return res.status(400).json({ error: 'Table names array is required' });
    }

    // Get user settings from database
    const settings = await getUserSettings(userId);
    if (!settings) {
      return res.status(400).json({ error: 'Please configure your settings first' });
    }

    const { airtableApiKey, airtableBaseId, databaseUrl } = settings;

    // Validate required settings
    if (!airtableApiKey || !airtableBaseId || !databaseUrl) {
      return res.status(400).json({ 
        error: 'Missing required settings: Airtable API key, base ID, or database URL' 
      });
    }

    // Create import session in database using Prisma
    const importSession = await db.createImportSession(userId, tableNames);
    const sessionId = importSession.id;

    console.log(`✅ Import session created: ${sessionId} for user ${req.user.email}`);

    // Start import process asynchronously
    (async () => {
      try {
        // Update session status to running
        await db.updateImportSession(sessionId, { 
          status: 'RUNNING',
          startedAt: new Date()
        });

        // Create and configure import service
        const importService = new ImportService();
        await importService.connect(airtableApiKey, airtableBaseId, databaseUrl);
        
        // Import all tables and get results
        const results = await importService.importMultipleTables(tableNames, sessionId);
        
        // Update session with completion status
        await db.updateImportSession(sessionId, {
          status: 'COMPLETED',
          endTime: new Date(),
          processedRecords: results.successful,
          errorMessage: results.errors.length > 0 ? JSON.stringify(results.errors) : null
        });

        console.log(`✅ Import session completed: ${sessionId}`);
        await importService.disconnect();
      } catch (error) {
        console.error(`❌ Import session failed: ${sessionId}`, error.message);
        
        // Update session with error status
        await db.updateImportSession(sessionId, {
          status: 'FAILED',
          endTime: new Date(),
          errorMessage: error.message
        });
      }
    })();

    res.json({
      sessionId,
      message: 'Import started successfully',
      tableNames,
      status: 'PENDING'
    });
  } catch (error) {
    console.error('❌ Error starting import:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get import status endpoint
 * Retrieves import session status from database
 */
router.get('/status/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get session from database using Prisma
    const session = await db.getImportSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify user owns this session
    if (session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Format response data
    const responseData = {
      sessionId: session.id,
      status: session.status,
      startTime: session.createdAt,
      tableNames: session.tableNames,
      totalTables: session.totalTables,
      processedRecords: session.processedRecords || 0
    };

    if (session.startedAt) {
      responseData.startedAt = session.startedAt;
    }

    if (session.endTime) {
      responseData.endTime = session.endTime;
    }

    if (session.errorMessage) {
      responseData.error = session.errorMessage;
    }

    if (session.importedTables && session.importedTables.length > 0) {
      responseData.importedTables = session.importedTables.map(table => ({
        tableName: table.tableName,
        recordCount: table.recordCount,
        status: table.status,
        createdAt: table.createdAt
      }));
    }

    res.json(responseData);
  } catch (error) {
    console.error('❌ Error getting import status:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * List import sessions for user endpoint
 * Retrieves all import sessions for the authenticated user
 */
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 20;

    // Get user's import sessions from database using Prisma
    const sessions = await db.getImportSessions(userId, limit);

    // Format sessions for response
    const formattedSessions = sessions.map(session => ({
      sessionId: session.id,
      status: session.status,
      startTime: session.createdAt,
      startedAt: session.startedAt,
      endTime: session.endTime,
      tableNames: session.tableNames,
      totalTables: session.totalTables,
      processedRecords: session.processedRecords || 0,
      importedTablesCount: session.importedTables?.length || 0
    }));

    res.json(formattedSessions);
  } catch (error) {
    console.error('❌ Error listing import sessions:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Test table access endpoint
 * Validates access to specific Airtable table without importing
 */
router.post('/test-table', authenticateToken, async (req, res) => {
  try {
    const { tableName } = req.body;
    const userId = req.user.userId;

    // Validate input
    if (!tableName) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    // Get user settings from database
    const settings = await getUserSettings(userId);
    if (!settings) {
      return res.status(400).json({ error: 'Please configure your settings first' });
    }

    const { airtableApiKey, airtableBaseId } = settings;

    // Create import service instance for testing
    const importService = new ImportService();
    
    try {
      // Connect to Airtable and test table access
      importService.airtableService.connect(airtableApiKey, airtableBaseId);
      
      // Try to fetch a small sample of records
      const records = await importService.airtableService.getTableRecords(tableName);
      
      console.log(`✅ Table access test successful: ${tableName} (${records.length} records)`);
      res.json({
        tableName,
        accessible: true,
        recordCount: records.length,
        message: `Table "${tableName}" is accessible with ${records.length} records`
      });
    } catch (error) {
      console.log(`❌ Table access test failed: ${tableName} - ${error.message}`);
      res.json({
        tableName,
        accessible: false,
        error: error.message,
        message: `Table "${tableName}" is not accessible: ${error.message}`
      });
    }
  } catch (error) {
    console.error('❌ Error testing table access:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Setup Socket.IO for real-time progress updates
 * Handles WebSocket connections for live import progress tracking
 */
function setupSocketIO(io) {
  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    // Handle session joining for progress updates
    socket.on('join-session', async ({ sessionId, token }) => {
      try {
        // Verify JWT token
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret-change-this-in-production';
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Verify session exists and user has access
        const session = await db.getImportSession(sessionId);
        if (session && session.userId === decoded.userId) {
          socket.join(`progress-${sessionId}`);
          
          console.log(`👤 User ${decoded.email} joined session ${sessionId}`);
          socket.emit('joined-session', { sessionId });
          
          // Send current session status
          socket.emit('import-progress', {
            sessionId,
            status: session.status,
            processedRecords: session.processedRecords || 0,
            totalTables: session.totalTables
          });
        } else {
          socket.emit('error', { message: 'Session not found or access denied' });
        }
      } catch (error) {
        console.error('❌ Socket authentication error:', error.message);
        socket.emit('error', { message: 'Invalid token' });
      }
    });

    // Legacy support for old subscribe-progress event
    socket.on('subscribe-progress', ({ sessionId, token }) => {
      // Redirect to join-session for backward compatibility
      socket.emit('join-session', { sessionId, token });
    });

    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id);
    });
  });

  // Export socket instance for use in import service
  global.socketIO = io;
}

module.exports = { router, setupSocketIO };