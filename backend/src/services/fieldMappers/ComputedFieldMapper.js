/**
 * Computed Field Mapper
 * 
 * Handles Airtable computed field types:
 * - formula
 * - lookup
 * - rollup
 * - count
 * 
 * These fields are computed from other data, so we store their
 * materialized values and potentially create views later.
 */

const BaseFieldMapper = require('./BaseFieldMapper');

class ComputedFieldMapper extends BaseFieldMapper {
  constructor() {
    super();
    this.fieldType = 'computed';
    this.supportedTypes = [
      'formula',
      'lookup',
      'rollup', 
      'count'
    ];
  }

  /**
   * Maps computed fields to appropriate PostgreSQL column types
   * We store the materialized values from Airtable
   */
  mapToPostgreSQLColumn(field) {
    const columnName = this.sanitizeFieldName(field.name);
    let columnType;
    let constraints = [];

    switch (field.type) {
      case 'count':
        columnType = 'INTEGER';
        constraints.push(`CHECK (${columnName} >= 0)`); // Count can't be negative
        break;
        
      case 'formula':
        // Formula result type depends on the formula
        columnType = this.determineFormulaType(field);
        break;
        
      case 'lookup':
        // Lookup type depends on the source field
        columnType = this.determineLookupType(field);
        break;
        
      case 'rollup':
        // Rollup type depends on the aggregation function
        columnType = this.determineRollupType(field);
        break;
        
      default:
        columnType = 'TEXT'; // Safe fallback
    }

    return {
      name: columnName,
      type: columnType,
      nullable: true, // Computed fields can often be null
      constraints,
      originalField: field,
      isComputedField: true // Flag to identify computed fields
    };
  }

  /**
   * Determine PostgreSQL type for formula fields
   */
  determineFormulaType(field) {
    // Try to infer from formula options or use TEXT as fallback
    if (field.options?.result?.type) {
      switch (field.options.result.type) {
        case 'number':
          return 'DECIMAL(15,4)';
        case 'text':
          return 'TEXT';
        case 'date':
          return 'DATE';
        case 'dateTime':
          return 'TIMESTAMP';
        case 'checkbox':
          return 'BOOLEAN';
        default:
          return 'TEXT';
      }
    }
    return 'TEXT'; // Safe fallback
  }

  /**
   * Determine PostgreSQL type for lookup fields
   */
  determineLookupType(field) {
    // Lookup fields can return arrays if multiple records match
    // Store as TEXT for now, could be enhanced to detect array types
    return 'TEXT';
  }

  /**
   * Determine PostgreSQL type for rollup fields
   */
  determineRollupType(field) {
    // Rollup type depends on the aggregation function
    if (field.options?.aggregationFunction) {
      switch (field.options.aggregationFunction) {
        case 'COUNT':
        case 'COUNT_DISTINCT':
          return 'INTEGER';
        case 'SUM':
        case 'AVG':
        case 'MAX':
        case 'MIN':
          return 'DECIMAL(15,4)';
        case 'CONCAT':
          return 'TEXT';
        default:
          return 'TEXT';
      }
    }
    return 'TEXT'; // Safe fallback
  }

  /**
   * Transform computed field values
   */
  transformValue(value, field) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    switch (field.type) {
      case 'count':
        return parseInt(value, 10);
        
      case 'formula':
        return this.transformFormulaValue(value, field);
        
      case 'lookup':
        return this.transformLookupValue(value, field);
        
      case 'rollup':
        return this.transformRollupValue(value, field);
        
      default:
        return String(value);
    }
  }

  /**
   * Transform formula field values based on result type
   */
  transformFormulaValue(value, field) {
    if (field.options?.result?.type) {
      switch (field.options.result.type) {
        case 'number':
          return parseFloat(value);
        case 'checkbox':
          return Boolean(value);
        case 'date':
        case 'dateTime':
          return new Date(value).toISOString();
        default:
          return String(value);
      }
    }
    return String(value);
  }

  /**
   * Transform lookup field values
   */
  transformLookupValue(value, field) {
    // Lookup can return arrays
    if (Array.isArray(value)) {
      return value.join(', '); // Join array values with comma
    }
    return String(value);
  }

  /**
   * Transform rollup field values
   */
  transformRollupValue(value, field) {
    if (field.options?.aggregationFunction) {
      switch (field.options.aggregationFunction) {
        case 'COUNT':
        case 'COUNT_DISTINCT':
          return parseInt(value, 10);
        case 'SUM':
        case 'AVG':
        case 'MAX':
        case 'MIN':
          return parseFloat(value);
        default:
          return String(value);
      }
    }
    return String(value);
  }

  /**
   * Generate additional SQL for computed fields
   */
  getAdditionalSQL(field) {
    const columnName = this.sanitizeFieldName(field.name);
    const tableName = this.sanitizeFieldName(field.tableName);
    const sql = [];

    // Add comments to identify computed fields
    sql.push(`COMMENT ON COLUMN "${tableName}"."${columnName}" IS 'Computed field: ${field.type} - ${field.name}';`);

    // Create indexes for count fields (commonly queried)
    if (field.type === 'count') {
      sql.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_${columnName} ON "${tableName}" ("${columnName}");`);
    }

    return sql;
  }

  /**
   * Analyzes computed field configuration for potential view creation
   */
  analyzeComputedField(field) {
    return {
      fieldName: field.name,
      fieldType: field.type,
      isComputedField: true,
      canBecomeSQLView: this.canBecomeSQLView(field),
      dependencies: this.extractDependencies(field),
      originalField: field
    };
  }

  /**
   * Determines if this computed field could become a PostgreSQL view
   */
  canBecomeSQLView(field) {
    // For now, we'll store materialized values
    // In the future, we could create views for simpler formulas
    return false;
  }

  /**
   * Extract field dependencies for computed fields
   */
  extractDependencies(field) {
    const dependencies = [];

    if (field.type === 'lookup' && field.options) {
      dependencies.push({
        type: 'lookup',
        relationshipFieldId: field.options.relationshipFieldId,
        fieldIdInLinkedTable: field.options.fieldIdInLinkedTable
      });
    }

    if (field.type === 'rollup' && field.options) {
      dependencies.push({
        type: 'rollup',
        relationshipFieldId: field.options.relationshipFieldId,
        fieldIdInLinkedTable: field.options.fieldIdInLinkedTable,
        aggregationFunction: field.options.aggregationFunction
      });
    }

    return dependencies;
  }
}

module.exports = ComputedFieldMapper;