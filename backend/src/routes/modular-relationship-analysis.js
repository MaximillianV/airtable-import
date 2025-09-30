/**
 * Modular Relationship Analysis API
 * 
 * Breaks down relationship analysis into separate phases:
 * 1. Confidence Level Analysis - Analyze and score all potential relationships
 * 2. Junction Table Detection - Identify which relationships need junction tables
 * 3. Junction Table Creation - Actually create the junction tables
 * 4. Foreign Key Creation - Add all foreign key constraints
 * 
 * Each phase has its own endpoint for granular testing and debugging.
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const ImportDatabaseService = require('../services/importDatabase');
const { batchAnalyzeCardinality, isLookupField } = require('../../../enhanced-cardinality-analysis');

const router = express.Router();

// Cache for analysis session data
const analysisSessionCache = new Map();

/**
 * Phase 1: Analyze confidence levels for all potential relationships
 */
router.post('/phase1-confidence-analysis', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Phase 1: Starting confidence level analysis...');
    
    const { getUserSettings } = require('./settings');
    const settings = await getUserSettings(req.user.userId);
    
    if (!settings.databaseUrl || !settings.airtableBaseId) {
      return res.status(400).json({ 
        error: 'Database URL and Airtable Base ID are required' 
      });
    }

    // Connect to import database
    const importDb = new ImportDatabaseService();
    await importDb.connect(settings.databaseUrl, settings.airtableBaseId);
    
    console.log(`✅ Connected to: ${importDb.location}`);

    // Get all tables with actual data
    const tablesQuery = `
      SELECT 
        t.table_name,
        COALESCE(s.n_tup_ins, 0) as row_count
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
      WHERE t.table_schema = 'public' 
      AND t.table_type = 'BASE TABLE'
      AND t.table_name NOT LIKE 'pg_%'
      ORDER BY COALESCE(s.n_tup_ins, 0) DESC
    `;
    
    const tableResults = await importDb.executeSQL(tablesQuery);
    const tables = Array.isArray(tableResults) ? tableResults : tableResults.rows || [];
    
    console.log(`📊 Found ${tables.length} tables with total ${tables.reduce((sum, t) => sum + parseInt(t.row_count), 0)} records`);
    
    // List all tables for debugging
    console.log('📋 Tables to analyze:');
    tables.forEach((table, idx) => {
      console.log(`   [${idx+1}] ${table.table_name} (${table.row_count} rows)`);
    });

    // Analyze potential relationships between all table pairs
    const potentialRelationships = [];
    let analyzed = 0;
    const totalAnalyses = tables.length * (tables.length - 1); // Exclude self-comparisons
    
    console.log(`🔍 Starting analysis of ${totalAnalyses} table pair combinations...`);

    for (const sourceTable of tables) {
      console.log(`\n🔎 Analyzing source table: ${sourceTable.table_name}`);
      
      for (const targetTable of tables) {
        if (sourceTable.table_name === targetTable.table_name) {
          console.log(`   ⏭️ Skipping self-comparison with ${targetTable.table_name}`);
          continue;
        }
        
        console.log(`   🔗 Checking relationship: ${sourceTable.table_name} → ${targetTable.table_name}`);
        
        analyzed++;
        const progress = (analyzed / totalAnalyses * 100).toFixed(1);
        console.log(`      � Progress: ${analyzed}/${totalAnalyses} (${progress}%)`);

        // Get columns for source table
        console.log(`      🔍 Getting columns for source table: ${sourceTable.table_name}`);
        const columnsQuery = `
          SELECT 
            column_name,
            data_type,
            udt_name,
            is_nullable
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = 'public'
          AND column_name != 'airtable_id'
          ORDER BY ordinal_position
        `;
        
        const sourceColumnsResult = await importDb.executeSQL(columnsQuery, [sourceTable.table_name]);
        const sourceColumns = Array.isArray(sourceColumnsResult) ? sourceColumnsResult : sourceColumnsResult.rows || [];
        
        console.log(`      📋 Found ${sourceColumns.length} columns in ${sourceTable.table_name}:`);
        sourceColumns.forEach(col => {
          const type = col.udt_name === '_text' ? 'TEXT[]' : col.data_type;
          console.log(`         📝 ${col.column_name} (${type})`);
        });
        
        // Check each column as potential foreign key
        for (const column of sourceColumns) {
          console.log(`         🔍 Analyzing column: ${column.column_name} (${column.udt_name === '_text' ? 'TEXT[]' : column.data_type})`);
          
          // Skip lookup/derived fields as they're not true relationships
          if (isLookupField(column.column_name)) {
            console.log(`         ⏭️  Skipping lookup field: ${column.column_name}`);
            continue;
          }
          
          const relationship = await analyzeColumnRelationshipConfidence(
            importDb,
            sourceTable.table_name,
            column.column_name,
            targetTable.table_name,
            'airtable_id'
          );
          
          if (relationship.confidence > 0.3) { // Only keep relationships with some confidence
            potentialRelationships.push(relationship);
          }
        }
      }
    }

    await importDb.disconnect();

    // Sort by confidence
    potentialRelationships.sort((a, b) => b.confidence - a.confidence);

    console.log('🔍 Enhancing relationships with accurate cardinality analysis...');
    
    // Enhance relationships with accurate cardinality analysis
    const enhancedRelationships = await batchAnalyzeCardinality(importDb, potentialRelationships);

    // Create analysis session
    const sessionId = `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    analysisSessionCache.set(sessionId, {
      phase: 'confidence-analyzed',
      relationships: enhancedRelationships,
      createdAt: new Date().toISOString(),
      statistics: {
        totalTables: tables.length,
        totalRecords: tables.reduce((sum, t) => sum + parseInt(t.row_count), 0),
        potentialRelationships: enhancedRelationships.length,
        highConfidence: enhancedRelationships.filter(r => r.confidence >= 0.8).length,
        mediumConfidence: enhancedRelationships.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length,
        lowConfidence: enhancedRelationships.filter(r => r.confidence >= 0.3 && r.confidence < 0.6).length,
        oneToOne: enhancedRelationships.filter(r => r.relationshipType === 'one-to-one').length,
        oneToMany: enhancedRelationships.filter(r => r.relationshipType === 'one-to-many').length,
        manyToOne: enhancedRelationships.filter(r => r.relationshipType === 'many-to-one').length,
        manyToMany: enhancedRelationships.filter(r => r.relationshipType === 'many-to-many').length
      }
    });

    console.log(`✅ Phase 1 complete: ${enhancedRelationships.length} potential relationships found with enhanced cardinality analysis`);

    res.json({
      success: true,
      sessionId,
      phase: 'confidence-analyzed',
      message: `Confidence analysis complete: ${enhancedRelationships.length} potential relationships found with accurate cardinality`,
      data: {
        statistics: analysisSessionCache.get(sessionId).statistics,
        topRelationships: enhancedRelationships.slice(0, 50), // Show top 50 instead of 20
        confidenceDistribution: {
          'high (≥0.8)': enhancedRelationships.filter(r => r.confidence >= 0.8).length,
          'medium (0.6-0.79)': enhancedRelationships.filter(r => r.confidence >= 0.6 && r.confidence < 0.8).length,
          'low (0.3-0.59)': enhancedRelationships.filter(r => r.confidence >= 0.3 && r.confidence < 0.6).length
        },
        cardinalityDistribution: {
          'one-to-one': enhancedRelationships.filter(r => r.relationshipType === 'one-to-one').length,
          'one-to-many': enhancedRelationships.filter(r => r.relationshipType === 'one-to-many').length,
          'many-to-one': enhancedRelationships.filter(r => r.relationshipType === 'many-to-one').length,
          'many-to-many': enhancedRelationships.filter(r => r.relationshipType === 'many-to-many').length
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Phase 1 failed:', error.message);
    res.status(500).json({ 
      error: `Phase 1 confidence analysis failed: ${error.message}`,
      details: error.stack
    });
  }
});

/**
 * Phase 2: Detect which relationships need junction tables
 */
router.post('/phase2-junction-detection', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    console.log(`🔍 Phase 2: Detecting junction table needs for session ${sessionId}...`);
    
    if (!sessionId || !analysisSessionCache.has(sessionId)) {
      return res.status(400).json({ 
        error: 'Invalid session ID. Please run Phase 1 first.' 
      });
    }

    const session = analysisSessionCache.get(sessionId);
    if (session.phase !== 'confidence-analyzed') {
      return res.status(400).json({ 
        error: `Session is at phase '${session.phase}', expected 'confidence-analyzed'` 
      });
    }

    // Filter for high-confidence relationships
    const highConfidenceRelationships = session.relationships.filter(r => r.confidence >= 0.7);
    
    console.log(`📊 Analyzing ${highConfidenceRelationships.length} high-confidence relationships for junction table needs...`);

    // Detect many-to-many relationships that need junction tables
    const junctionTableNeeds = [];
    const oneToManyRelationships = [];

    for (const relationship of highConfidenceRelationships) {
      // Check if this is a many-to-many relationship
      const isManyToMany = await detectManyToManyRelationship(relationship);
      
      if (isManyToMany) {
        const junctionTableName = `${relationship.fromTable}_${relationship.toTable}_junction`;
        junctionTableNeeds.push({
          ...relationship,
          relationshipType: 'many-to-many',
          junctionTableName,
          needsJunctionTable: true
        });
      } else {
        oneToManyRelationships.push({
          ...relationship,
          relationshipType: relationship.relationshipType || 'many-to-one',
          needsJunctionTable: false
        });
      }
    }

    // Update session
    session.phase = 'junction-detected';
    session.junctionTableNeeds = junctionTableNeeds;
    session.oneToManyRelationships = oneToManyRelationships;
    analysisSessionCache.set(sessionId, session);

    console.log(`✅ Phase 2 complete: ${junctionTableNeeds.length} junction tables needed, ${oneToManyRelationships.length} direct relationships`);

    res.json({
      success: true,
      sessionId,
      phase: 'junction-detected',
      message: `Junction detection complete: ${junctionTableNeeds.length} junction tables needed`,
      data: {
        junctionTablesNeeded: junctionTableNeeds.length,
        directRelationships: oneToManyRelationships.length,
        junctionTablePlans: junctionTableNeeds.map(j => ({
          fromTable: j.fromTable,
          toTable: j.toTable,
          junctionTableName: j.junctionTableName,
          confidence: j.confidence
        })),
        directRelationshipPlans: oneToManyRelationships.slice(0, 10).map(r => ({
          fromTable: r.fromTable,
          fromField: r.fromField,
          toTable: r.toTable,
          toField: r.toField,
          confidence: r.confidence
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Phase 2 failed:', error.message);
    res.status(500).json({ 
      error: `Phase 2 junction detection failed: ${error.message}` 
    });
  }
});

/**
 * Phase 3: Create junction tables
 */
router.post('/phase3-create-junction-tables', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    console.log(`🏗️ Phase 3: Creating junction tables for session ${sessionId}...`);
    
    if (!sessionId || !analysisSessionCache.has(sessionId)) {
      return res.status(400).json({ 
        error: 'Invalid session ID. Please run previous phases first.' 
      });
    }

    const session = analysisSessionCache.get(sessionId);
    if (session.phase !== 'junction-detected') {
      return res.status(400).json({ 
        error: `Session is at phase '${session.phase}', expected 'junction-detected'` 
      });
    }

    const { getUserSettings } = require('./settings');
    const settings = await getUserSettings(req.user.userId);
    
    // Connect to database
    const importDb = new ImportDatabaseService();
    await importDb.connect(settings.databaseUrl, settings.airtableBaseId);

    const createdJunctionTables = [];
    const errors = [];

    // Create each junction table
    for (const junctionNeed of session.junctionTableNeeds || []) {
      try {
        console.log(`   🏗️ Creating junction table: ${junctionNeed.junctionTableName}`);
        
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS "${junctionNeed.junctionTableName}" (
            id SERIAL PRIMARY KEY,
            ${junctionNeed.fromTable}_id TEXT NOT NULL,
            ${junctionNeed.toTable}_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(${junctionNeed.fromTable}_id, ${junctionNeed.toTable}_id)
          )
        `;

        await importDb.executeSQL(createTableSQL);
        
        // Populate junction table with existing relationships
        const populateSQL = `
          INSERT INTO "${junctionNeed.junctionTableName}" (${junctionNeed.fromTable}_id, ${junctionNeed.toTable}_id)
          SELECT DISTINCT 
            s."${junctionNeed.fromField}" as ${junctionNeed.fromTable}_id,
            t.airtable_id as ${junctionNeed.toTable}_id
          FROM "${junctionNeed.fromTable}" s
          JOIN "${junctionNeed.toTable}" t ON s."${junctionNeed.fromField}" = t.airtable_id
          WHERE s."${junctionNeed.fromField}" IS NOT NULL
          ON CONFLICT (${junctionNeed.fromTable}_id, ${junctionNeed.toTable}_id) DO NOTHING
        `;

        const populateResult = await importDb.executeSQL(populateSQL);
        
        createdJunctionTables.push({
          tableName: junctionNeed.junctionTableName,
          fromTable: junctionNeed.fromTable,
          toTable: junctionNeed.toTable,
          confidence: junctionNeed.confidence,
          created: true
        });
        
        console.log(`   ✅ Junction table created: ${junctionNeed.junctionTableName}`);
        
      } catch (error) {
        console.error(`   ❌ Failed to create junction table ${junctionNeed.junctionTableName}:`, error.message);
        errors.push({
          junctionTableName: junctionNeed.junctionTableName,
          error: error.message
        });
      }
    }

    await importDb.disconnect();

    // Update session
    session.phase = 'junction-tables-created';
    session.createdJunctionTables = createdJunctionTables;
    session.junctionTableErrors = errors;
    analysisSessionCache.set(sessionId, session);

    console.log(`✅ Phase 3 complete: ${createdJunctionTables.length} junction tables created`);

    res.json({
      success: true,
      sessionId,
      phase: 'junction-tables-created',
      message: `Junction table creation complete: ${createdJunctionTables.length} tables created`,
      data: {
        createdJunctionTables,
        errors,
        summary: {
          successful: createdJunctionTables.length,
          failed: errors.length,
          total: (session.junctionTableNeeds || []).length
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Phase 3 failed:', error.message);
    res.status(500).json({ 
      error: `Phase 3 junction table creation failed: ${error.message}` 
    });
  }
});

/**
 * Phase 4: Create all foreign key relationships
 */
router.post('/phase4-create-foreign-keys', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    console.log(`🔗 Phase 4: Creating foreign key constraints for session ${sessionId}...`);
    
    if (!sessionId || !analysisSessionCache.has(sessionId)) {
      return res.status(400).json({ 
        error: 'Invalid session ID. Please run previous phases first.' 
      });
    }

    const session = analysisSessionCache.get(sessionId);
    if (session.phase !== 'junction-tables-created') {
      return res.status(400).json({ 
        error: `Session is at phase '${session.phase}', expected 'junction-tables-created'` 
      });
    }

    const { getUserSettings } = require('./settings');
    const settings = await getUserSettings(req.user.userId);
    
    // Connect to database
    const importDb = new ImportDatabaseService();
    await importDb.connect(settings.databaseUrl, settings.airtableBaseId);

    const createdForeignKeys = [];
    const errors = [];

    // Create foreign keys for direct relationships (one-to-many)
    for (const relationship of session.oneToManyRelationships || []) {
      try {
        const constraintName = `fk_${relationship.fromTable}_${relationship.fromField}_${relationship.toTable}`;
        
        console.log(`   🔗 Creating FK: ${relationship.fromTable}.${relationship.fromField} → ${relationship.toTable}.${relationship.toField}`);
        
        const alterTableSQL = `
          ALTER TABLE "${relationship.fromTable}" 
          ADD CONSTRAINT "${constraintName}" 
          FOREIGN KEY ("${relationship.fromField}") 
          REFERENCES "${relationship.toTable}" ("${relationship.toField}")
        `;

        await importDb.executeSQL(alterTableSQL);
        
        createdForeignKeys.push({
          constraintName,
          fromTable: relationship.fromTable,
          fromField: relationship.fromField,
          toTable: relationship.toTable,
          toField: relationship.toField,
          confidence: relationship.confidence,
          created: true
        });
        
        console.log(`   ✅ Foreign key created: ${constraintName}`);
        
      } catch (error) {
        console.error(`   ❌ Failed to create FK for ${relationship.fromTable}.${relationship.fromField}:`, error.message);
        errors.push({
          relationship: `${relationship.fromTable}.${relationship.fromField} → ${relationship.toTable}.${relationship.toField}`,
          error: error.message
        });
      }
    }

    // Create foreign keys for junction tables
    for (const junctionTable of session.createdJunctionTables || []) {
      try {
        // FK to first table
        const fk1Name = `fk_${junctionTable.tableName}_${junctionTable.fromTable}`;
        const fk1SQL = `
          ALTER TABLE "${junctionTable.tableName}" 
          ADD CONSTRAINT "${fk1Name}" 
          FOREIGN KEY ("${junctionTable.fromTable}_id") 
          REFERENCES "${junctionTable.fromTable}" ("airtable_id")
        `;
        
        await importDb.executeSQL(fk1SQL);
        
        // FK to second table
        const fk2Name = `fk_${junctionTable.tableName}_${junctionTable.toTable}`;
        const fk2SQL = `
          ALTER TABLE "${junctionTable.tableName}" 
          ADD CONSTRAINT "${fk2Name}" 
          FOREIGN KEY ("${junctionTable.toTable}_id") 
          REFERENCES "${junctionTable.toTable}" ("airtable_id")
        `;
        
        await importDb.executeSQL(fk2SQL);
        
        createdForeignKeys.push(
          {
            constraintName: fk1Name,
            fromTable: junctionTable.tableName,
            fromField: `${junctionTable.fromTable}_id`,
            toTable: junctionTable.fromTable,
            toField: 'airtable_id',
            confidence: junctionTable.confidence,
            created: true,
            type: 'junction_table_fk'
          },
          {
            constraintName: fk2Name,
            fromTable: junctionTable.tableName,
            fromField: `${junctionTable.toTable}_id`,
            toTable: junctionTable.toTable,
            toField: 'airtable_id',
            confidence: junctionTable.confidence,
            created: true,
            type: 'junction_table_fk'
          }
        );
        
        console.log(`   ✅ Junction table FKs created for: ${junctionTable.tableName}`);
        
      } catch (error) {
        console.error(`   ❌ Failed to create junction FKs for ${junctionTable.tableName}:`, error.message);
        errors.push({
          junctionTable: junctionTable.tableName,
          error: error.message
        });
      }
    }

    await importDb.disconnect();

    // Update session
    session.phase = 'completed';
    session.createdForeignKeys = createdForeignKeys;
    session.foreignKeyErrors = errors;
    analysisSessionCache.set(sessionId, session);

    console.log(`✅ Phase 4 complete: ${createdForeignKeys.length} foreign key constraints created`);

    res.json({
      success: true,
      sessionId,
      phase: 'completed',
      message: `Foreign key creation complete: ${createdForeignKeys.length} constraints created`,
      data: {
        createdForeignKeys,
        errors,
        summary: {
          successful: createdForeignKeys.length,
          failed: errors.length,
          directRelationships: createdForeignKeys.filter(fk => fk.type !== 'junction_table_fk').length,
          junctionTableRelationships: createdForeignKeys.filter(fk => fk.type === 'junction_table_fk').length
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Phase 4 failed:', error.message);
    res.status(500).json({ 
      error: `Phase 4 foreign key creation failed: ${error.message}` 
    });
  }
});

/**
 * Get analysis session status
 */
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!analysisSessionCache.has(sessionId)) {
      return res.status(404).json({ 
        error: 'Analysis session not found' 
      });
    }

    const session = analysisSessionCache.get(sessionId);
    
    res.json({
      success: true,
      sessionId,
      phase: session.phase,
      createdAt: session.createdAt,
      statistics: session.statistics || {},
      progress: {
        phase1Complete: ['confidence-analyzed', 'junction-detected', 'junction-tables-created', 'completed'].includes(session.phase),
        phase2Complete: ['junction-detected', 'junction-tables-created', 'completed'].includes(session.phase),
        phase3Complete: ['junction-tables-created', 'completed'].includes(session.phase),
        phase4Complete: session.phase === 'completed'
      }
    });
    
  } catch (error) {
    console.error('❌ Session status failed:', error.message);
    res.status(500).json({ 
      error: `Session status failed: ${error.message}` 
    });
  }
});

/**
 * Helper function to analyze column relationship confidence
 */
async function analyzeColumnRelationshipConfidence(importDb, sourceTable, sourceColumn, targetTable, targetColumn) {
  try {
    console.log(`            🔬 Starting detailed analysis: ${sourceTable}.${sourceColumn} → ${targetTable}.${targetColumn}`);
    
    // Set timeout for relationship analysis to prevent hanging
    const timeout = 30000; // 30 seconds
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Relationship analysis timeout')), timeout)
    );
    
    // Check if source column is TEXT[] array type
    console.log(`            🔍 Checking column type for ${sourceTable}.${sourceColumn}`);
    const columnTypeQuery = `
      SELECT data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = '${sourceTable}' AND column_name = '${sourceColumn}'
    `;
    
    const columnTypeResult = await Promise.race([
      importDb.executeSQL(columnTypeQuery),
      timeoutPromise
    ]);
    
    const isArrayField = columnTypeResult.rows[0]?.udt_name === '_text';
    const columnType = isArrayField ? 'TEXT[]' : columnTypeResult.rows[0]?.data_type;
    
    console.log(`            📊 Column ${sourceTable}.${sourceColumn} type: ${columnType} (array: ${isArrayField})`);
    
    if (isArrayField) {
      console.log(`            🔗 Using array-aware analysis for TEXT[] field`);
    } else {
      console.log(`            🔗 Using single-value analysis for regular field`);
    }
    
    // Use array-aware analysis for TEXT[] fields
    const analysisQuery = isArrayField ? `
      WITH source_analysis AS (
        SELECT 
          COUNT(*) as total_rows,
          COUNT("${sourceColumn}") as non_null_count,
          SUM(array_length("${sourceColumn}", 1)) as total_array_elements
        FROM "${sourceTable}"
        WHERE "${sourceColumn}" IS NOT NULL
      ),
      target_analysis AS (
        SELECT 
          COUNT(DISTINCT "${targetColumn}") as target_distinct_count
        FROM "${targetTable}"
      ),
      array_match_analysis AS (
        SELECT 
          COUNT(*) as rows_with_matches,
          SUM(
            CASE 
              WHEN EXISTS (
                SELECT 1 FROM unnest("${sourceColumn}") as elem
                WHERE elem IN (SELECT "${targetColumn}" FROM "${targetTable}")
              ) THEN 1 
              ELSE 0 
            END
          ) as rows_with_valid_references
        FROM "${sourceTable}"
        WHERE "${sourceColumn}" IS NOT NULL AND array_length("${sourceColumn}", 1) > 0
      )
      SELECT 
        sa.total_rows,
        sa.non_null_count,
        sa.total_array_elements,
        ta.target_distinct_count,
        ama.rows_with_matches,
        ama.rows_with_valid_references,
        CASE 
          WHEN sa.non_null_count = 0 THEN 0
          ELSE ROUND((ama.rows_with_valid_references::decimal / sa.non_null_count::decimal) * 100, 2)
        END as referential_integrity_percent
      FROM source_analysis sa, target_analysis ta, array_match_analysis ama
    ` : `
      WITH source_analysis AS (
        SELECT 
          COUNT(*) as total_rows,
          COUNT("${sourceColumn}") as non_null_count,
          COUNT(DISTINCT "${sourceColumn}") as distinct_count
        FROM "${sourceTable}"
      ),
      target_analysis AS (
        SELECT 
          COUNT(DISTINCT "${targetColumn}") as target_distinct_count
        FROM "${targetTable}"
      ),
      match_analysis AS (
        SELECT 
          COUNT(DISTINCT s."${sourceColumn}") as source_distinct_values,
          COUNT(DISTINCT t."${targetColumn}") as matched_values
        FROM "${sourceTable}" s
        LEFT JOIN "${targetTable}" t ON s."${sourceColumn}" = t."${targetColumn}"
        WHERE s."${sourceColumn}" IS NOT NULL
      )
      SELECT 
        sa.total_rows,
        sa.non_null_count,
        sa.distinct_count,
        ta.target_distinct_count,
        ma.source_distinct_values,
        ma.matched_values,
        CASE 
          WHEN ma.source_distinct_values = 0 THEN 0
          ELSE ROUND((ma.matched_values::decimal / ma.source_distinct_values::decimal) * 100, 2)
        END as referential_integrity_percent,
        CASE 
          WHEN sa.non_null_count = 0 THEN 0
          ELSE ROUND((sa.distinct_count::decimal / sa.non_null_count::decimal) * 100, 2)
        END as distinctness_percent
      FROM source_analysis sa, target_analysis ta, match_analysis ma
    `;

    console.log(`            🔍 Executing ${isArrayField ? 'array-aware' : 'single-value'} analysis query...`);
    
    const result = await Promise.race([
      importDb.executeSQL(analysisQuery),
      timeoutPromise
    ]);
    
    const stats = result.rows ? result.rows[0] : result[0];
    
    console.log(`            📊 Analysis results:`, {
      total_rows: stats.total_rows,
      non_null_count: stats.non_null_count,
      ...(isArrayField ? {
        total_array_elements: stats.total_array_elements,
        rows_with_valid_references: stats.rows_with_valid_references
      } : {
        matched_values: stats.matched_values,
        referential_integrity_percent: stats.referential_integrity_percent
      })
    });

    const integrityPercent = parseFloat(stats.referential_integrity_percent || 0);
    const completeness = stats.non_null_count / stats.total_rows;

    // Calculate confidence score based on field type
    let confidence = 0;
    
    if (isArrayField) {
      // Array field confidence calculation
      const validReferences = parseInt(stats.rows_with_valid_references || 0);
      const nonNullCount = parseInt(stats.non_null_count || 0);
      
      if (integrityPercent >= 90 && validReferences >= 3) {
        confidence = 0.95;
      } else if (integrityPercent >= 80 && validReferences >= 5) {
        confidence = 0.85;
      } else if (integrityPercent >= 60 && validReferences >= 2) {
        confidence = 0.75;
      } else if (integrityPercent >= 40 && validReferences >= 1) {
        confidence = 0.60;
      } else if (integrityPercent >= 20) {
        confidence = 0.40;
      }
      
      console.log(`            🔗 Array relationship analysis result:`);
      console.log(`               📊 Integrity: ${integrityPercent}%, Valid refs: ${validReferences}/${nonNullCount}`);
      console.log(`               🎯 Confidence: ${confidence} (${(confidence * 100).toFixed(1)}%)`);
      
    } else {
      // Single value field confidence calculation
      const distinctness = parseFloat(stats.distinctness_percent || 0);
      const matchedValues = parseInt(stats.matched_values || 0);
      
      if (integrityPercent >= 90 && matchedValues >= 3) {
        confidence = 0.95;
      } else if (integrityPercent >= 80 && matchedValues >= 5) {
        confidence = 0.85;
      } else if (integrityPercent >= 70 && matchedValues >= 10) {
        confidence = 0.75;
      } else if (integrityPercent >= 60 && matchedValues >= 5) {
        confidence = 0.65;
      } else if (integrityPercent >= 50 && matchedValues >= 3) {
        confidence = 0.55;
      } else if (integrityPercent >= 30 && matchedValues >= 2) {
        confidence = 0.35;
      }
      
      console.log(`            🔗 Single-value relationship analysis result:`);
      console.log(`               📊 Integrity: ${integrityPercent}%, Matches: ${matchedValues}`);
      console.log(`               🎯 Confidence: ${confidence} (${(confidence * 100).toFixed(1)}%)`);
    }

    // Adjust confidence based on data quality
    if (completeness >= 0.8) confidence += 0.05;
    if (stats.total_rows >= 100) confidence += 0.03;
    
    confidence = Math.min(0.99, confidence);

    // Build appropriate return object based on field type
    const baseReturn = {
      fromTable: sourceTable,
      fromField: sourceColumn,
      toTable: targetTable,
      toField: targetColumn,
      confidence,
      relationshipType: isArrayField ? 'many-to-many (array)' : 
                       (parseFloat(stats.distinctness_percent || 0) >= 80 ? 'one-to-one' : 'many-to-one'),
      reasoning: isArrayField ? 
        `Array field: ${integrityPercent}% referential integrity (${stats.rows_with_valid_references}/${stats.non_null_count} rows have valid references)` :
        `${integrityPercent}% referential integrity (${stats.matched_values}/${stats.source_distinct_values} values match)`,
      statistics: {
        referentialIntegrityPercent: integrityPercent,
        totalRows: parseInt(stats.total_rows),
        nonNullCount: parseInt(stats.non_null_count),
        completeness: Math.round(completeness * 100) / 100,
        fieldType: isArrayField ? 'TEXT[] array' : 'single value',
        ...(isArrayField ? {
          rowsWithValidReferences: parseInt(stats.rows_with_valid_references || 0),
          totalArrayElements: parseInt(stats.total_array_elements || 0)
        } : {
          distinctCount: parseInt(stats.distinct_count),
          matchedValues: parseInt(stats.matched_values),
          distinctness: parseFloat(stats.distinctness_percent || 0)
        })
      }
    };
    
    console.log(`Confidence analysis complete for ${sourceTable}.${sourceColumn} → ${targetTable}.${targetColumn}: ${confidence}% confidence (${baseReturn.relationshipType})`);
    return baseReturn;

  } catch (error) {
    console.warn(`Confidence analysis failed for ${sourceTable}.${sourceColumn} → ${targetTable}.${targetColumn}:`, error.message);
    return {
      fromTable: sourceTable,
      fromField: sourceColumn,
      toTable: targetTable, 
      toField: targetColumn,
      confidence: 0,
      relationshipType: 'unknown',
      reasoning: `Analysis failed: ${error.message}`,
      statistics: { error: true }
    };
  }
}

/**
 * Helper function to detect many-to-many relationships
 */
async function detectManyToManyRelationship(relationship) {
  // Simple heuristic: if distinctness is low (many records share same foreign key values)
  // and there are multiple distinct foreign key values, it's likely many-to-many
  
  if (relationship.statistics) {
    const distinctness = relationship.statistics.distinctness;
    const matchedValues = relationship.statistics.matchedValues;
    
    // If distinctness is low and we have many matched values, likely many-to-many
    return distinctness < 30 && matchedValues > 10;
  }
  
  return false;
}

module.exports = router;