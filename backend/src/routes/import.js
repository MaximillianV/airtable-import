const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const ImportService = require('../services/import');
const { getUserSettings } = require('./settings');
const DatabaseService = require('../services/database');
const { sanitizeTableName, sanitizeColumnName } = require('../utils/naming');

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
 * Preview schema mapping endpoint
 * Fetches Airtable schema and shows naming conversion options
 * Allows users to choose between different naming strategies before import
 */
router.get('/schema-preview', authenticateToken, async (req, res) => {
  try {
    // Get user settings for Airtable connection
    const settings = await getUserSettings(req.user.userId);
    
    // Validate required Airtable settings
    if (!settings.airtableApiKey || !settings.airtableBaseId) {
      return res.status(400).json({ 
        error: 'Airtable API key and Base ID are required for schema preview' 
      });
    }

    // Initialize Airtable service
    const AirtableService = require('../services/airtable');
    const airtableService = new AirtableService();
    airtableService.connect(settings.airtableApiKey, settings.airtableBaseId);
    
    // Get all tables from Airtable base with record counts
    const tables = await airtableService.discoverTablesWithCounts();
    
    // Build schema preview with naming options
    const schemaPreview = await Promise.all(
      tables.map(async (table) => {
        try {
          // Get table schema (fields) - use table name since getTableSchema expects name, not ID
          const tableSchema = await airtableService.getTableSchema(table.name);
          
          // Generate naming previews for table
          const tableOriginal = table.name;
          const tableSnakeCase = sanitizeTableName(tableOriginal, false); // preserve plural
          const tableSingularSnakeCase = sanitizeTableName(tableOriginal, true); // force singular
          
          // Generate naming previews for all columns from the fields array
          const columnPreviews = (tableSchema.fields || []).map(field => ({
            original: field.name,
            snakeCase: sanitizeColumnName(field.name),
            singularSnakeCase: sanitizeColumnName(field.name), // columns don't need plural/singular conversion
            type: field.type,
            options: field.options || {}
          }));
          
          return {
            id: table.id,
            name: {
              original: tableOriginal,
              snakeCase: tableSnakeCase,
              singularSnakeCase: tableSingularSnakeCase
            },
            columns: columnPreviews,
            recordCount: table.recordCount || 0
          };
        } catch (error) {
          console.error(`Error fetching schema for table ${table.name}:`, error.message);
          return {
            id: table.id,
            name: {
              original: table.name,
              snakeCase: sanitizeTableName(table.name, false),
              singularSnakeCase: sanitizeTableName(table.name, true)
            },
            columns: [],
            recordCount: table.recordCount || 0,
            error: error.message
          };
        }
      })
    );

    res.json({
      success: true,
      baseId: settings.airtableBaseId,
      tables: schemaPreview,
      totalTables: schemaPreview.length,
      totalColumns: schemaPreview.reduce((sum, table) => sum + table.columns.length, 0)
    });
    
  } catch (error) {
    console.error('Schema preview error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch schema preview: ' + error.message 
    });
  }
});

/**
 * Schema cache statistics endpoint
 * Shows cache performance metrics and current cache contents
 */
router.get('/cache-stats', authenticateToken, async (req, res) => {
  try {
    const schemaCache = require('../services/schemaCache');
    const stats = schemaCache.getStats();
    
    res.json({
      success: true,
      cache: stats,
      message: `Schema cache contains ${stats.totalEntries} entries`
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get cache statistics: ' + error.message 
    });
  }
});

/**
 * Clear schema cache endpoint
 * Clears all cached schema data (useful for testing or when schema changes)
 */
router.post('/clear-cache', authenticateToken, async (req, res) => {
  try {
    const schemaCache = require('../services/schemaCache');
    const { baseId } = req.body;
    
    if (baseId) {
      // Clear cache for specific base
      schemaCache.invalidateBase(baseId);
      res.json({
        success: true,
        message: `Cache cleared for base ${baseId}`
      });
    } else {
      // Clear entire cache
      schemaCache.clear();
      res.json({
        success: true,
        message: 'Entire schema cache cleared'
      });
    }
  } catch (error) {
    console.error('Clear cache error:', error);
    res.status(500).json({ 
      error: 'Failed to clear cache: ' + error.message 
    });
  }
});

/**
 * Emit session completion event for a specific completed session
 * Used to fix frontend state when session completion events were missed
 */
router.post('/emit-session-complete', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Get session from database
    const session = await db.getImportSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Verify user owns this session
    if (session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Only emit for completed sessions
    if (session.status === 'PENDING' || session.status === 'RUNNING') {
      return res.status(400).json({ error: 'Session is still in progress' });
    }
    
    if (global.socketIO) {
      // Parse results and create proper session completion data
      const results = session.results ? (typeof session.results === 'string' ? JSON.parse(session.results) : session.results) : {};
      
      // Convert sanitized table names back to original names for frontend
      const originalResults = {};
      Object.entries(results).forEach(([sanitizedName, result]) => {
        // Try to find the original table name from the session's tableNames
        const originalName = session.tableNames.find(name => 
          name.toLowerCase().replace(/[^a-z0-9]/g, '_') === sanitizedName.toLowerCase()
        ) || sanitizedName;
        
        originalResults[originalName] = result;
      });
      
      const sessionCompleteData = {
        sessionId: session.id,
        status: session.status,
        endTime: session.endTime ? session.endTime.toISOString() : new Date().toISOString(),
        totalTables: session.totalTables || session.tableNames.length,
        successfulTables: Object.values(results).filter(r => r.success).length,
        failedTables: Object.values(results).filter(r => !r.success).length,
        processedRecords: session.processedRecords || 0,
        results: originalResults,
        errors: Object.values(results).filter(r => !r.success).map(r => ({ 
          table: r.tableName, 
          error: r.error 
        }))
      };
      
      // Emit to all clients (since we don't know if the client is still in the session room)
      global.socketIO.emit('session-complete', sessionCompleteData);
      console.log('🔄 Manual session completion event emitted:', sessionId);
      
      res.json({
        success: true,
        message: `Session completion event emitted for session ${sessionId}`,
        sessionCompleteData
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Socket.IO not available - session completion events cannot be sent'
      });
    }
  } catch (error) {
    console.error('Emit session completion error:', error);
    res.status(500).json({
      error: 'Failed to emit session completion event: ' + error.message
    });
  }
});

/**
 * Test session completion endpoint - sends a test session completion event via Socket.IO
 * Used to verify that session completion Socket.IO integration is working correctly
 */
router.get('/test-session-complete', authenticateToken, async (req, res) => {
  try {
    const { sessionId = 'test-session-' + Date.now() } = req.query;
    
    if (global.socketIO) {
      // Send test session completion event
      const sessionCompleteData = {
        sessionId,
        status: 'COMPLETED',
        endTime: new Date().toISOString(),
        totalTables: 3,
        successfulTables: 3,
        failedTables: 0,
        processedRecords: 150,
        results: {
          'Test Table 1': { success: true, processedRecords: 50, totalRecords: 50 },
          'Test Table 2': { success: true, processedRecords: 75, totalRecords: 75 },
          'Test Table 3': { success: true, processedRecords: 25, totalRecords: 25 }
        },
        errors: null
      };
      
      global.socketIO.emit('session-complete', sessionCompleteData);
      console.log('🧪 Test session completion event sent via Socket.IO:', sessionCompleteData.sessionId);
      
      res.json({
        success: true,
        message: 'Session completion test event sent successfully',
        sessionCompleteData
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Socket.IO not available - session completion events cannot be sent'
      });
    }
  } catch (error) {
    console.error('Test session completion error:', error);
    res.status(500).json({
      error: 'Failed to send test session completion event: ' + error.message
    });
  }
});

/**
 * Test debug logging endpoint - sends a test debug message via Socket.IO
 * Used to verify that debug logging integration is working correctly
 */
router.get('/test-debug', authenticateToken, async (req, res) => {
  try {
    const { sessionId = 'test-session' } = req.query;
    
    // Get settings to check debug mode
    const userSettings = await getUserSettings(req.user.id);
    
    // Set global debug mode based on user settings
    global.debugMode = userSettings?.debugMode || false;
    
    if (global.socketIO) {
      // Send test debug message
      const debugData = {
        sessionId,
        level: 'info',
        message: '🧪 Test debug message from backend - Socket.IO integration working!',
        data: { 
          test: true, 
          timestamp: new Date().toISOString(),
          debugMode: global.debugMode 
        },
        timestamp: new Date().toISOString()
      };
      
      // Send to all clients for testing (in real imports, this would be to specific session room)
      global.socketIO.emit('debug-log', debugData);
      console.log('🧪 Test debug message sent via Socket.IO:', debugData.message);
      
      res.json({
        success: true,
        message: 'Debug test message sent successfully',
        debugMode: global.debugMode,
        debugData
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Socket.IO not available - debug messages cannot be sent'
      });
    }
  } catch (error) {
    console.error('Test debug error:', error);
    res.status(500).json({
      error: 'Failed to send test debug message: ' + error.message
    });
  }
});

/**
 * Start import process endpoint
 * Creates import session in database and starts Airtable data import
 * Accepts either legacy format (array of table names) or enhanced format (array of table objects)
 */
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { tableNames, tables, overwrite = false } = req.body;
    const userId = req.user.userId;

    // Support both legacy format (tableNames array) and new format (tables array with metadata)
    let tablesToImport = [];
    let tableMetadata = {};

    if (tables && Array.isArray(tables) && tables.length > 0) {
      // New format: array of table objects with metadata
      tablesToImport = tables.map(table => table.name || table);
      tableMetadata = tables.reduce((acc, table) => {
        if (typeof table === 'object' && table.name) {
          acc[table.name] = {
            id: table.id,
            recordCount: table.recordCount,
            description: table.description
          };
        }
        return acc;
      }, {});
      console.log(`📊 Import starting with table metadata:`, Object.keys(tableMetadata).map(name => 
        `${name} (${tableMetadata[name].recordCount} records)`).join(', '));
    } else if (tableNames && Array.isArray(tableNames) && tableNames.length > 0) {
      // Legacy format: array of table names
      tablesToImport = tableNames;
      console.log(`📋 Import starting with table names:`, tablesToImport.join(', '));
    } else {
      return res.status(400).json({ error: 'Table names array or tables array is required' });
    }

    // Validate we have tables to import
    if (tablesToImport.length === 0) {
      return res.status(400).json({ error: 'At least one table must be specified for import' });
    }

    // Get user settings from database
    const settings = await getUserSettings(userId);
    if (!settings) {
      return res.status(400).json({ error: 'Please configure your settings first' });
    }

    const { airtableApiKey, airtableBaseId, databaseUrl } = settings;

    // Validate required settings (databaseUrl is optional, defaults to SQLite)
    if (!airtableApiKey || !airtableBaseId) {
      return res.status(400).json({ 
        error: 'Missing required settings: Airtable API key or base ID' 
      });
    }

    // Create import session in database using Prisma
    const importSession = await db.createImportSession(userId, tablesToImport);
    const sessionId = importSession.id;

    console.log(`✅ Import session created: ${sessionId} for user ${req.user.email} with ${tablesToImport.length} tables`);

    // Start import process asynchronously
    (async () => {
      try {
        // Update session status to running
        await db.updateImportSession(sessionId, { 
          status: 'RUNNING'
        });

        // Initialize debug mode from user settings
        global.debugMode = settings.debugMode || false;
        
        // Create and configure import service
        const importService = new ImportService();
        
        console.log(`🔍 Import service connection parameters:`, {
          hasApiKey: !!airtableApiKey,
          apiKeyLength: airtableApiKey ? airtableApiKey.length : 0,
          hasBaseId: !!airtableBaseId,
          baseId: airtableBaseId,
          hasDatabaseUrl: !!databaseUrl,
          databaseUrl: databaseUrl ? databaseUrl.substring(0, 20) + '...' : null,
          debugMode: global.debugMode
        });
        
        await importService.connect(airtableApiKey, airtableBaseId, databaseUrl);
        
        // Import all tables and get results
        console.log(`🚀 Starting importMultipleTables for session ${sessionId} with tables:`, tablesToImport);
        if (global.debugMode) {
          console.log(`🐛 [DEBUG] Import parameters:`, { 
            sessionId, 
            tableCount: tablesToImport.length, 
            overwrite, 
            debugMode: global.debugMode 
          });
        }
        
        const results = await importService.importMultipleTables(tablesToImport, sessionId, { overwrite });
        
        console.log(`✅ importMultipleTables completed for session ${sessionId}. Results:`, results.length);
        if (global.debugMode) {
          console.log(`🐛 [DEBUG] Import results summary:`, results.map(r => ({
            table: r.tableName,
            success: r.success,
            processed: r.processedRecords,
            total: r.totalRecords,
            mode: r.mode,
            error: r.error
          })));
        }
        
        // Calculate success metrics from results array
        const successfulImports = results.filter(r => r.success);
        const failedImports = results.filter(r => !r.success);
        
        // Calculate totals across all tables
        const totalRecordsProcessed = successfulImports.reduce((sum, r) => sum + (r.processedRecords || 0), 0);
        const totalRecordsSkipped = successfulImports.reduce((sum, r) => sum + (r.skippedRecords || 0), 0);
        const totalRecordsAttempted = results.reduce((sum, r) => sum + (r.totalRecords || 0), 0);
        
        // Create per-table results structure
        const tableResults = {};
        results.forEach(result => {
          tableResults[result.tableName] = {
            tableName: result.tableName,
            success: result.success,
            mode: result.mode,
            processedRecords: result.processedRecords || 0,
            updatedRecords: result.updatedRecords || 0,
            skippedRecords: result.skippedRecords || 0,
            totalRecords: result.totalRecords || 0,
            error: result.error || null
          };
        });
        
        // Determine final status: successful if no failures, even if nothing was processed
        const finalStatus = failedImports.length === 0 ? 'COMPLETED' : 
                           (successfulImports.length > 0 ? 'PARTIAL_FAILED' : 'FAILED');
        
        // Update session with completion status and detailed results
        await db.updateImportSession(sessionId, {
          status: finalStatus,
          endTime: new Date(),
          processedRecords: totalRecordsProcessed,
          results: JSON.stringify(tableResults), // Store per-table results
          errorMessage: failedImports.length > 0 ? JSON.stringify(failedImports.map(f => f.error)) : null
        });

        // Emit session completion event to frontend via Socket.IO
        if (global.socketIO) {
          const sessionCompleteData = {
            sessionId,
            status: finalStatus,
            endTime: new Date().toISOString(),
            totalTables: tablesToImport.length,
            successfulTables: successfulImports.length,
            failedTables: failedImports.length,
            processedRecords: totalRecordsProcessed,
            results: tableResults,
            errors: failedImports.length > 0 ? failedImports.map(f => ({ table: f.table, error: f.error })) : null
          };
          
          global.socketIO.to(`progress-${sessionId}`).emit('session-complete', sessionCompleteData);
          console.log(`🔄 Session completion event emitted for session ${sessionId}:`, {
            status: finalStatus,
            successful: successfulImports.length,
            failed: failedImports.length
          });
        }

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

        // Emit session failure event to frontend via Socket.IO
        if (global.socketIO) {
          const sessionFailedData = {
            sessionId,
            status: 'FAILED',
            endTime: new Date().toISOString(),
            totalTables: tablesToImport.length,
            successfulTables: 0,
            failedTables: tablesToImport.length,
            processedRecords: 0,
            error: error.message
          };
          
          global.socketIO.to(`progress-${sessionId}`).emit('session-complete', sessionFailedData);
          console.log(`🔄 Session failure event emitted for session ${sessionId}:`, error.message);
        }
      }
    })();

    res.json({
      sessionId,
      message: 'Import started successfully',
      tableNames: tablesToImport,
      overwrite,
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

    // Add per-table results if available
    if (session.results) {
      responseData.results = typeof session.results === 'string' 
        ? JSON.parse(session.results) 
        : session.results;
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
    const formattedSessions = sessions.map(session => {
      const baseSession = {
        sessionId: session.id,
        status: session.status,
        startTime: session.createdAt,
        startedAt: session.startedAt,
        endTime: session.endTime,
        tableNames: session.tableNames,
        totalTables: session.totalTables,
        processedRecords: session.processedRecords || 0,
        importedTablesCount: session.importedTables?.length || 0
      };

      // Add per-table results if available
      if (session.results) {
        baseSession.results = typeof session.results === 'string' 
          ? JSON.parse(session.results) 
          : session.results;
      }

      // Add error message if present
      if (session.errorMessage) {
        baseSession.error = session.errorMessage;
      }

      return baseSession;
    });

    res.json(formattedSessions);
  } catch (error) {
    console.error('❌ Error listing import sessions:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Discover tables endpoint
 * Fetches all available tables from Airtable base with record counts
 * Uses Metadata API for table discovery and data API for record counting
 */
router.get('/discover-tables', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user settings from database
    const settings = await getUserSettings(userId);
    if (!settings) {
      return res.status(400).json({ error: 'Please configure your settings first' });
    }

    const { airtableApiKey, airtableBaseId } = settings;

    // Validate required Airtable settings
    if (!airtableApiKey || !airtableBaseId) {
      return res.status(400).json({ 
        error: 'Airtable API key and Base ID are required for table discovery' 
      });
    }

    // Create AirtableService instance
    const AirtableService = require('../services/airtable');
    const airtableService = new AirtableService();

    // Connect to Airtable base
    await airtableService.connect(airtableApiKey, airtableBaseId);

    // Discover tables with record counts
    console.log(`Discovering tables for user ${userId} in base ${airtableBaseId}...`);
    const tablesWithCounts = await airtableService.discoverTablesWithCounts();

    console.log(`✅ Successfully discovered ${tablesWithCounts.length} tables`);

    // Return success response with table information
    res.json({
      success: true,
      tables: tablesWithCounts,
      message: `Found ${tablesWithCounts.length} table(s) in your Airtable base`
    });

  } catch (error) {
    console.error('Error discovering tables:', error.message);
    
    // Return error response with appropriate status code
    const statusCode = error.message.includes('authentication') ? 401 :
                      error.message.includes('not found') ? 404 :
                      error.message.includes('Access denied') ? 403 : 500;
    
    res.status(statusCode).json({ 
      error: error.message,
      success: false 
    });
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
 * Retry failed table import endpoint
 * Retries importing a specific table from a previous import session
 */
router.post('/retry-table', authenticateToken, async (req, res) => {
  try {
    const { sessionId, tableName } = req.body;
    const userId = req.user.userId;

    // Validate input parameters
    if (!sessionId || !tableName) {
      return res.status(400).json({ error: 'Session ID and table name are required' });
    }

    // Get original session from database to verify ownership and get settings
    const originalSession = await db.getImportSession(sessionId);
    if (!originalSession) {
      return res.status(404).json({ error: 'Original session not found' });
    }

    // Verify user owns this session
    if (originalSession.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get user settings for connection details
    const settings = await getUserSettings(userId);
    if (!settings) {
      return res.status(400).json({ error: 'Please configure your settings first' });
    }

    const { airtableApiKey, airtableBaseId, databaseUrl } = settings;

    // Validate required settings
    if (!airtableApiKey || !airtableBaseId) {
      return res.status(400).json({ 
        error: 'Missing required settings: Airtable API key or base ID' 
      });
    }

    // Create a new import session for the retry
    const retrySession = await db.createImportSession(userId, [tableName]);
    const retrySessionId = retrySession.id;

    console.log(`🔄 Table retry session created: ${retrySessionId} for table ${tableName} (original session: ${sessionId})`);

    // Start retry process asynchronously
    (async () => {
      try {
        // Update retry session status to running
        await db.updateImportSession(retrySessionId, { 
          status: 'RUNNING'
        });

        // Initialize debug mode from user settings
        global.debugMode = settings.debugMode || false;
        
        // Create and configure import service
        const importService = new ImportService();
        await importService.connect(airtableApiKey, airtableBaseId, databaseUrl);
        
        console.log(`🚀 Starting table retry for ${tableName} in session ${retrySessionId}`);
        
        // Import the single table with overwrite=true to handle retry logic
        const results = await importService.importMultipleTables([tableName], retrySessionId, { overwrite: true });
        
        console.log(`✅ Table retry completed for ${tableName}. Results:`, results);
        
        // Process results (should be a single table result)
        const tableResult = results[0];
        const success = tableResult && tableResult.success;
        
        // Calculate metrics
        const processedRecords = tableResult ? (tableResult.processedRecords || 0) : 0;
        
        // Create table results structure
        const tableResults = {};
        if (tableResult) {
          tableResults[tableResult.tableName] = {
            tableName: tableResult.tableName,
            success: tableResult.success,
            mode: tableResult.mode,
            processedRecords: tableResult.processedRecords || 0,
            updatedRecords: tableResult.updatedRecords || 0,
            skippedRecords: tableResult.skippedRecords || 0,
            totalRecords: tableResult.totalRecords || 0,
            error: tableResult.error || null
          };
        }
        
        // Determine final status
        const finalStatus = success ? 'COMPLETED' : 'FAILED';
        
        // Update retry session with completion status
        await db.updateImportSession(retrySessionId, {
          status: finalStatus,
          endTime: new Date(),
          processedRecords,
          results: JSON.stringify(tableResults),
          errorMessage: success ? null : (tableResult?.error || 'Unknown error during retry')
        });

        // Emit session completion event to frontend via Socket.IO
        if (global.socketIO) {
          const sessionCompleteData = {
            sessionId: retrySessionId,
            status: finalStatus,
            endTime: new Date().toISOString(),
            totalTables: 1,
            successfulTables: success ? 1 : 0,
            failedTables: success ? 0 : 1,
            processedRecords,
            results: tableResults,
            retryOf: sessionId, // Indicate this is a retry of another session
            retryTable: tableName,
            errors: success ? null : [{ table: tableName, error: tableResult?.error || 'Unknown error' }]
          };
          
          global.socketIO.to(`progress-${retrySessionId}`).emit('session-complete', sessionCompleteData);
          console.log(`🔄 Table retry completion event emitted for session ${retrySessionId}:`, finalStatus);
        }

        console.log(`✅ Table retry session completed: ${retrySessionId} (${finalStatus})`);
        await importService.disconnect();
        
      } catch (error) {
        console.error(`❌ Table retry session failed: ${retrySessionId}`, error.message);
        
        // Update retry session with error status
        await db.updateImportSession(retrySessionId, {
          status: 'FAILED',
          endTime: new Date(),
          errorMessage: error.message
        });

        // Emit session failure event to frontend via Socket.IO
        if (global.socketIO) {
          const sessionFailedData = {
            sessionId: retrySessionId,
            status: 'FAILED',
            endTime: new Date().toISOString(),
            totalTables: 1,
            successfulTables: 0,
            failedTables: 1,
            processedRecords: 0,
            error: error.message,
            retryOf: sessionId,
            retryTable: tableName
          };
          
          global.socketIO.to(`progress-${retrySessionId}`).emit('session-complete', sessionFailedData);
          console.log(`🔄 Table retry failure event emitted for session ${retrySessionId}:`, error.message);
        }
      }
    })();

    res.json({
      retrySessionId,
      originalSessionId: sessionId,
      tableName,
      message: 'Table retry started successfully',
      status: 'PENDING'
    });
    
  } catch (error) {
    console.error('❌ Error starting table retry:', error.message);
    res.status(500).json({ error: 'Failed to start table retry: ' + error.message });
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