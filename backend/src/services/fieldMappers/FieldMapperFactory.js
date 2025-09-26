/**
 * Field Mapper Factory
 * 
 * Central coordinator for all Airtable field type mappers.
 * Routes field types to appropriate mappers and provides
 * unified interface for field mapping operations.
 */

const TextFieldMapper = require('./TextFieldMapper');
const NumberFieldMapper = require('./NumberFieldMapper');
const DateFieldMapper = require('./DateFieldMapper');
const LinkFieldMapper = require('./LinkFieldMapper');
const ComputedFieldMapper = require('./ComputedFieldMapper');
const SelectionFieldMapper = require('./SelectionFieldMapper');

class FieldMapperFactory {
  constructor() {
    // Initialize all mappers
    this.mappers = [
      new TextFieldMapper(),
      new NumberFieldMapper(), 
      new DateFieldMapper(),
      new LinkFieldMapper(),
      new ComputedFieldMapper(),
      new SelectionFieldMapper()
    ];

    // Create field type to mapper lookup
    this.fieldTypeMap = new Map();
    this.mappers.forEach(mapper => {
      mapper.supportedTypes.forEach(type => {
        this.fieldTypeMap.set(type, mapper);
      });
    });
  }

  /**
   * Gets the appropriate mapper for a field type
   * @param {string} fieldType - Airtable field type
   * @returns {BaseFieldMapper|null} Appropriate mapper or null if not found
   */
  getMapper(fieldType) {
    return this.fieldTypeMap.get(fieldType) || null;
  }

  /**
   * Maps an Airtable field to PostgreSQL column definition
   * @param {Object} field - Airtable field definition
   * @param {string} tableName - Name of the table this field belongs to
   * @returns {Object} PostgreSQL column definition
   */
  mapField(field, tableName) {
    const mapper = this.getMapper(field.type);
    
    if (!mapper) {
      console.warn(`No mapper found for field type: ${field.type}, using TEXT as fallback`);
      return this.createFallbackColumn(field);
    }

    try {
      // Add table name to field for reference
      const fieldWithTable = { ...field, tableName };
      const columnDef = mapper.mapToPostgreSQLColumn(fieldWithTable);
      
      // Add metadata for tracking
      columnDef.mappedBy = mapper.fieldType;
      columnDef.airtableFieldType = field.type;
      
      return columnDef;
    } catch (error) {
      console.error(`Error mapping field ${field.name} of type ${field.type}:`, error.message);
      return this.createFallbackColumn(field);
    }
  }

  /**
   * Transforms a field value using the appropriate mapper
   * @param {*} value - Raw value from Airtable
   * @param {Object} field - Airtable field definition
   * @returns {*} Transformed value for PostgreSQL
   */
  transformValue(value, field) {
    const mapper = this.getMapper(field.type);
    
    if (!mapper) {
      // Fallback transformation - convert to string
      return value === null || value === undefined || value === '' ? null : String(value);
    }

    try {
      return mapper.transformValue(value, field);
    } catch (error) {
      console.error(`Error transforming value for field ${field.name}:`, error.message);
      // Return raw value as fallback
      return value;
    }
  }

  /**
   * Generates additional SQL for all fields
   * @param {Array} fields - Array of Airtable field definitions
   * @param {string} tableName - Name of the table
   * @returns {Array<string>} Array of SQL statements
   */
  generateAdditionalSQL(fields, tableName) {
    const sql = [];
    
    fields.forEach(field => {
      const mapper = this.getMapper(field.type);
      if (mapper) {
        try {
          const fieldWithTable = { ...field, tableName };
          const additionalSQL = mapper.getAdditionalSQL(fieldWithTable);
          sql.push(...additionalSQL);
        } catch (error) {
          console.error(`Error generating additional SQL for field ${field.name}:`, error.message);
        }
      }
    });

    return sql;
  }

  /**
   * Analyzes all fields for special processing needs
   * @param {Array} fields - Array of Airtable field definitions
   * @param {string} tableName - Name of the table
   * @returns {Object} Analysis results categorized by type
   */
  analyzeFields(fields, tableName) {
    const analysis = {
      linkFields: [],
      selectFields: [],
      computedFields: [],
      temporaryColumns: [],
      standardColumns: []
    };

    fields.forEach(field => {
      const mapper = this.getMapper(field.type);
      const fieldWithTable = { ...field, tableName };
      
      if (mapper instanceof LinkFieldMapper) {
        analysis.linkFields.push(mapper.analyzeLinkField(fieldWithTable));
      } else if (mapper instanceof SelectionFieldMapper && 
                 (field.type === 'singleSelect' || field.type === 'multipleSelect')) {
        analysis.selectFields.push(mapper.analyzeSelectField(fieldWithTable));
      } else if (mapper instanceof ComputedFieldMapper) {
        analysis.computedFields.push(mapper.analyzeComputedField(fieldWithTable));
      }

      // Categorize column types
      const columnDef = this.mapField(field, tableName);
      if (columnDef.isTemporaryLinkField || 
          columnDef.isTemporarySelectField || 
          columnDef.isTemporaryMultiSelectField) {
        analysis.temporaryColumns.push(columnDef);
      } else {
        analysis.standardColumns.push(columnDef);
      }
    });

    return analysis;
  }

  /**
   * Creates fallback column definition for unmapped field types
   * @param {Object} field - Airtable field definition
   * @returns {Object} Fallback column definition
   */
  createFallbackColumn(field) {
    const columnName = field.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^(\d)/, '_$1')
      .substring(0, 63);

    return {
      name: columnName,
      type: 'TEXT',
      nullable: true,
      constraints: [],
      originalField: field,
      mappedBy: 'fallback',
      airtableFieldType: field.type
    };
  }

  /**
   * Gets all supported field types across all mappers
   * @returns {Array<string>} Array of supported Airtable field types
   */
  getSupportedFieldTypes() {
    return Array.from(this.fieldTypeMap.keys()).sort();
  }

  /**
   * Gets statistics about field type coverage
   * @param {Array} fields - Array of Airtable field definitions
   * @returns {Object} Coverage statistics
   */
  getFieldTypeCoverage(fields) {
    const fieldTypeCounts = {};
    const supportedTypes = new Set(this.getSupportedFieldTypes());
    let supportedCount = 0;
    let unsupportedCount = 0;

    fields.forEach(field => {
      fieldTypeCounts[field.type] = (fieldTypeCounts[field.type] || 0) + 1;
      
      if (supportedTypes.has(field.type)) {
        supportedCount++;
      } else {
        unsupportedCount++;
      }
    });

    return {
      totalFields: fields.length,
      supportedFields: supportedCount,
      unsupportedFields: unsupportedCount,
      coveragePercentage: Math.round((supportedCount / fields.length) * 100),
      fieldTypeCounts,
      unsupportedTypes: Object.keys(fieldTypeCounts).filter(type => !supportedTypes.has(type))
    };
  }
}

module.exports = FieldMapperFactory;