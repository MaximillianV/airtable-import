/**
 * Staged Import Workflow Routes
 * 
 * Breaks down the full import workflow into separate API endpoints for easier debugging:
 * 1. POST /staged-workflow/connect - Connect to Airtable and import database
 * 2. POST /staged-workflow/discover-schema - Discover Airtable schema
 * 3. POST /staged-workflow/create-structure - Create database tables and ENUMs
 * 4. POST /staged-workflow/import-data - Import all data with batch processing
 * 5. POST /staged-workflow/analyze-relationships - Analyze relationships
 * 6. POST /staged-workflow/apply-enhancements - Apply foreign keys and constraints
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const FullImportWorkflowService = require('../services/fullImportWorkflow');
const DatabaseService = require('../services/database');

const router = express.Router();

// Initialize main app database service
const appDb = new DatabaseService();

// Shared workflow state (in production, this could be stored in Redis)
const workflowState = new Map();

/**
 * Debug endpoint: Execute SQL queries directly on import database
 */
router.post('/debug-sql', authenticateToken, async (req, res) => {
  try {
    const { sql, params = [] } = req.body;
    console.log('🐛 Debug SQL:', sql);
    
    // Get user settings
    const { getUserSettings } = require('./settings');
    const settings = await getUserSettings(req.user.userId);
    
    if (!settings.databaseUrl) {
      return res.status(400).json({ 
        error: 'Database URL is required for SQL debugging' 
      });
    }

    // Connect to import database
    const ImportDatabaseService = require('../services/importDatabase');
    const importDb = new ImportDatabaseService();
    await importDb.connect(settings.databaseUrl, settings.airtableBaseId);
    
    // Execute the SQL
    const result = await importDb.executeSQL(sql, params);
    await importDb.disconnect();
    
    res.json({
      success: true,
      data: Array.isArray(result) ? result : result.rows || [],
      rowCount: Array.isArray(result) ? result.length : result.rowCount || 0
    });
    
  } catch (error) {
    console.error('❌ Debug SQL failed:', error.message);
    res.status(500).json({ 
      error: `Debug SQL failed: ${error.message}` 
    });
  }
});

/**
 * Stage 1: Connect to services and establish connections
 */
router.post('/connect', authenticateToken, async (req, res) => {
  try {
    console.log('🔗 Stage 1: Connecting to Airtable and import database...');
    
    // Get user settings
    const { getUserSettings } = require('./settings');
    const settings = await getUserSettings(req.user.userId);
    
    if (!settings.airtableApiKey || !settings.airtableBaseId || !settings.databaseUrl) {
      return res.status(400).json({ 
        error: 'Missing required settings: Airtable API key, Base ID, and database URL are required' 
      });
    }

    // Create workflow service and establish connections
    const workflowService = new FullImportWorkflowService(appDb);
    const sessionId = `staged-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Test connections
    await workflowService.airtableService.connect(settings.airtableApiKey, settings.airtableBaseId);
    
    const ImportDatabaseService = require('../services/importDatabase');
    workflowService.importDb = new ImportDatabaseService();
    await workflowService.importDb.connect(settings.databaseUrl, settings.airtableBaseId);
    
    // Store workflow state
    workflowState.set(sessionId, {
      workflowService,
      settings,
      stage: 'connected',
      createdAt: new Date().toISOString()
    });

    console.log(`✅ Stage 1 complete: Connected to Airtable and import database`);
    res.json({
      success: true,
      sessionId,
      stage: 'connected',
      message: 'Successfully connected to Airtable and import database',
      data: {
        airtableBaseId: settings.airtableBaseId,
        importDbLocation: workflowService.importDb.location || `${workflowService.importDb.dbType} database`,
        importDbType: workflowService.importDb.dbType,
        connectionEstablished: true
      }
    });
    
  } catch (error) {
    console.error('❌ Stage 1 failed:', error.message);
    res.status(500).json({ 
      error: `Connection stage failed: ${error.message}`,
      stage: 'connect'
    });
  }
});

/**
 * Stage 2: Discover Airtable schema
 */
router.post('/discover-schema', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    console.log(`🔍 Stage 2: Discovering schema for session ${sessionId}...`);
    
    if (!sessionId || !workflowState.has(sessionId)) {
      return res.status(400).json({ 
        error: 'Invalid or expired session ID. Please run connect stage first.' 
      });
    }

    const { workflowService } = workflowState.get(sessionId);
    
    // Discover schema
    const schemaDiscovery = await workflowService.discoverAirtableSchema();
    
    // Update workflow state
    const state = workflowState.get(sessionId);
    state.schemaDiscovery = schemaDiscovery;
    state.stage = 'schema-discovered';
    workflowState.set(sessionId, state);

    console.log(`✅ Stage 2 complete: Discovered ${schemaDiscovery.tables.length} tables`);
    res.json({
      success: true,
      sessionId,
      stage: 'schema-discovered',
      message: `Schema discovery complete: ${schemaDiscovery.tables.length} tables found`,
      data: {
        tablesFound: schemaDiscovery.tables.length,
        fieldTypes: Array.from(schemaDiscovery.fieldTypes),
        tables: schemaDiscovery.tables.map(t => ({
          name: t.name,
          fieldCount: t.fields.length,
          enumCandidates: t.enumCandidates.length,
          recordCount: t.recordCount
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Stage 2 failed:', error.message);
    res.status(500).json({ 
      error: `Schema discovery failed: ${error.message}`,
      stage: 'discover-schema'
    });
  }
});

/**
 * Stage 3: Create database structure (tables and ENUMs)
 */
router.post('/create-structure', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    console.log(`🏗️ Stage 3: Creating database structure for session ${sessionId}...`);
    
    if (!sessionId || !workflowState.has(sessionId)) {
      return res.status(400).json({ 
        error: 'Invalid or expired session ID. Please run previous stages first.' 
      });
    }

    const state = workflowState.get(sessionId);
    if (!state.schemaDiscovery) {
      return res.status(400).json({ 
        error: 'Schema discovery not completed. Please run discover-schema stage first.' 
      });
    }

    const { workflowService, schemaDiscovery } = state;
    
    // Create database structure
    const databaseCreation = await workflowService.createDatabaseStructure(schemaDiscovery);
    
    // Update workflow state
    state.databaseCreation = databaseCreation;
    state.stage = 'structure-created';
    workflowState.set(sessionId, state);

    console.log(`✅ Stage 3 complete: Created ${databaseCreation.tablesCreated} tables, ${databaseCreation.enumsCreated} ENUMs`);
    res.json({
      success: true,
      sessionId,
      stage: 'structure-created',
      message: `Database structure created: ${databaseCreation.tablesCreated} tables, ${databaseCreation.enumsCreated} ENUMs`,
      data: {
        tablesCreated: databaseCreation.tablesCreated,
        enumsCreated: databaseCreation.enumsCreated,
        createdTables: databaseCreation.createdTables
      }
    });
    
  } catch (error) {
    console.error('❌ Stage 3 failed:', error.message);
    res.status(500).json({ 
      error: `Database structure creation failed: ${error.message}`,
      stage: 'create-structure'
    });
  }
});

/**
 * Stage 4: Import all data with batch processing
 */
router.post('/import-data', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    console.log(`📥 Stage 4: Importing data for session ${sessionId}...`);
    
    if (!sessionId || !workflowState.has(sessionId)) {
      return res.status(400).json({ 
        error: 'Invalid or expired session ID. Please run previous stages first.' 
      });
    }

    const state = workflowState.get(sessionId);
    if (!state.databaseCreation) {
      return res.status(400).json({ 
        error: 'Database structure not created. Please run create-structure stage first.' 
      });
    }

    const { workflowService, schemaDiscovery } = state;
    
    // Import all data
    const importResults = await workflowService.importAllData(schemaDiscovery.tables);
    
    // Update workflow state
    state.importResults = importResults;
    state.stage = 'data-imported';
    workflowState.set(sessionId, state);

    console.log(`✅ Stage 4 complete: Imported ${importResults.totalRecords} records`);
    res.json({
      success: true,
      sessionId,
      stage: 'data-imported',
      message: `Data import complete: ${importResults.totalRecords} records imported`,
      data: {
        totalRecords: importResults.totalRecords,
        importedTables: importResults.importedTables,
        avgRecordsPerSecond: importResults.avgRecordsPerSecond,
        tableResults: importResults.tableResults
      }
    });
    
  } catch (error) {
    console.error('❌ Stage 4 failed:', error.message);
    res.status(500).json({ 
      error: `Data import failed: ${error.message}`,
      stage: 'import-data'
    });
  }
});

/**
 * Stage 5: Analyze relationships
 */
router.post('/analyze-relationships', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    console.log(`🧠 Stage 5: Analyzing relationships for session ${sessionId}...`);
    
    if (!sessionId || !workflowState.has(sessionId)) {
      return res.status(400).json({ 
        error: 'Invalid or expired session ID. Please run previous stages first.' 
      });
    }

    const state = workflowState.get(sessionId);
    if (!state.importResults) {
      return res.status(400).json({ 
        error: 'Data import not completed. Please run import-data stage first.' 
      });
    }

    const { workflowService, schemaDiscovery } = state;
    
    // Analyze relationships
    const relationshipAnalysis = await workflowService.analyzeRelationshipsFromDB(schemaDiscovery.tables);
    
    // Update workflow state
    state.relationshipAnalysis = relationshipAnalysis;
    state.stage = 'relationships-analyzed';
    workflowState.set(sessionId, state);

    console.log(`✅ Stage 5 complete: Found ${relationshipAnalysis.relationships.length} relationships`);
    res.json({
      success: true,
      sessionId,
      stage: 'relationships-analyzed',
      message: `Relationship analysis complete: ${relationshipAnalysis.relationships.length} relationships found`,
      data: {
        relationshipsFound: relationshipAnalysis.relationships.length,
        relationships: relationshipAnalysis.relationships,
        analysis: relationshipAnalysis.analysis
      }
    });
    
  } catch (error) {
    console.error('❌ Stage 5 failed:', error.message);
    res.status(500).json({ 
      error: `Relationship analysis failed: ${error.message}`,
      stage: 'analyze-relationships'
    });
  }
});

/**
 * Stage 6: Apply schema enhancements (foreign keys, constraints)
 */
router.post('/apply-enhancements', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    console.log(`⚡ Stage 6: Applying schema enhancements for session ${sessionId}...`);
    
    if (!sessionId || !workflowState.has(sessionId)) {
      return res.status(400).json({ 
        error: 'Invalid or expired session ID. Please run previous stages first.' 
      });
    }

    const state = workflowState.get(sessionId);
    if (!state.relationshipAnalysis) {
      return res.status(400).json({ 
        error: 'Relationship analysis not completed. Please run analyze-relationships stage first.' 
      });
    }

    const { workflowService, relationshipAnalysis } = state;
    
    // Apply schema enhancements
    const schemaEnhancements = await workflowService.applySchemaEnhancements(relationshipAnalysis);
    
    // Update workflow state
    state.schemaEnhancements = schemaEnhancements;
    state.stage = 'completed';
    workflowState.set(sessionId, state);

    console.log(`✅ Stage 6 complete: Applied ${schemaEnhancements.foreignKeysCreated} foreign keys, ${schemaEnhancements.junctionTablesCreated} junction tables`);
    res.json({
      success: true,
      sessionId,
      stage: 'completed',
      message: `Schema enhancements complete: ${schemaEnhancements.foreignKeysCreated} foreign keys, ${schemaEnhancements.junctionTablesCreated} junction tables`,
      data: {
        foreignKeysCreated: schemaEnhancements.foreignKeysCreated,
        junctionTablesCreated: schemaEnhancements.junctionTablesCreated,
        constraintsAdded: schemaEnhancements.constraintsAdded,
        enhancements: schemaEnhancements.enhancements
      }
    });
    
  } catch (error) {
    console.error('❌ Stage 6 failed:', error.message);
    res.status(500).json({ 
      error: `Schema enhancements failed: ${error.message}`,
      stage: 'apply-enhancements'
    });
  }
});

/**
 * Get workflow session status
 */
router.get('/status/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!workflowState.has(sessionId)) {
      return res.status(404).json({ 
        error: 'Session not found' 
      });
    }

    const state = workflowState.get(sessionId);
    
    res.json({
      success: true,
      sessionId,
      stage: state.stage,
      createdAt: state.createdAt,
      hasSchemaDiscovery: !!state.schemaDiscovery,
      hasDatabaseCreation: !!state.databaseCreation,
      hasImportResults: !!state.importResults,
      hasRelationshipAnalysis: !!state.relationshipAnalysis,
      hasSchemaEnhancements: !!state.schemaEnhancements
    });
    
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    res.status(500).json({ 
      error: `Status check failed: ${error.message}` 
    });
  }
});

/**
 * Clean up workflow session
 */
router.delete('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (workflowState.has(sessionId)) {
      const state = workflowState.get(sessionId);
      // Disconnect any open database connections
      if (state.workflowService && state.workflowService.importDb) {
        await state.workflowService.importDb.disconnect();
      }
      workflowState.delete(sessionId);
    }
    
    res.json({
      success: true,
      message: 'Workflow session cleaned up'
    });
    
  } catch (error) {
    console.error('❌ Session cleanup failed:', error.message);
    res.status(500).json({ 
      error: `Session cleanup failed: ${error.message}` 
    });
  }
});

module.exports = router;