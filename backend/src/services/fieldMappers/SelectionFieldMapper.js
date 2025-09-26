/**
 * Boolean and Selection Field Mapper
 * 
 * Handles Airtable selection-based field types:
 * - checkbox
 * - singleSelect
 * - multipleSelect
 * 
 * For simplicity, we'll create junction tables for ALL selections
 * instead of using ENUMs, as requested.
 */

const BaseFieldMapper = require('./BaseFieldMapper');

class SelectionFieldMapper extends BaseFieldMapper {
  constructor() {
    super();
    this.fieldType = 'selection';
    this.supportedTypes = [
      'checkbox',
      'singleSelect',
      'multipleSelect'
    ];
  }

  /**
   * Maps selection fields to appropriate PostgreSQL column types
   */
  mapToPostgreSQLColumn(field) {
    const columnName = this.sanitizeFieldName(field.name);

    switch (field.type) {
      case 'checkbox':
        return {
          name: columnName,
          type: 'BOOLEAN',
          nullable: true,
          constraints: [],
          originalField: field
        };

      case 'singleSelect':
        // Create temporary column to store selected option
        return {
          name: `_airtable_select_${columnName}`,
          type: 'TEXT',
          nullable: true,
          constraints: [],
          originalField: field,
          isTemporarySelectField: true,
          originalColumnName: columnName,
          selectOptions: field.options?.choices || []
        };

      case 'multipleSelect':
        // Create temporary array column to store multiple selections
        return {
          name: `_airtable_multiselect_${columnName}`,
          type: 'TEXT[]',
          nullable: true,
          constraints: [],
          originalField: field,
          isTemporaryMultiSelectField: true,
          originalColumnName: columnName,
          selectOptions: field.options?.choices || []
        };

      default:
        return {
          name: columnName,
          type: 'TEXT',
          nullable: true,
          constraints: [],
          originalField: field
        };
    }
  }

  /**
   * Transform selection field values
   */
  transformValue(value, field) {
    if (value === null || value === undefined) {
      return null;
    }

    switch (field.type) {
      case 'checkbox':
        return Boolean(value);

      case 'singleSelect':
        // Return the selected option name
        if (typeof value === 'object' && value.name) {
          return value.name;
        }
        return String(value);

      case 'multipleSelect':
        // Return array of selected option names
        if (Array.isArray(value)) {
          return value.map(option => {
            if (typeof option === 'object' && option.name) {
              return option.name;
            }
            return String(option);
          }).filter(option => option !== null && option !== '');
        }
        return null;

      default:
        return String(value);
    }
  }

  /**
   * Generate additional SQL for selection fields
   */
  getAdditionalSQL(field) {
    const sql = [];
    
    // For single and multiple select, we'll create junction tables later
    // during the relationship analysis phase
    
    return sql;
  }

  /**
   * Analyzes selection field for junction table creation
   */
  analyzeSelectField(field) {
    const analysis = {
      fieldName: field.name,
      fieldType: field.type,
      isSelectionField: true,
      originalField: field
    };

    if (field.type === 'singleSelect' || field.type === 'multipleSelect') {
      analysis.selectOptions = field.options?.choices || [];
      analysis.needsJunctionTable = true;
      analysis.junctionTableName = `${this.sanitizeFieldName(field.tableName)}_${this.sanitizeFieldName(field.name)}_options`;
      analysis.optionsTableName = `${this.sanitizeFieldName(field.name)}_options`;
    }

    return analysis;
  }

  /**
   * Generates junction table creation plan for select fields
   */
  generateJunctionTablePlan(field, tableName) {
    if (field.type !== 'singleSelect' && field.type !== 'multipleSelect') {
      return null;
    }

    const cleanTableName = this.sanitizeFieldName(tableName);
    const cleanFieldName = this.sanitizeFieldName(field.name);
    const optionsTableName = `${cleanFieldName}_options`;
    const junctionTableName = `${cleanTableName}_${cleanFieldName}_selections`;

    return {
      fieldName: field.name,
      fieldType: field.type,
      optionsTableName,
      junctionTableName,
      sourceTableName: cleanTableName,
      selectOptions: field.options?.choices || [],
      sql: {
        createOptionsTable: `
          CREATE TABLE IF NOT EXISTS "${optionsTableName}" (
            id SERIAL PRIMARY KEY,
            option_value TEXT NOT NULL UNIQUE,
            option_color TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `,
        createJunctionTable: field.type === 'multipleSelect' ? `
          CREATE TABLE IF NOT EXISTS "${junctionTableName}" (
            id SERIAL PRIMARY KEY,
            ${cleanTableName}_id INTEGER NOT NULL,
            option_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            FOREIGN KEY (${cleanTableName}_id) REFERENCES "${cleanTableName}" (id),
            FOREIGN KEY (option_id) REFERENCES "${optionsTableName}" (id),
            UNIQUE(${cleanTableName}_id, option_id)
          )
        ` : null, // Single select uses direct foreign key
        addForeignKeyColumn: field.type === 'singleSelect' ? `
          ALTER TABLE "${cleanTableName}" 
          ADD COLUMN IF NOT EXISTS "${cleanFieldName}_option_id" INTEGER,
          ADD CONSTRAINT "fk_${cleanTableName}_${cleanFieldName}_option" 
          FOREIGN KEY ("${cleanFieldName}_option_id") 
          REFERENCES "${optionsTableName}" (id)
        ` : null,
        populateOptions: `
          INSERT INTO "${optionsTableName}" (option_value, option_color)
          VALUES ${field.options?.choices?.map(choice => 
            `('${choice.name.replace(/'/g, "''")}', '${choice.color || ''}')`
          ).join(', ')} 
          ON CONFLICT (option_value) DO NOTHING
        `
      }
    };
  }
}

module.exports = SelectionFieldMapper;