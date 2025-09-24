/**
 * Schema Generator Service
 * 
 * Generates PostgreSQL schema elements based on RelationshipWizard and FieldTypeAnalyzer configurations.
 * Creates relationships, ENUMs, junction tables, views, and other database structures.
 * 
 * @author GitHub Copilot
 * @version 1.0.0
 */

class SchemaGeneratorService {
  constructor(databaseService) {
    this.db = databaseService;
    this.generatedElements = {
      enums: [],
      referenceTables: [],
      junctionTables: [],
      foreignKeys: [],
      views: [],
      indexes: []
    };
  }

  /**
   * Applies complete schema configuration from the wizards to the database.
   * Creates all necessary relationships, field types, and database structures.
   * 
   * @param {Object} schemaConfig - Complete configuration from RelationshipWizard and FieldTypeAnalyzer
   * @param {string} sessionId - Import session ID for logging and progress tracking
   * @returns {Promise<Object>} Results of schema generation process
   */
  async applySchemaConfiguration(schemaConfig, sessionId) {
    console.log('🧙‍♂️ Starting schema generation with configuration:', {
      sessionId,
      hasMapping: !!schemaConfig?.mapping,
      hasRelationships: !!schemaConfig?.relationships,
      hasFieldTypes: !!schemaConfig?.fieldTypes,
      relationshipCount: schemaConfig?.relationships?.length || 0
    });

    try {
      const results = {
        success: true,
        elementsCreated: 0,
        errors: [],
        details: {
          enums: [],
          referenceTables: [],
          junctionTables: [],
          foreignKeys: [],
          views: [],
          indexes: []
        }
      };

      // Step 1: Create ENUMs for single select fields
      if (schemaConfig?.fieldTypes?.singleSelects) {
        console.log(`📋 Creating ${schemaConfig.fieldTypes.singleSelects.length} ENUM types...`);
        const enumResults = await this.createEnumTypes(schemaConfig.fieldTypes.singleSelects, sessionId);
        results.details.enums = enumResults;
        results.elementsCreated += enumResults.length;
      }

      // Step 2: Create reference tables for complex selects
      if (schemaConfig?.fieldTypes?.singleSelects) {
        console.log(`📊 Creating reference tables for select fields...`);
        const refTableResults = await this.createReferenceTables(schemaConfig.fieldTypes.singleSelects, sessionId);
        results.details.referenceTables = refTableResults;
        results.elementsCreated += refTableResults.length;
      }

      // Step 3: Create junction tables for many-to-many relationships and multiple selects
      const junctionTableSources = [
        ...(schemaConfig?.relationships?.filter(r => r.configuredType === 'many-to-many') || []),
        ...(schemaConfig?.fieldTypes?.multipleSelects || [])
      ];
      
      if (junctionTableSources.length > 0) {
        console.log(`🔗 Creating ${junctionTableSources.length} junction tables...`);
        const junctionResults = await this.createJunctionTables(junctionTableSources, sessionId);
        results.details.junctionTables = junctionResults;
        results.elementsCreated += junctionResults.length;
      }

      // Step 4: Create foreign key relationships
      const fkRelationships = schemaConfig?.relationships?.filter(r => 
        ['one-to-one', 'one-to-many', 'many-to-one'].includes(r.configuredType)
      ) || [];
      
      if (fkRelationships.length > 0) {
        console.log(`🔑 Creating ${fkRelationships.length} foreign key relationships...`);
        const fkResults = await this.createForeignKeys(fkRelationships, sessionId);
        results.details.foreignKeys = fkResults;
        results.elementsCreated += fkResults.length;
      }

      // Step 5: Create views for lookup fields and computed columns
      const viewSources = [
        ...(schemaConfig?.fieldTypes?.lookupValues || []),
        ...(schemaConfig?.fieldTypes?.formulas || []),
        ...(schemaConfig?.fieldTypes?.rollups || [])
      ];
      
      if (viewSources.length > 0) {
        console.log(`👁️ Creating ${viewSources.length} database views...`);
        const viewResults = await this.createViews(viewSources, sessionId);
        results.details.views = viewResults;
        results.elementsCreated += viewResults.length;
      }

      // Step 6: Create indexes for performance
      console.log(`📇 Creating performance indexes...`);
      const indexResults = await this.createPerformanceIndexes(schemaConfig, sessionId);
      results.details.indexes = indexResults;
      results.elementsCreated += indexResults.length;

      console.log(`✅ Schema generation complete: ${results.elementsCreated} elements created`);
      this.generatedElements = results.details;
      
      return results;

    } catch (error) {
      console.error('❌ Schema generation failed:', error.message);
      throw new Error(`Schema generation failed: ${error.message}`);
    }
  }

  /**
   * Creates PostgreSQL ENUM types for single select fields with small choice sets
   */
  async createEnumTypes(singleSelects, sessionId) {
    const results = [];
    
    for (const field of singleSelects) {
      if (field.recommendedHandling === 'enum' && field.choices && field.choices.length > 0) {
        try {
          const enumName = this.generateEnumName(field.tableName, field.fieldName);
          const enumValues = field.choices.map(choice => choice.name);
          
          console.log(`📋 Creating ENUM ${enumName} with values:`, enumValues);
          
          // Generate ENUM creation SQL
          const enumSQL = this.generateEnumSQL(enumName, enumValues);
          
          // Execute ENUM creation
          await this.db.query(enumSQL);
          
          // Add column to table with new ENUM type
          const alterSQL = `ALTER TABLE "${field.tableName}" ADD COLUMN IF NOT EXISTS "${field.fieldName}" ${enumName}`;
          await this.db.query(alterSQL);
          
          results.push({
            type: 'enum',
            name: enumName,
            table: field.tableName,
            field: field.fieldName,
            values: enumValues,
            sql: enumSQL + '; ' + alterSQL,
            success: true
          });
          
        } catch (error) {
          console.error(`❌ Failed to create ENUM for ${field.tableName}.${field.fieldName}:`, error.message);
          results.push({
            type: 'enum',
            table: field.tableName,
            field: field.fieldName,
            success: false,
            error: error.message
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Creates reference tables for single select fields with large choice sets
   */
  async createReferenceTables(singleSelects, sessionId) {
    const results = [];
    
    for (const field of singleSelects) {
      if (field.recommendedHandling === 'reference_table' && field.choices && field.choices.length > 0) {
        try {
          const refTableName = this.generateReferenceTableName(field.tableName, field.fieldName);
          
          console.log(`📊 Creating reference table ${refTableName} with ${field.choices.length} options`);
          
          // Create reference table
          const createTableSQL = this.generateReferenceTableSQL(refTableName, field.choices);
          await this.db.query(createTableSQL);
          
          // Insert choice values
          const insertSQL = this.generateReferenceInsertSQL(refTableName, field.choices);
          await this.db.query(insertSQL);
          
          // Add foreign key column to main table
          const alterSQL = `ALTER TABLE "${field.tableName}" ADD COLUMN IF NOT EXISTS "${field.fieldName}_id" INTEGER REFERENCES "${refTableName}"(id)`;
          await this.db.query(alterSQL);
          
          results.push({
            type: 'reference_table',
            name: refTableName,
            table: field.tableName,
            field: field.fieldName,
            choiceCount: field.choices.length,
            sql: createTableSQL + '; ' + insertSQL + '; ' + alterSQL,
            success: true
          });
          
        } catch (error) {
          console.error(`❌ Failed to create reference table for ${field.tableName}.${field.fieldName}:`, error.message);
          results.push({
            type: 'reference_table',
            table: field.tableName,
            field: field.fieldName,
            success: false,
            error: error.message
          });
        }
      }
    }
    
    return results;
  }

  /**
   * Creates junction tables for many-to-many relationships and multiple select fields
   */
  async createJunctionTables(junctionSources, sessionId) {
    const results = [];
    
    for (const source of junctionSources) {
      try {
        let junctionTableName, createSQL;
        
        if (source.configuredType === 'many-to-many') {
          // Many-to-many relationship junction table
          junctionTableName = this.generateJunctionTableName(source.sourceTable, source.targetTable);
          createSQL = this.generateRelationshipJunctionSQL(junctionTableName, source.sourceTable, source.targetTable);
          
        } else if (source.requiresJunctionTable) {
          // Multiple select field junction table
          junctionTableName = this.generateMultiSelectJunctionName(source.tableName, source.fieldName);
          createSQL = this.generateMultiSelectJunctionSQL(junctionTableName, source.tableName, source.fieldName);
        }
        
        if (junctionTableName && createSQL) {
          console.log(`🔗 Creating junction table ${junctionTableName}`);
          
          await this.db.query(createSQL);
          
          results.push({
            type: 'junction_table',
            name: junctionTableName,
            sourceTable: source.sourceTable || source.tableName,
            targetTable: source.targetTable || 'options',
            sql: createSQL,
            success: true
          });
        }
        
      } catch (error) {
        console.error(`❌ Failed to create junction table:`, error.message);
        results.push({
          type: 'junction_table',
          success: false,
          error: error.message,
          source
        });
      }
    }
    
    return results;
  }

  /**
   * Creates foreign key relationships for one-to-one, one-to-many, and many-to-one relationships
   */
  async createForeignKeys(relationships, sessionId) {
    const results = [];
    
    for (const relationship of relationships) {
      try {
        const constraintName = this.generateConstraintName(relationship.sourceTable, relationship.sourceColumn, relationship.targetTable);
        const alterSQL = this.generateForeignKeySQL(relationship, constraintName);
        
        console.log(`🔑 Creating foreign key constraint ${constraintName}`);
        
        await this.db.query(alterSQL);
        
        results.push({
          type: 'foreign_key',
          constraintName,
          sourceTable: relationship.sourceTable,
          sourceColumn: relationship.sourceColumn,
          targetTable: relationship.targetTable,
          targetColumn: relationship.targetColumn,
          relationshipType: relationship.configuredType,
          sql: alterSQL,
          success: true
        });
        
      } catch (error) {
        console.error(`❌ Failed to create foreign key for ${relationship.sourceTable}.${relationship.sourceColumn}:`, error.message);
        results.push({
          type: 'foreign_key',
          sourceTable: relationship.sourceTable,
          sourceColumn: relationship.sourceColumn,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Creates database views for lookup fields, formulas, and rollups
   */
  async createViews(viewSources, sessionId) {
    const results = [];
    
    for (const source of viewSources) {
      try {
        let viewName, createSQL;
        
        if (source.recommendedHandling === 'view') {
          // Lookup field view
          viewName = this.generateViewName(source.tableName, source.fieldName);
          createSQL = this.generateLookupViewSQL(viewName, source);
          
        } else if (source.recommendedHandling === 'computed_column') {
          // Formula field view
          viewName = this.generateViewName(source.tableName, source.fieldName);
          createSQL = this.generateFormulaViewSQL(viewName, source);
          
        } else if (source.recommendedHandling === 'aggregate_view') {
          // Rollup field view
          viewName = this.generateViewName(source.tableName, source.fieldName);
          createSQL = this.generateRollupViewSQL(viewName, source);
        }
        
        if (viewName && createSQL) {
          console.log(`👁️ Creating view ${viewName}`);
          
          await this.db.query(createSQL);
          
          results.push({
            type: 'view',
            name: viewName,
            table: source.tableName,
            field: source.fieldName,
            viewType: source.recommendedHandling,
            sql: createSQL,
            success: true
          });
        }
        
      } catch (error) {
        console.error(`❌ Failed to create view for ${source.tableName}.${source.fieldName}:`, error.message);
        results.push({
          type: 'view',
          table: source.tableName,
          field: source.fieldName,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Creates performance indexes for foreign keys and frequently queried columns
   */
  async createPerformanceIndexes(schemaConfig, sessionId) {
    const results = [];
    
    // Create indexes for foreign key columns
    const fkRelationships = schemaConfig?.relationships?.filter(r => 
      ['one-to-one', 'one-to-many', 'many-to-one'].includes(r.configuredType)
    ) || [];
    
    for (const relationship of fkRelationships) {
      try {
        const indexName = `idx_${relationship.sourceTable}_${relationship.sourceColumn}`.toLowerCase();
        const createIndexSQL = `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${relationship.sourceTable}" ("${relationship.sourceColumn}")`;
        
        await this.db.query(createIndexSQL);
        
        results.push({
          type: 'index',
          name: indexName,
          table: relationship.sourceTable,
          column: relationship.sourceColumn,
          purpose: 'foreign_key_performance',
          sql: createIndexSQL,
          success: true
        });
        
      } catch (error) {
        console.error(`❌ Failed to create index for ${relationship.sourceTable}.${relationship.sourceColumn}:`, error.message);
        results.push({
          type: 'index',
          table: relationship.sourceTable,
          column: relationship.sourceColumn,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  // SQL Generation Helper Methods

  generateEnumName(tableName, fieldName) {
    return `${tableName}_${fieldName}_enum`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }

  generateEnumSQL(enumName, values) {
    const escapedValues = values.map(value => `'${value.replace(/'/g, "''")}'`).join(', ');
    return `CREATE TYPE ${enumName} AS ENUM (${escapedValues})`;
  }

  generateReferenceTableName(tableName, fieldName) {
    return `${tableName}_${fieldName}_options`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  generateReferenceTableSQL(tableName, choices) {
    return `CREATE TABLE IF NOT EXISTS "${tableName}" (
      id SERIAL PRIMARY KEY,
      value VARCHAR(255) NOT NULL UNIQUE,
      color VARCHAR(20),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  }

  generateReferenceInsertSQL(tableName, choices) {
    const values = choices.map(choice => 
      `('${choice.name.replace(/'/g, "''")}', '${choice.color || '#gray'}')`
    ).join(', ');
    
    return `INSERT INTO "${tableName}" (value, color) VALUES ${values} ON CONFLICT (value) DO NOTHING`;
  }

  generateJunctionTableName(table1, table2) {
    return `${table1}_${table2}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  generateRelationshipJunctionSQL(junctionTableName, sourceTable, targetTable) {
    return `CREATE TABLE IF NOT EXISTS "${junctionTableName}" (
      "${sourceTable.toLowerCase()}_id" INTEGER REFERENCES "${sourceTable}"(id) ON DELETE CASCADE,
      "${targetTable.toLowerCase()}_id" INTEGER REFERENCES "${targetTable}"(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY ("${sourceTable.toLowerCase()}_id", "${targetTable.toLowerCase()}_id")
    )`;
  }

  generateMultiSelectJunctionName(tableName, fieldName) {
    return `${tableName}_${fieldName}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  generateMultiSelectJunctionSQL(junctionTableName, tableName, fieldName) {
    return `CREATE TABLE IF NOT EXISTS "${junctionTableName}" (
      "${tableName.toLowerCase()}_id" INTEGER REFERENCES "${tableName}"(id) ON DELETE CASCADE,
      option_value VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY ("${tableName.toLowerCase()}_id", option_value)
    )`;
  }

  generateConstraintName(sourceTable, sourceColumn, targetTable) {
    return `fk_${sourceTable}_${sourceColumn}_${targetTable}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }

  generateForeignKeySQL(relationship, constraintName) {
    return `ALTER TABLE "${relationship.sourceTable}" 
            ADD CONSTRAINT "${constraintName}" 
            FOREIGN KEY ("${relationship.sourceColumn}") 
            REFERENCES "${relationship.targetTable}"("${relationship.targetColumn || 'id'}")`;
  }

  generateViewName(tableName, fieldName) {
    return `${tableName}_${fieldName}_view`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  generateLookupViewSQL(viewName, source) {
    return `CREATE OR REPLACE VIEW "${viewName}" AS
      SELECT 
        base.id,
        base.*,
        linked."${source.fieldName}" as "${source.fieldName}_lookup"
      FROM "${source.tableName}" base
      LEFT JOIN "${source.targetTable || 'linked_table'}" linked 
        ON base."${source.sourceField}_id" = linked.id`;
  }

  generateFormulaViewSQL(viewName, source) {
    // Simplified formula view - would need actual formula parsing
    return `CREATE OR REPLACE VIEW "${viewName}" AS
      SELECT 
        id,
        *,
        -- Formula computation would go here
        'computed_value' as "${source.fieldName}_computed"
      FROM "${source.tableName}"`;
  }

  generateRollupViewSQL(viewName, source) {
    // Simplified rollup view - would need actual rollup logic
    return `CREATE OR REPLACE VIEW "${viewName}" AS
      SELECT 
        base.id,
        base.*,
        COUNT(related.*) as "${source.fieldName}_count"
      FROM "${source.tableName}" base
      LEFT JOIN related_table related ON base.id = related."${source.tableName.toLowerCase()}_id"
      GROUP BY base.id`;
  }

  /**
   * Gets a summary of all generated schema elements
   */
  getGenerationSummary() {
    return {
      totalElements: Object.values(this.generatedElements).reduce((sum, arr) => sum + arr.length, 0),
      enums: this.generatedElements.enums.length,
      referenceTables: this.generatedElements.referenceTables.length,
      junctionTables: this.generatedElements.junctionTables.length,
      foreignKeys: this.generatedElements.foreignKeys.length,
      views: this.generatedElements.views.length,
      indexes: this.generatedElements.indexes.length,
      details: this.generatedElements
    };
  }
}

module.exports = SchemaGeneratorService;