/**
 * V2 Import API Routes
 * 
 * New type-aware import system with relationship analysis and manual approval.
 * 
 * Endpoints:
 * - POST /v2-import/phase1-create-schema - Create database schema with proper types
 * - POST /v2-import/phase2-import-data - Import raw data with transformations
 * - POST /v2-import/analyze-relationships - Analyze relationships and generate proposal report
 * - GET /v2-import/analysis/:analysisId - Get relationship analysis results
 * - POST /v2-import/apply-approved-relationships - Apply user-approved relationships (Phase 3)
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const V2ImportService = require('../services/V2ImportService');
const CardinalityRelationshipAnalyzer = require('../services/CardinalityRelationshipAnalyzer');
const ImportDatabaseService = require('../services/importDatabase');

const router = express.Router();

// Cache for import sessions
const importSessionCache = new Map();

/**
 * Discover available tables in Airtable base
 */
router.get('/discover-tables', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 V2: Discovering available tables...');
    
    // Get settings from environment variables
    const { getSettingsFromEnv } = require('../utils/envSettings');
    const settings = getSettingsFromEnv();
    
    if (!settings.airtableApiKey || !settings.airtableBaseId) {
      return res.status(400).json({ 
        error: 'Missing Airtable settings: API key and Base ID are required' 
      });
    }

    // Use the existing AirtableService to discover tables
    const AirtableService = require('../services/airtable');
    const airtableService = new AirtableService();
    airtableService.connect(settings.airtableApiKey, settings.airtableBaseId);
    
    // Get tables with record counts
    const tables = await airtableService.discoverTablesWithCounts();
    
    console.log(`✅ Discovered ${tables.length} tables`);

    res.json({
      success: true,
      tables: tables.map(table => ({
        id: table.id,
        name: table.name,
        recordCount: table.recordCount,
        description: table.description
      })),
      message: `Found ${tables.length} tables in your Airtable base`
    });
    
  } catch (error) {
    console.error('❌ Table discovery failed:', error.message);
    res.status(500).json({ 
      error: `Table discovery failed: ${error.message}`,
      details: error.stack
    });
  }
});

/**
 * Phase 1: Create database schema with proper field types
 */
router.post('/phase1-create-schema', authenticateToken, async (req, res) => {
  try {
    console.log('🚀 V2 Phase 1: Creating type-aware schema...');
    
    // Get settings from environment variables
    const { getSettingsFromEnv } = require('../utils/envSettings');
    const settings = getSettingsFromEnv();
    
    if (!settings.airtableApiKey || !settings.airtableBaseId || !settings.databaseUrl) {
      return res.status(400).json({ 
        error: 'Missing required settings: Airtable API key, Base ID, and database URL are required' 
      });
    }

    // Initialize the V2 import service (extends proven ImportService)
    const importService = new V2ImportService();
    
    // Generate session ID
    const sessionId = `v2-import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Execute Phase 1 with session ID and optional table selection
    const { selectedTables } = req.body; // Allow frontend to specify which tables to import
    const result = await importService.phase1CreateSchema(
      settings.airtableApiKey,
      settings.airtableBaseId,
      settings.databaseUrl,
      sessionId,
      selectedTables
    );

    // Cache the import service for subsequent phases
    importSessionCache.set(sessionId, {
      importService,
      phase: 'schema-created',
      createdAt: new Date().toISOString(),
      userId: req.user.userId
    });

    console.log('✅ V2 Phase 1 complete');

    res.json({
      success: true,
      sessionId,
      phase: 'schema-created',
      message: 'Type-aware database schema created successfully',
      tablesProcessed: result.tablesProcessed,
      tablesCreated: result.tablesCreated,
      data: result
    });
    
  } catch (error) {
    console.error('❌ V2 Phase 1 failed:', error.message);
    res.status(500).json({ 
      error: `Phase 1 schema creation failed: ${error.message}`,
      details: error.stack
    });
  }
});

/**
 * Phase 2: Import raw data with proper type transformations
 */
router.post('/phase2-import-data', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    console.log(`🚀 V2 Phase 2: Importing data for session ${sessionId}...`);
    
    if (!sessionId || !importSessionCache.has(sessionId)) {
      return res.status(400).json({ 
        error: 'Invalid session ID. Please run Phase 1 first.' 
      });
    }

    const session = importSessionCache.get(sessionId);
    if (session.phase !== 'schema-created') {
      return res.status(400).json({ 
        error: `Session is at phase '${session.phase}', expected 'schema-created'` 
      });
    }

    // Execute Phase 2 with session ID
    const result = await session.importService.phase2ImportData(sessionId);

    // Update session
    session.phase = 'data-imported';
    session.importResults = result.results;
    importSessionCache.set(sessionId, session);

    console.log('✅ V2 Phase 2 complete');

    res.json({
      success: true,
      sessionId,
      phase: 'data-imported',
      message: `Data import complete: ${result.totalRecords} records imported`,
      tablesImported: result.tablesImported,
      totalRecords: result.totalRecords,
      results: result.results
    });
    
  } catch (error) {
    console.error('❌ V2 Phase 2 failed:', error.message);
    res.status(500).json({ 
      error: `Phase 2 data import failed: ${error.message}` 
    });
  }
});

/**
 * Analyze relationships and generate proposal report
 */
router.post('/analyze-relationships', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    console.log(`🔍 V2 Relationship Analysis for session ${sessionId}...`);
    
    if (!sessionId || !importSessionCache.has(sessionId)) {
      return res.status(400).json({ 
        error: 'Invalid session ID. Please complete import phases first.' 
      });
    }

    const session = importSessionCache.get(sessionId);
    if (session.phase !== 'data-imported') {
      return res.status(400).json({ 
        error: `Session is at phase '${session.phase}', expected 'data-imported'` 
      });
    }

    // Get database connection from import service
    const importService = session.importService;
    const importMetadata = importService.getSessionMetadata(sessionId);

    // Connect to the import database for analysis
    const { getSettingsFromEnv } = require('../utils/envSettings');
    const settings = getSettingsFromEnv();
    
    const importDb = new ImportDatabaseService();
    await importDb.connect(settings.databaseUrl, settings.airtableBaseId);

    // Run cardinality-based relationship analysis (enhanced approach)
    const analyzer = new CardinalityRelationshipAnalyzer();
    const analysisReport = await analyzer.analyzeRelationships(importDb, importMetadata);

    await importDb.disconnect();

    // Update session with analysis results
    session.phase = 'relationships-analyzed';
    session.analysisReport = analysisReport;
    importSessionCache.set(sessionId, session);

    console.log('✅ V2 Relationship Analysis complete');

    res.json({
      success: true,
      sessionId,
      phase: 'relationships-analyzed',
      message: `Relationship analysis complete: ${analysisReport.summary.relationshipsDetected} relationships detected`,
      data: {
        analysisId: analysisReport.analysisId,
        summary: analysisReport.summary,
        relationships: analysisReport.relationships,
        reviewRequired: analysisReport.relationships.filter(r => r.reviewRequired).length,
        confidenceBreakdown: {
          high: analysisReport.relationships.filter(r => r.confidence >= 0.8).length,
          medium: analysisReport.relationships.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length,
          low: analysisReport.relationships.filter(r => r.confidence < 0.6).length
        }
      }
    });
    
  } catch (error) {
    console.error('❌ V2 Relationship Analysis failed:', error.message);
    res.status(500).json({ 
      error: `Relationship analysis failed: ${error.message}` 
    });
  }
});

/**
 * Get relationship analysis results
 */
router.get('/analysis/:analysisId', authenticateToken, async (req, res) => {
  try {
    const { analysisId } = req.params;
    
    // Find session with this analysis ID
    let targetSession = null;
    for (const [sessionId, session] of importSessionCache) {
      if (session.analysisReport && session.analysisReport.analysisId === analysisId) {
        targetSession = session;
        break;
      }
    }
    
    if (!targetSession) {
      return res.status(404).json({ 
        error: 'Analysis not found' 
      });
    }

    res.json({
      success: true,
      analysisId,
      data: targetSession.analysisReport
    });
    
  } catch (error) {
    console.error('❌ Get analysis failed:', error.message);
    res.status(500).json({ 
      error: `Get analysis failed: ${error.message}` 
    });
  }
});

/**
 * Get import session status
 */
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!importSessionCache.has(sessionId)) {
      return res.status(404).json({ 
        error: 'Import session not found' 
      });
    }

    const session = importSessionCache.get(sessionId);
    
    res.json({
      success: true,
      sessionId,
      phase: session.phase,
      createdAt: session.createdAt,
      progress: {
        schemaCreated: ['schema-created', 'data-imported', 'relationships-analyzed', 'completed'].includes(session.phase),
        dataImported: ['data-imported', 'relationships-analyzed', 'completed'].includes(session.phase),
        relationshipsAnalyzed: ['relationships-analyzed', 'completed'].includes(session.phase),
        completed: session.phase === 'completed'
      },
      summary: this.getSessionSummary(session)
    });
    
  } catch (error) {
    console.error('❌ Session status failed:', error.message);
    res.status(500).json({ 
      error: `Session status failed: ${error.message}` 
    });
  }
});

/**
 * Helper function to generate session summary
 */
function getSessionSummary(session) {
  const summary = { phase: session.phase };
  
  if (session.importService) {
    const metadata = session.importService.getImportMetadata();
    if (metadata) {
      summary.tables = metadata.totalTables;
      summary.fields = metadata.totalFields;
    }
  }
  
  if (session.importResults) {
    summary.recordsImported = session.importResults.totalRecords;
  }
  
  if (session.analysisReport) {
    summary.relationshipsDetected = session.analysisReport.summary.relationshipsDetected;
  }
  
  return summary;
}

/**
 * Placeholder for Phase 3: Apply approved relationships
 * This will be implemented in the Schema Applier
 */
router.post('/apply-approved-relationships', authenticateToken, async (req, res) => {
  res.status(501).json({
    error: 'Phase 3 (Apply Approved Relationships) not yet implemented',
    message: 'This endpoint will be implemented in the Schema Applier module'
  });
});

module.exports = router;