/**
 * Field Type Analyzer Service
 * 
 * Analyzes Airtable field types and provides configuration recommendations
 * for special field types that require custom PostgreSQL handling.
 * 
 * @author GitHub Copilot
 * @version 1.0.0
 */

class FieldTypeAnalyzer {
  constructor() {
    // Track analyzed schemas for caching
    this.cache = new Map();
  }

  /**
   * Analyzes all field types in an Airtable schema and categorizes special fields
   * that need custom PostgreSQL handling (selects, lookups, collaborators, etc.)
   * 
   * @param {Object} schemaInfo - Complete Airtable schema information
   * @returns {Object} Categorized field analysis with handling recommendations
   */
  analyzeFieldTypes(schemaInfo) {
    console.log('🔧 Starting comprehensive field type analysis...');
    
    // Initialize analysis results structure
    const analysis = {
      singleSelects: [],
      multipleSelects: [],
      lookupValues: [],
      collaborators: [],
      attachments: [],
      formulas: [],
      rollups: [],
      dateTimeFields: [],
      numberFields: [],
      textFields: []
    };

    let totalFieldsAnalyzed = 0;

    // Process each table in the schema
    for (const table of schemaInfo.tables) {
      console.log(`🔍 Analyzing fields in table: ${table.name}`);
      
      for (const field of table.fields) {
        totalFieldsAnalyzed++;
        this.analyzeIndividualField(table, field, analysis);
      }
    }

    // Generate summary statistics
    const summary = this.generateSummary(analysis, totalFieldsAnalyzed, schemaInfo.tables.length);
    
    console.log(`🔧 Field analysis complete: ${totalFieldsAnalyzed} fields analyzed`);
    console.log(`📊 Special fields found: ${summary.totalSpecialFields}`);
    
    return {
      ...analysis,
      summary,
      insights: this.generateInsights(analysis, summary)
    };
  }

  /**
   * Analyzes an individual field and categorizes it based on its type
   * 
   * @param {Object} table - Table containing the field
   * @param {Object} field - Field to analyze
   * @param {Object} analysis - Analysis results object to populate
   */
  analyzeIndividualField(table, field, analysis) {
    const tableName = table.name;
    const fieldName = field.name;
    const fieldType = field.type;

    switch (fieldType) {
      case 'singleSelect':
        this.analyzeSingleSelectField(tableName, fieldName, field, analysis);
        break;
        
      case 'multipleSelects':
        this.analyzeMultipleSelectsField(tableName, fieldName, field, analysis);
        break;
        
      case 'multipleLookupValues':
        this.analyzeLookupField(tableName, fieldName, field, analysis, table);
        break;
        
      case 'multipleRecordLinks':
        // These are handled by the relationship detector
        // but we can note them for reference
        break;
        
      case 'singleCollaborator':
        this.analyzeCollaboratorField(tableName, fieldName, field, analysis, false);
        break;
        
      case 'multipleCollaborators':
        this.analyzeCollaboratorField(tableName, fieldName, field, analysis, true);
        break;
        
      case 'multipleAttachments':
        this.analyzeAttachmentField(tableName, fieldName, field, analysis);
        break;
        
      case 'formula':
        this.analyzeFormulaField(tableName, fieldName, field, analysis);
        break;
        
      case 'rollup':
        this.analyzeRollupField(tableName, fieldName, field, analysis);
        break;
        
      case 'dateTime':
      case 'date':
        this.analyzeDateTimeField(tableName, fieldName, field, analysis);
        break;
        
      case 'number':
      case 'currency':
      case 'percent':
      case 'duration':
        this.analyzeNumberField(tableName, fieldName, field, analysis);
        break;
        
      case 'singleLineText':
      case 'multilineText':
      case 'richText':
      case 'email':
      case 'url':
      case 'phoneNumber':
        this.analyzeTextField(tableName, fieldName, field, analysis);
        break;
    }
  }

  /**
   * Analyzes single select fields and determines optimal PostgreSQL representation
   */
  analyzeSingleSelectField(tableName, fieldName, field, analysis) {
    const choices = field.options?.choices || [];
    const choiceCount = choices.length;
    
    // Determine recommended handling based on choice count and patterns
    let recommendedHandling = 'enum';
    let reasoning = 'Small number of choices, ideal for PostgreSQL ENUM';
    
    if (choiceCount > 20) {
      recommendedHandling = 'reference_table';
      reasoning = 'Large number of choices, reference table provides more flexibility';
    } else if (choiceCount > 50) {
      recommendedHandling = 'reference_table';
      reasoning = 'Very large number of choices, definitely needs reference table';
    }

    analysis.singleSelects.push({
      tableName,
      fieldName,
      choices,
      choiceCount,
      recommendedHandling,
      reasoning,
      sqlPreview: this.generateSingleSelectSQL(tableName, fieldName, choices, recommendedHandling)
    });
  }

  /**
   * Analyzes multiple select fields (always require junction tables)
   */
  analyzeMultipleSelectsField(tableName, fieldName, field, analysis) {
    const choices = field.options?.choices || [];
    
    analysis.multipleSelects.push({
      tableName,
      fieldName,
      choices,
      choiceCount: choices.length,
      requiresJunctionTable: true,
      recommendedHandling: 'junction_table',
      reasoning: 'Multiple selections require many-to-many relationship via junction table',
      sqlPreview: this.generateMultipleSelectSQL(tableName, fieldName, choices)
    });
  }

  /**
   * Analyzes lookup fields (computed values from linked records)
   */
  analyzeLookupField(tableName, fieldName, field, analysis, table) {
    const options = field.options || {};
    const recordLinkFieldId = options.recordLinkFieldId;
    const fieldIdInLinkedTable = options.fieldIdInLinkedTable;
    
    // Find the source field name from the current table
    let sourceField = 'unknown';
    const sourceFieldObj = table.fields.find(f => f.id === recordLinkFieldId);
    if (sourceFieldObj) {
      sourceField = sourceFieldObj.name;
    }

    analysis.lookupValues.push({
      tableName,
      fieldName,
      sourceField,
      targetFieldId: fieldIdInLinkedTable,
      recommendedHandling: 'view',
      reasoning: 'Lookup values are computed fields, best implemented as PostgreSQL views',
      requiresView: true,
      sqlPreview: this.generateLookupSQL(tableName, fieldName, sourceField)
    });
  }

  /**
   * Analyzes collaborator fields (user references)
   */
  analyzeCollaboratorField(tableName, fieldName, field, analysis, isMultiple) {
    const handling = isMultiple ? 'junction_table' : 'user_reference';
    const reasoning = isMultiple 
      ? 'Multiple collaborators require many-to-many relationship with users table'
      : 'Single collaborator can use direct foreign key to users table';

    analysis.collaborators.push({
      tableName,
      fieldName,
      isMultiple,
      recommendedHandling: handling,
      reasoning,
      requiresUserTable: true,
      sqlPreview: this.generateCollaboratorSQL(tableName, fieldName, isMultiple)
    });
  }

  /**
   * Analyzes attachment fields
   */
  analyzeAttachmentField(tableName, fieldName, field, analysis) {
    analysis.attachments.push({
      tableName,
      fieldName,
      recommendedHandling: 'attachments_table',
      reasoning: 'File attachments require separate table to store file metadata and URLs',
      requiresAttachmentsTable: true,
      sqlPreview: this.generateAttachmentSQL(tableName, fieldName)
    });
  }

  /**
   * Analyzes formula fields
   */
  analyzeFormulaField(tableName, fieldName, field, analysis) {
    const formula = field.options?.formula || '';
    
    analysis.formulas.push({
      tableName,
      fieldName,
      formula,
      recommendedHandling: 'computed_column',
      reasoning: 'Formulas should be implemented as PostgreSQL computed columns or views',
      requiresComputation: true
    });
  }

  /**
   * Analyzes rollup fields
   */
  analyzeRollupField(tableName, fieldName, field, analysis) {
    analysis.rollups.push({
      tableName,
      fieldName,
      recommendedHandling: 'aggregate_view',
      reasoning: 'Rollups are aggregate computations, best implemented as PostgreSQL views with GROUP BY',
      requiresView: true
    });
  }

  /**
   * Analyzes date/time fields
   */
  analyzeDateTimeField(tableName, fieldName, field, analysis) {
    const includeTime = field.options?.includeTime !== false;
    const dateFormat = field.options?.dateFormat || 'local';
    const timeFormat = field.options?.timeFormat || '12hour';
    const timeZone = field.options?.timeZone || 'client';

    analysis.dateTimeFields.push({
      tableName,
      fieldName,
      includeTime,
      dateFormat,
      timeFormat,
      timeZone,
      recommendedType: includeTime ? 'TIMESTAMPTZ' : 'DATE',
      reasoning: includeTime 
        ? 'DateTime field should use TIMESTAMPTZ to preserve timezone information'
        : 'Date-only field can use PostgreSQL DATE type'
    });
  }

  /**
   * Analyzes number fields
   */
  analyzeNumberField(tableName, fieldName, field, analysis) {
    const precision = field.options?.precision || 0;
    const format = field.type; // number, currency, percent, duration
    
    let recommendedType = 'NUMERIC';
    let reasoning = 'NUMERIC type provides precise decimal arithmetic';
    
    if (precision === 0) {
      recommendedType = 'INTEGER';
      reasoning = 'Integer values can use PostgreSQL INTEGER type';
    } else if (format === 'currency') {
      recommendedType = 'DECIMAL(10,2)';
      reasoning = 'Currency values should use DECIMAL with 2 decimal places';
    }

    analysis.numberFields.push({
      tableName,
      fieldName,
      precision,
      format,
      recommendedType,
      reasoning
    });
  }

  /**
   * Analyzes text fields
   */
  analyzeTextField(tableName, fieldName, field, analysis) {
    const fieldType = field.type;
    
    let recommendedType = 'TEXT';
    let reasoning = 'TEXT type handles variable-length strings efficiently';
    
    if (fieldType === 'singleLineText' || fieldType === 'email' || fieldType === 'url') {
      recommendedType = 'VARCHAR(255)';
      reasoning = 'Single-line text fields can use VARCHAR with reasonable limit';
    } else if (fieldType === 'phoneNumber') {
      recommendedType = 'VARCHAR(20)';
      reasoning = 'Phone numbers have predictable maximum length';
    }

    analysis.textFields.push({
      tableName,
      fieldName,
      fieldType,
      recommendedType,
      reasoning,
      hasValidation: ['email', 'url', 'phoneNumber'].includes(fieldType)
    });
  }

  /**
   * Generates summary statistics for the field analysis
   */
  generateSummary(analysis, totalFields, totalTables) {
    return {
      totalFields,
      totalTables,
      totalSpecialFields: 
        analysis.singleSelects.length +
        analysis.multipleSelects.length +
        analysis.lookupValues.length +
        analysis.collaborators.length +
        analysis.attachments.length +
        analysis.formulas.length +
        analysis.rollups.length,
      singleSelectCount: analysis.singleSelects.length,
      multipleSelectCount: analysis.multipleSelects.length,
      lookupValueCount: analysis.lookupValues.length,
      collaboratorCount: analysis.collaborators.length,
      attachmentCount: analysis.attachments.length,
      formulaCount: analysis.formulas.length,
      rollupCount: analysis.rollups.length,
      dateTimeCount: analysis.dateTimeFields.length,
      numberCount: analysis.numberFields.length,
      textCount: analysis.textFields.length,
      requiresUserTable: analysis.collaborators.length > 0,
      junctionTablesNeeded: analysis.multipleSelects.length + 
        analysis.collaborators.filter(c => c.isMultiple).length,
      viewsNeeded: analysis.lookupValues.length + analysis.rollups.length + analysis.formulas.length
    };
  }

  /**
   * Generates insights and recommendations based on the analysis
   */
  generateInsights(analysis, summary) {
    const insights = [];

    if (summary.singleSelectCount > 0) {
      const enumCount = analysis.singleSelects.filter(s => s.recommendedHandling === 'enum').length;
      const refTableCount = analysis.singleSelects.filter(s => s.recommendedHandling === 'reference_table').length;
      
      insights.push(`Found ${summary.singleSelectCount} single select fields: ${enumCount} can use PostgreSQL ENUMs, ${refTableCount} need reference tables`);
    }

    if (summary.multipleSelectCount > 0) {
      insights.push(`Found ${summary.multipleSelectCount} multiple select fields requiring junction tables`);
    }

    if (summary.lookupValueCount > 0) {
      insights.push(`Found ${summary.lookupValueCount} lookup fields that should be implemented as PostgreSQL views`);
    }

    if (summary.collaboratorCount > 0) {
      insights.push(`Found ${summary.collaboratorCount} collaborator fields requiring user management system`);
    }

    if (summary.attachmentCount > 0) {
      insights.push(`Found ${summary.attachmentCount} attachment fields requiring file storage tables`);
    }

    if (summary.formulaCount > 0) {
      insights.push(`Found ${summary.formulaCount} formula fields requiring computed columns or views`);
    }

    if (summary.rollupCount > 0) {
      insights.push(`Found ${summary.rollupCount} rollup fields requiring aggregate views`);
    }

    if (summary.requiresUserTable) {
      insights.push('A users/collaborators table will be needed for user references');
    }

    if (summary.junctionTablesNeeded > 0) {
      insights.push(`${summary.junctionTablesNeeded} junction tables will be created for many-to-many relationships`);
    }

    if (summary.viewsNeeded > 0) {
      insights.push(`${summary.viewsNeeded} PostgreSQL views will be created for computed fields`);
    }

    return insights;
  }

  /**
   * Generates SQL preview for single select fields
   */
  generateSingleSelectSQL(tableName, fieldName, choices, handling) {
    if (handling === 'enum') {
      const enumName = `${tableName}_${fieldName}_enum`.toLowerCase();
      const enumValues = choices.map(c => `'${c.name.replace(/'/g, "''")}'`).join(', ');
      
      return `-- Create ENUM type for ${tableName}.${fieldName}
CREATE TYPE ${enumName} AS ENUM (${enumValues});

-- Add column to table
ALTER TABLE "${tableName}" ADD COLUMN "${fieldName}" ${enumName};`;
    } else {
      return `-- Create reference table for ${tableName}.${fieldName}
CREATE TABLE "${tableName}_${fieldName}_options" (
  id SERIAL PRIMARY KEY,
  value VARCHAR(255) NOT NULL UNIQUE,
  color VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key column
ALTER TABLE "${tableName}" ADD COLUMN "${fieldName}_id" INTEGER REFERENCES "${tableName}_${fieldName}_options"(id);`;
    }
  }

  /**
   * Generates SQL preview for multiple select fields
   */
  generateMultipleSelectSQL(tableName, fieldName, choices) {
    return `-- Junction table for ${tableName}.${fieldName}
CREATE TABLE "${tableName}_${fieldName}" (
  "${tableName.toLowerCase()}_id" INTEGER REFERENCES "${tableName}"(id) ON DELETE CASCADE,
  option_value VARCHAR(255) NOT NULL,
  PRIMARY KEY ("${tableName.toLowerCase()}_id", option_value)
);

-- Index for performance
CREATE INDEX idx_${tableName.toLowerCase()}_${fieldName} ON "${tableName}_${fieldName}" ("${tableName.toLowerCase()}_id");`;
  }

  /**
   * Generates SQL preview for lookup fields
   */
  generateLookupSQL(tableName, fieldName, sourceField) {
    return `-- View for lookup field ${tableName}.${fieldName}
CREATE VIEW "${tableName}_${fieldName}_view" AS
SELECT 
  base.id,
  base.*,
  linked."${fieldName}" as "${fieldName}_lookup"
FROM "${tableName}" base
LEFT JOIN linked_table linked ON base."${sourceField}_id" = linked.id;`;
  }

  /**
   * Generates SQL preview for collaborator fields
   */
  generateCollaboratorSQL(tableName, fieldName, isMultiple) {
    if (isMultiple) {
      return `-- Junction table for multiple collaborators
CREATE TABLE "${tableName}_collaborators" (
  "${tableName.toLowerCase()}_id" INTEGER REFERENCES "${tableName}"(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY ("${tableName.toLowerCase()}_id", user_id)
);`;
    } else {
      return `-- Single collaborator reference
ALTER TABLE "${tableName}" ADD COLUMN "${fieldName}_id" INTEGER REFERENCES users(id);`;
    }
  }

  /**
   * Generates SQL preview for attachment fields
   */
  generateAttachmentSQL(tableName, fieldName) {
    return `-- Attachments table for ${tableName}.${fieldName}
CREATE TABLE "${tableName}_attachments" (
  id SERIAL PRIMARY KEY,
  "${tableName.toLowerCase()}_id" INTEGER REFERENCES "${tableName}"(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  size INTEGER,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_${tableName.toLowerCase()}_attachments ON "${tableName}_attachments" ("${tableName.toLowerCase()}_id");`;
  }
}

module.exports = FieldTypeAnalyzer;