/**
 * Relationship Analyzer
 * 
 * Analyzes imported data to detect relationships and generate
 * a Relationship Proposal Report for manual review.
 * 
 * This module reads the temporary _airtable_links columns created
 * during import and uses smart detection logic to propose
 * appropriate database relationships.
 */

const ImportDatabaseService = require('./importDatabase');

class RelationshipAnalyzer {
  constructor() {
    this.importDb = null;
    this.analysisResults = null;
  }

  /**
   * Analyzes all relationships in the imported database
   * @param {ImportDatabaseService} importDb - Connected database service
   * @param {Object} importMetadata - Metadata from the import process
   * @returns {Object} Relationship Proposal Report
   */
  async analyzeRelationships(importDb, importMetadata) {
    console.log('🔍 Analyzing relationships from imported data...');
    
    this.importDb = importDb;
    
    try {
      // Get all tables and their temporary link columns
      const linkColumns = await this.findAllLinkColumns();
      console.log(`   📊 Found ${linkColumns.length} link columns to analyze`);

      // Analyze each link column
      const relationshipProposals = [];
      
      for (const linkColumn of linkColumns) {
        console.log(`   🔍 Analyzing: ${linkColumn.tableName}.${linkColumn.columnName}`);
        
        const analysis = await this.analyzeLinkColumn(linkColumn);
        if (analysis.hasRelationship) {
          relationshipProposals.push(analysis);
        }
      }

      // Generate the final report
      const report = {
        analysisId: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        sourceImport: importMetadata,
        summary: {
          totalLinkColumns: linkColumns.length,
          relationshipsDetected: relationshipProposals.length,
          oneToOne: relationshipProposals.filter(r => r.detectedType === 'one-to-one').length,
          oneToMany: relationshipProposals.filter(r => r.detectedType === 'one-to-many').length,
          manyToMany: relationshipProposals.filter(r => r.detectedType === 'many-to-many').length
        },
        relationships: relationshipProposals.map(proposal => ({
          id: proposal.relationshipId,
          sourceTable: proposal.sourceTable,
          sourceField: proposal.sourceField,
          targetTable: proposal.targetTable,
          targetField: 'airtable_id',
          detectedType: proposal.detectedType,
          confidence: proposal.confidence,
          evidence: proposal.evidence,
          proposedAction: proposal.proposedAction,
          sqlPreview: proposal.sqlPreview,
          reviewRequired: proposal.confidence < 0.8, // Flag low-confidence relationships
          metadata: {
            totalSourceRecords: proposal.totalSourceRecords,
            recordsWithLinks: proposal.recordsWithLinks,
            uniqueTargetLinks: proposal.uniqueTargetLinks,
            maxLinksPerRecord: proposal.maxLinksPerRecord,
            averageLinksPerRecord: proposal.averageLinksPerRecord
          }
        }))
      };

      this.analysisResults = report;
      
      console.log('✅ Relationship analysis complete');
      console.log(`   📊 ${report.summary.relationshipsDetected} relationships detected`);
      console.log(`   🎯 Confidence breakdown: ${report.relationships.filter(r => r.confidence >= 0.8).length} high, ${report.relationships.filter(r => r.confidence < 0.8).length} low`);

      return report;

    } catch (error) {
      console.error('❌ Relationship analysis failed:', error.message);
      throw new Error(`Relationship analysis failed: ${error.message}`);
    }
  }

  /**
   * Finds all temporary link columns in the database
   */
  async findAllLinkColumns() {
    const query = `
      SELECT 
        t.table_name,
        c.column_name,
        c.data_type
      FROM information_schema.tables t
      JOIN information_schema.columns c ON c.table_name = t.table_name
      WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name LIKE '_airtable_links_%'
      AND c.data_type = 'ARRAY'
      ORDER BY t.table_name, c.column_name
    `;

    const result = await this.importDb.executeSQL(query);
    // Handle different database result formats
    const rows = Array.isArray(result) ? result : (result.rows || []);
    return rows.map(row => ({
      tableName: row.table_name,
      columnName: row.column_name,
      originalFieldName: row.column_name.replace('_airtable_links_', ''),
      dataType: row.data_type
    }));
  }

  /**
   * Analyzes a specific link column to determine relationship type
   */
  async analyzeLinkColumn(linkColumn) {
    const relationshipId = `rel-${linkColumn.tableName}-${linkColumn.originalFieldName}-${Date.now()}`;
    
    // Get basic statistics about the link column
    const statsQuery = `
      WITH link_stats AS (
        SELECT 
          COUNT(*) as total_records,
          COUNT("${linkColumn.columnName}") as records_with_links,
          COUNT("${linkColumn.columnName}"[1]) as records_with_any_links
        FROM "${linkColumn.tableName}"
      ),
      link_details AS (
        SELECT 
          unnest("${linkColumn.columnName}") as target_id,
          array_length("${linkColumn.columnName}", 1) as link_count
        FROM "${linkColumn.tableName}"
        WHERE "${linkColumn.columnName}" IS NOT NULL
      ),
      target_stats AS (
        SELECT 
          COUNT(DISTINCT target_id) as unique_targets,
          MAX(link_count) as max_links_per_record,
          AVG(link_count::decimal) as avg_links_per_record
        FROM link_details
      )
      SELECT 
        ls.total_records,
        ls.records_with_links,
        ts.unique_targets,
        ts.max_links_per_record,
        ts.avg_links_per_record
      FROM link_stats ls, target_stats ts
    `;

    const statsResult = await this.importDb.executeSQL(statsQuery);
    const statsRows = Array.isArray(statsResult) ? statsResult : (statsResult.rows || []);
    const linkStats = statsRows[0];

    // Check if any records actually have links
    if (!linkStats.records_with_links || linkStats.records_with_links === 0) {
      return {
        relationshipId,
        hasRelationship: false,
        reason: 'No records have links in this column'
      };
    }

    // Find the target table by checking which table contains these target IDs
    const targetTable = await this.findTargetTable(linkColumn);
    if (!targetTable) {
      return {
        relationshipId,
        hasRelationship: false,
        reason: 'Could not identify target table for linked records'
      };
    }

    // Determine relationship type based on link patterns
    const relationshipType = this.determineRelationshipType(linkStats);
    const confidence = this.calculateConfidence(linkStats, targetTable);

    // Generate evidence description
    const evidence = this.generateEvidence(linkStats, targetTable, linkColumn);

    // Generate proposed action and SQL
    const { proposedAction, sqlPreview } = this.generateProposedAction(
      linkColumn, 
      targetTable, 
      relationshipType, 
      linkStats
    );

    return {
      relationshipId,
      hasRelationship: true,
      sourceTable: linkColumn.tableName,
      sourceField: linkColumn.originalFieldName,
      targetTable: targetTable.tableName,
      detectedType: relationshipType,
      confidence,
      evidence,
      proposedAction,
      sqlPreview,
      totalSourceRecords: parseInt(linkStats.total_records),
      recordsWithLinks: parseInt(linkStats.records_with_links),
      uniqueTargetLinks: parseInt(linkStats.unique_targets),
      maxLinksPerRecord: parseInt(linkStats.max_links_per_record || 0),
      averageLinksPerRecord: parseFloat(linkStats.avg_links_per_record || 0)
    };
  }

  /**
   * Finds the target table that contains the linked record IDs
   */
  async findTargetTable(linkColumn) {
    // Get a sample of target IDs from the link column
    const sampleQuery = `
      SELECT DISTINCT unnest("${linkColumn.columnName}") as target_id
      FROM "${linkColumn.tableName}"
      WHERE "${linkColumn.columnName}" IS NOT NULL
      LIMIT 10
    `;

    const sampleResult = await this.importDb.executeSQL(sampleQuery);
    const sampleIds = Array.isArray(sampleResult) ? sampleResult : (sampleResult.rows || []);
    if (sampleIds.length === 0) return null;

    // Check which table contains these IDs in their airtable_id column
    const tables = await this.getAllTables();
    
    for (const table of tables) {
      if (table.table_name === linkColumn.tableName) continue; // Skip self-references for now
      
      const matchQuery = `
        SELECT COUNT(*) as match_count
        FROM "${table.table_name}"
        WHERE airtable_id = ANY($1)
      `;
      
      const matchResult = await this.importDb.executeSQL(matchQuery, [sampleIds.map(row => row.target_id)]);
      const matchRows = Array.isArray(matchResult) ? matchResult : (matchResult.rows || []);
      const matchCount = matchRows.length > 0 ? parseInt(matchRows[0].match_count) : 0;
      
      if (matchCount > 0) {
        // Get total records in target table for additional context
        const countQuery = `SELECT COUNT(*) as total_records FROM "${table.table_name}"`;
        const countResult = await this.importDb.executeSQL(countQuery);
        const countRows = Array.isArray(countResult) ? countResult : (countResult.rows || []);
        
        return {
          tableName: table.table_name,
          totalRecords: countRows.length > 0 ? parseInt(countRows[0].total_records) : 0,
          matchingRecords: matchCount,
          matchPercentage: Math.round((matchCount / sampleIds.length) * 100)
        };
      }
    }

    return null;
  }

  /**
   * Gets all tables in the database
   */
  async getAllTables() {
    const query = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      ORDER BY table_name
    `;

    const result = await this.importDb.executeSQL(query);
    return Array.isArray(result) ? result : (result.rows || []);
  }

  /**
   * Determines relationship type based on link statistics
   */
  determineRelationshipType(linkStats) {
    const maxLinks = parseInt(linkStats.max_links_per_record || 0);
    const avgLinks = parseFloat(linkStats.avg_links_per_record || 0);

    if (maxLinks === 1) {
      return 'one-to-one'; // Each source record links to at most one target
    } else if (maxLinks > 1 && avgLinks < 2) {
      return 'one-to-many'; // Most records link to one, but some link to many
    } else {
      return 'many-to-many'; // Many records link to multiple targets
    }
  }

  /**
   * Calculates confidence score for the relationship detection
   */
  calculateConfidence(linkStats, targetTable) {
    let confidence = 0.5; // Base confidence

    // Higher confidence if good data coverage
    const linkCoverage = linkStats.records_with_links / linkStats.total_records;
    if (linkCoverage >= 0.8) confidence += 0.3;
    else if (linkCoverage >= 0.5) confidence += 0.2;
    else if (linkCoverage >= 0.2) confidence += 0.1;

    // Higher confidence if target table has good match rate
    if (targetTable.matchPercentage >= 90) confidence += 0.2;
    else if (targetTable.matchPercentage >= 70) confidence += 0.1;

    // Higher confidence if we have meaningful amounts of data
    if (linkStats.total_records >= 100 && linkStats.records_with_links >= 50) {
      confidence += 0.1;
    }

    return Math.min(0.99, Math.max(0.1, confidence));
  }

  /**
   * Generates human-readable evidence for the relationship
   */
  generateEvidence(linkStats, targetTable, linkColumn) {
    const linkCoverage = Math.round((linkStats.records_with_links / linkStats.total_records) * 100);
    const avgLinks = parseFloat(linkStats.avg_links_per_record || 0).toFixed(1);
    
    return [
      `${linkStats.records_with_links} out of ${linkStats.total_records} records (${linkCoverage}%) have links`,
      `Links point to ${linkStats.unique_targets} unique records in ${targetTable.tableName}`,
      `Maximum links per record: ${linkStats.max_links_per_record}`,
      `Average links per record: ${avgLinks}`,
      `Target table match rate: ${targetTable.matchPercentage}% of sample IDs found`
    ];
  }

  /**
   * Generates proposed action and SQL preview
   */
  generateProposedAction(linkColumn, targetTable, relationshipType, linkStats) {
    const sourceTable = linkColumn.tableName;
    const sourceField = linkColumn.originalFieldName;
    const targetTableName = targetTable.tableName;

    switch (relationshipType) {
      case 'one-to-one':
      case 'one-to-many':
        return {
          proposedAction: `Add foreign key column "${sourceField}_id" to "${sourceTable}" table referencing "${targetTableName}"`,
          sqlPreview: [
            `-- Add foreign key column`,
            `ALTER TABLE "${sourceTable}" ADD COLUMN "${sourceField}_id" VARCHAR(255);`,
            ``,
            `-- Populate foreign key column from first link in array`,
            `UPDATE "${sourceTable}" SET "${sourceField}_id" = "${linkColumn.columnName}"[1] WHERE "${linkColumn.columnName}" IS NOT NULL;`,
            ``,
            `-- Add foreign key constraint`,
            `ALTER TABLE "${sourceTable}" ADD CONSTRAINT "fk_${sourceTable}_${sourceField}"`,
            `  FOREIGN KEY ("${sourceField}_id") REFERENCES "${targetTableName}" (airtable_id);`,
            ``,
            `-- Drop temporary link column`,
            `ALTER TABLE "${sourceTable}" DROP COLUMN "${linkColumn.columnName}";`
          ].join('\n')
        };

      case 'many-to-many':
        const junctionTableName = `${sourceTable}_${sourceField}_links`;
        return {
          proposedAction: `Create junction table "${junctionTableName}" for many-to-many relationship`,
          sqlPreview: [
            `-- Create junction table`,
            `CREATE TABLE "${junctionTableName}" (`,
            `  id SERIAL PRIMARY KEY,`,
            `  ${sourceTable}_id INTEGER NOT NULL,`,
            `  ${targetTableName}_id VARCHAR(255) NOT NULL,`,
            `  created_at TIMESTAMP DEFAULT NOW(),`,
            `  FOREIGN KEY (${sourceTable}_id) REFERENCES "${sourceTable}" (id),`,
            `  FOREIGN KEY (${targetTableName}_id) REFERENCES "${targetTableName}" (airtable_id),`,
            `  UNIQUE(${sourceTable}_id, ${targetTableName}_id)`,
            `);`,
            ``,
            `-- Populate junction table from link arrays`,
            `INSERT INTO "${junctionTableName}" (${sourceTable}_id, ${targetTableName}_id)`,
            `SELECT s.id, unnest(s."${linkColumn.columnName}") as target_id`,
            `FROM "${sourceTable}" s`,
            `WHERE s."${linkColumn.columnName}" IS NOT NULL`,
            `ON CONFLICT (${sourceTable}_id, ${targetTableName}_id) DO NOTHING;`,
            ``,
            `-- Drop temporary link column`,
            `ALTER TABLE "${sourceTable}" DROP COLUMN "${linkColumn.columnName}";`
          ].join('\n')
        };

      default:
        return {
          proposedAction: `Unknown relationship type: ${relationshipType}`,
          sqlPreview: '-- No SQL generated for unknown relationship type'
        };
    }
  }

  /**
   * Gets the current analysis results
   */
  getAnalysisResults() {
    return this.analysisResults;
  }
}

module.exports = RelationshipAnalyzer;