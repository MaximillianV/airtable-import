/**
 * Enhanced Relationship Analysis API Endpoint
 * 
 * Provides a separate endpoint for the new database-first relationship analysis
 * that uses the complete imported dataset instead of limited samples.
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const DatabaseFirstRelationshipAnalyzer = require('../services/databaseFirstRelationshipAnalyzer');
const ImportDatabaseService = require('../services/importDatabase');

const router = express.Router();

/**
 * Analyze relationships using complete database dataset
 * This endpoint runs independently of the import workflow
 */
router.post('/analyze-complete', authenticateToken, async (req, res) => {
  try {
    console.log('🧠 Starting enhanced relationship analysis...');
    
    // Get user settings for database connection
    const { getUserSettings } = require('./settings');
    const settings = await getUserSettings(req.user.userId);
    
    if (!settings.databaseUrl || !settings.airtableBaseId) {
      return res.status(400).json({ 
        error: 'Database URL and Airtable Base ID are required for relationship analysis' 
      });
    }

    // Connect to import database
    const importDb = new ImportDatabaseService();
    await importDb.connect(settings.databaseUrl, settings.airtableBaseId);
    
    console.log(`✅ Connected to import database: ${importDb.location}`);

    // Get table information from database
    const tablesQuery = `
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      ORDER BY table_name
    `;
    
    const tableResults = await importDb.executeSQL(tablesQuery);
    
    // Handle different return formats from executeSQL
    const tableRows = Array.isArray(tableResults) ? tableResults : tableResults.rows || [];
    
    // Convert to table metadata format expected by analyzer
    const tables = tableRows.map(row => ({
      name: row.table_name,
      id: row.table_name, // Use table name as ID for this analysis
      fields: [] // We'll get field info from the database directly
    }));

    console.log(`📊 Found ${tables.length} tables for analysis`);

    // Create enhanced analyzer
    const analyzer = new DatabaseFirstRelationshipAnalyzer(importDb);
    
    // Run comprehensive analysis
    const analysisResults = await analyzer.analyzeAllRelationships(tables, (progress) => {
      // Log progress updates
      console.log(`[${progress.status.toUpperCase()}] ${progress.message}`);
    });

    // Disconnect from database
    await importDb.disconnect();

    console.log(`✅ Analysis complete: ${analysisResults.relationships.length} relationships found`);

    res.json({
      success: true,
      message: `Enhanced relationship analysis complete: ${analysisResults.relationships.length} relationships found`,
      data: {
        relationships: analysisResults.relationships,
        statistics: analysisResults.statistics,
        metadata: analysisResults.metadata,
        summary: {
          totalRelationships: analysisResults.relationships.length,
          highConfidenceRelationships: analysisResults.relationships.filter(r => r.confidence >= 0.8).length,
          mediumConfidenceRelationships: analysisResults.relationships.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length,
          lowConfidenceRelationships: analysisResults.relationships.filter(r => r.confidence < 0.6).length,
          analysisSources: [...new Set(analysisResults.relationships.map(r => r.source))],
          relationshipTypes: [...new Set(analysisResults.relationships.map(r => r.relationshipType))]
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Enhanced relationship analysis failed:', error.message);
    res.status(500).json({ 
      error: `Enhanced relationship analysis failed: ${error.message}`,
      details: error.stack
    });
  }
});

/**
 * Get relationship analysis status and cached results
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Enhanced relationship analyzer is available',
      features: [
        'Complete dataset analysis (no sampling limits)',
        'Database-native statistical functions',
        'Referential integrity analysis',
        'Advanced pattern recognition',
        'Comprehensive confidence scoring'
      ],
      capabilities: {
        maxRecords: 'unlimited',
        analysisTypes: ['schema', 'referential_integrity', 'naming_patterns', 'value_distributions'],
        confidenceScoring: 'advanced',
        dataSource: 'complete_postgresql_dataset'
      }
    });
    
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
    res.status(500).json({ 
      error: `Status check failed: ${error.message}` 
    });
  }
});

module.exports = router;