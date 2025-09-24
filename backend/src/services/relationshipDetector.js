/**
 * Database Relationship Detector Service
 * 
 * Analyzes Airtable linked record fields and creates relationship mappings
 * for PostgreSQL foreign key constraints. Detects relationship types and
 * generates schema recommendations for optimal database design.
 * 
 * @author GitHub Copilot
 * @version 1.0.0
 */

const AirtableService = require('./airtable');
const { toSnakeCase, sanitizeTableName, sanitizeColumnName } = require('../utils/naming');

/**
 * Represents a detected database relationship between two tables
 */
class DatabaseRelationship {
  constructor({
    sourceTable,
    sourceColumn,
    targetTable,
    targetColumn,
    relationshipType,
    cardinality,
    isRequired = false,
    constraintName = null
  }) {
    this.sourceTable = sourceTable;        // Source table name (snake_case)
    this.sourceColumn = sourceColumn;      // Source column name (snake_case)
    this.targetTable = targetTable;        // Target table name (snake_case)
    this.targetColumn = targetColumn;      // Target column name (snake_case)
    this.relationshipType = relationshipType; // 'one-to-one', 'one-to-many', 'many-to-many'
    this.cardinality = cardinality;        // Detailed cardinality info
    this.isRequired = isRequired;          // Whether the relationship is required (NOT NULL)
    this.constraintName = constraintName || this.generateConstraintName();
  }

  /**
   * Generates a standardized foreign key constraint name
   * @returns {string} Foreign key constraint name
   */
  generateConstraintName() {
    return `fk_${this.sourceTable}_${this.sourceColumn}_${this.targetTable}`;
  }

  /**
   * Generates SQL DDL for creating the foreign key constraint
   * @returns {string} SQL ALTER TABLE statement
   */
  toSQL() {
    const nullable = this.isRequired ? 'NOT NULL' : '';
    return `ALTER TABLE "${this.sourceTable}" 
ADD CONSTRAINT "${this.constraintName}" 
FOREIGN KEY ("${this.sourceColumn}") 
REFERENCES "${this.targetTable}"("${this.targetColumn}")`;
  }
}

/**
 * Service class for detecting and analyzing database relationships
 * from Airtable linked record fields
 */
class RelationshipDetector {
  constructor() {
    this.airtableService = new AirtableService();
    this.detectedRelationships = [];
    this.tableSchemas = new Map(); // Cache for table schemas
    this.linkAnalysis = new Map();  // Cache for link field analysis
  }

  /**
   * Connects to Airtable using provided credentials
   * @param {string} apiKey - Airtable API key
   * @param {string} baseId - Airtable base ID
   */
  async connect(apiKey, baseId) {
    await this.airtableService.connect(apiKey, baseId);
    console.log('🔗 RelationshipDetector connected to Airtable');
  }

  /**
   * Analyzes all tables in the Airtable base and detects relationships
   * @returns {Promise<Array<DatabaseRelationship>>} Array of detected relationships
   */
  async analyzeAllRelationships() {
    console.log('🔍 Starting comprehensive relationship analysis...');
    
    try {
      // Step 1: Discover all tables in the base
      const tables = await this.airtableService.discoverTablesWithCounts();
      console.log(`📋 Found ${tables.length} tables to analyze`);

      // Step 2: Get schema for each table and cache it
      for (const table of tables) {
        try {
          const schema = await this.airtableService.getTableSchema(table.name);
          this.tableSchemas.set(table.name, schema);
          console.log(`📋 Cached schema for table: ${table.name}`);
        } catch (error) {
          console.warn(`⚠️ Could not get schema for table ${table.name}: ${error.message}`);
        }
      }

      // Step 3: Analyze linked record fields in each table
      this.detectedRelationships = [];
      for (const [tableName, schema] of this.tableSchemas) {
        await this.analyzeTableRelationships(tableName, schema);
      }

      // Step 4: Detect many-to-many relationships from bidirectional links
      await this.detectManyToManyRelationships();

      console.log(`✅ Relationship analysis complete. Found ${this.detectedRelationships.length} relationships`);
      
      // Log summary of detected relationships
      this.logRelationshipSummary();
      
      return this.detectedRelationships;
    } catch (error) {
      console.error('❌ Error during relationship analysis:', error.message);
      throw error;
    }
  }

  /**
   * Analyzes relationships for a specific table by examining its linked record fields
   * @param {string} tableName - Name of the table to analyze
   * @param {Object} schema - Table schema from Airtable Metadata API
   */
  async analyzeTableRelationships(tableName, schema) {
    console.log(`🔍 Analyzing relationships for table: ${tableName}`);
    
    if (!schema.fields || schema.fields.length === 0) {
      console.log(`⚠️ No fields found for table ${tableName}`);
      return;
    }

    // Find all linked record fields in this table
    const linkedFields = schema.fields.filter(field => 
      field.type === 'multipleRecordLinks' || field.type === 'singleRecordLink'
    );

    console.log(`🔗 Found ${linkedFields.length} linked record fields in ${tableName}`);

    for (const field of linkedFields) {
      await this.analyzeLinkedField(tableName, field);
    }
  }

  /**
   * Analyzes a specific linked record field to determine relationship characteristics
   * @param {string} sourceTableName - Name of the source table
   * @param {Object} field - Airtable field definition for the linked record field
   */
  async analyzeLinkedField(sourceTableName, field) {
    try {
      console.log(`🔗 Analyzing linked field: ${sourceTableName}.${field.name}`);
      
      // Extract target table information from field options
      const targetTableId = field.options?.linkedTableId;
      if (!targetTableId) {
        console.warn(`⚠️ No linked table ID found for field ${field.name}`);
        return;
      }

      // Find the target table name from our cached schemas
      const targetTableName = this.findTableNameById(targetTableId);
      if (!targetTableName) {
        console.warn(`⚠️ Could not find target table name for ID ${targetTableId}`);
        return;
      }

      // Convert table and field names to snake_case for PostgreSQL
      const sourceTable = sanitizeTableName(toSnakeCase(sourceTableName));
      const targetTable = sanitizeTableName(toSnakeCase(targetTableName));
      const sourceColumn = sanitizeColumnName(toSnakeCase(field.name));

      // Determine relationship type based on field configuration
      const relationshipType = this.determineRelationshipType(field, sourceTableName, targetTableName);
      
      // Analyze cardinality by examining the inverse relationship
      const cardinality = await this.analyzeCardinality(sourceTableName, targetTableName, field);

      // Create the relationship object
      const relationship = new DatabaseRelationship({
        sourceTable,
        sourceColumn,
        targetTable,
        targetColumn: 'id', // Default to primary key
        relationshipType,
        cardinality,
        isRequired: field.options?.isRequired || false
      });

      this.detectedRelationships.push(relationship);
      
      console.log(`✅ Detected relationship: ${sourceTable}.${sourceColumn} → ${targetTable}.id (${relationshipType})`);
      
    } catch (error) {
      console.error(`❌ Error analyzing linked field ${field.name}:`, error.message);
    }
  }

  /**
   * Determines the type of relationship based on field configuration and inverse analysis
   * @param {Object} field - Airtable linked record field
   * @param {string} sourceTableName - Name of the source table
   * @param {string} targetTableName - Name of the target table
   * @returns {string} Relationship type: 'one-to-one', 'one-to-many', or 'many-to-many'
   */
  determineRelationshipType(field, sourceTableName, targetTableName) {
    // Check if this is a single or multiple record link
    const isMultiple = field.type === 'multipleRecordLinks';
    
    // Check for inverse relationship to determine full cardinality
    const targetSchema = this.tableSchemas.get(targetTableName);
    const inverseField = this.findInverseField(targetSchema, sourceTableName, field.options?.inverseLinkFieldId);
    
    if (inverseField) {
      const inverseIsMultiple = inverseField.type === 'multipleRecordLinks';
      
      if (!isMultiple && !inverseIsMultiple) {
        return 'one-to-one';
      } else if (!isMultiple && inverseIsMultiple) {
        return 'many-to-one';  // Many records in target can link to one in source
      } else if (isMultiple && !inverseIsMultiple) {
        return 'one-to-many';  // One record in source can link to many in target
      } else {
        return 'many-to-many'; // Both sides allow multiple records
      }
    }
    
    // If no inverse field found, make best guess based on field type
    return isMultiple ? 'one-to-many' : 'many-to-one';
  }

  /**
   * Analyzes the cardinality of a relationship by examining data patterns
   * @param {string} sourceTableName - Name of the source table
   * @param {string} targetTableName - Name of the target table
   * @param {Object} field - Airtable linked record field
   * @returns {Promise<Object>} Cardinality analysis results
   */
  async analyzeCardinality(sourceTableName, targetTableName, field) {
    // This could be enhanced to sample actual data to determine real cardinality
    // For now, we'll use the field configuration as the basis
    
    return {
      sourceMin: field.options?.isRequired ? 1 : 0,
      sourceMax: field.type === 'multipleRecordLinks' ? 'N' : 1,
      targetMin: 0, // Would need inverse field analysis
      targetMax: 'N', // Would need inverse field analysis
      confidence: 'medium' // Based on field config only, not data analysis
    };
  }

  /**
   * Finds the inverse linked record field in the target table
   * @param {Object} targetSchema - Schema of the target table
   * @param {string} sourceTableName - Name of the source table
   * @param {string} inverseLinkFieldId - ID of the inverse field (if available)
   * @returns {Object|null} Inverse field definition or null if not found
   */
  findInverseField(targetSchema, sourceTableName, inverseLinkFieldId) {
    if (!targetSchema || !targetSchema.fields) {
      return null;
    }

    // If we have the inverse field ID, find it directly
    if (inverseLinkFieldId) {
      return targetSchema.fields.find(field => field.id === inverseLinkFieldId);
    }

    // Otherwise, look for linked record fields that point back to the source table
    const sourceTableId = this.findTableIdByName(sourceTableName);
    if (!sourceTableId) {
      return null;
    }

    return targetSchema.fields.find(field => 
      (field.type === 'multipleRecordLinks' || field.type === 'singleRecordLink') &&
      field.options?.linkedTableId === sourceTableId
    );
  }

  /**
   * Detects many-to-many relationships that require junction tables
   * @returns {Promise<void>}
   */
  async detectManyToManyRelationships() {
    console.log('🔍 Analyzing for many-to-many relationships...');
    
    const manyToManyRelationships = this.detectedRelationships.filter(rel => 
      rel.relationshipType === 'many-to-many'
    );

    console.log(`📋 Found ${manyToManyRelationships.length} many-to-many relationships`);
    
    // For each many-to-many relationship, we might want to suggest junction table creation
    for (const relationship of manyToManyRelationships) {
      const junctionTableName = `${relationship.sourceTable}_${relationship.targetTable}`;
      console.log(`💡 Suggestion: Create junction table "${junctionTableName}" for many-to-many relationship`);
      
      // Add metadata to the relationship about the suggested junction table
      relationship.junctionTable = {
        name: junctionTableName,
        sourceColumn: `${relationship.sourceTable}_id`,
        targetColumn: `${relationship.targetTable}_id`
      };
    }
  }

  /**
   * Finds table name by table ID from cached schemas
   * @param {string} tableId - Airtable table ID
   * @returns {string|null} Table name or null if not found
   */
  findTableNameById(tableId) {
    for (const [tableName, schema] of this.tableSchemas) {
      if (schema.id === tableId) {
        return tableName;
      }
    }
    return null;
  }

  /**
   * Finds table ID by table name from cached schemas
   * @param {string} tableName - Table name
   * @returns {string|null} Table ID or null if not found
   */
  findTableIdByName(tableName) {
    const schema = this.tableSchemas.get(tableName);
    return schema ? schema.id : null;
  }

  /**
   * Logs a summary of all detected relationships for debugging
   */
  logRelationshipSummary() {
    console.log('\n📊 RELATIONSHIP ANALYSIS SUMMARY');
    console.log('=====================================');
    
    const relationshipTypes = {
      'one-to-one': 0,
      'one-to-many': 0,
      'many-to-one': 0,
      'many-to-many': 0
    };

    this.detectedRelationships.forEach(rel => {
      relationshipTypes[rel.relationshipType] = (relationshipTypes[rel.relationshipType] || 0) + 1;
      console.log(`🔗 ${rel.sourceTable}.${rel.sourceColumn} → ${rel.targetTable}.${rel.targetColumn} (${rel.relationshipType})`);
    });

    console.log(`\n📈 Relationship Type Summary:`);
    Object.entries(relationshipTypes).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`   ${type}: ${count} relationships`);
      }
    });
    console.log('=====================================\n');
  }

  /**
   * Exports detected relationships as JSON for use by other components
   * @returns {Object} Complete relationship analysis data
   */
  exportRelationships() {
    return {
      relationships: this.detectedRelationships.map(rel => ({
        sourceTable: rel.sourceTable,
        sourceColumn: rel.sourceColumn,
        targetTable: rel.targetTable,
        targetColumn: rel.targetColumn,
        relationshipType: rel.relationshipType,
        cardinality: rel.cardinality,
        isRequired: rel.isRequired,
        constraintName: rel.constraintName,
        junctionTable: rel.junctionTable || null,
        sql: rel.toSQL()
      })),
      summary: {
        totalRelationships: this.detectedRelationships.length,
        relationshipTypes: this.detectedRelationships.reduce((acc, rel) => {
          acc[rel.relationshipType] = (acc[rel.relationshipType] || 0) + 1;
          return acc;
        }, {}),
        tablesAnalyzed: this.tableSchemas.size,
        timestamp: new Date().toISOString()
      }
    };
  }
}

module.exports = {
  RelationshipDetector,
  DatabaseRelationship
};