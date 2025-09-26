/**
 * Number Field Mapper
 * 
 * Handles all numeric Airtable field types:
 * - number
 * - currency
 * - percent
 * - rating
 * - autoNumber
 */

const BaseFieldMapper = require('./BaseFieldMapper');

class NumberFieldMapper extends BaseFieldMapper {
  constructor() {
    super();
    this.fieldType = 'number';
    this.supportedTypes = [
      'number',
      'currency',
      'percent', 
      'rating',
      'autoNumber'
    ];
  }

  /**
   * Maps numeric fields to appropriate PostgreSQL column types
   */
  mapToPostgreSQLColumn(field) {
    const columnName = this.sanitizeFieldName(field.name);
    let columnType;
    let constraints = [];

    switch (field.type) {
      case 'autoNumber':
        columnType = 'INTEGER';
        constraints.push('NOT NULL');
        break;
        
      case 'currency':
        // Use DECIMAL for currency to avoid floating point issues
        columnType = 'DECIMAL(15,2)'; // Up to 999,999,999,999.99
        break;
        
      case 'percent':
        // Store as decimal (0.0 to 1.0 for 0% to 100%)
        columnType = 'DECIMAL(5,4)'; // 0.0000 to 1.0000
        constraints.push('CHECK (' + columnName + ' >= 0 AND ' + columnName + ' <= 1)');
        break;
        
      case 'rating':
        columnType = 'INTEGER';
        // Get rating scale from field options
        const maxRating = field.options?.max || 5;
        constraints.push(`CHECK (${columnName} >= 1 AND ${columnName} <= ${maxRating})`);
        break;
        
      case 'number':
        // Determine if integer or decimal based on precision
        const precision = field.options?.precision || 0;
        if (precision === 0) {
          columnType = 'INTEGER';
        } else {
          // Use appropriate decimal precision
          const totalDigits = Math.max(10, precision + 5); // Ensure enough total digits
          columnType = `DECIMAL(${totalDigits},${precision})`;
        }
        break;
        
      default:
        columnType = 'DECIMAL(15,4)'; // Safe fallback
    }

    return {
      name: columnName,
      type: columnType,
      nullable: field.type === 'autoNumber' ? false : this.isNullable(field),
      constraints,
      originalField: field
    };
  }

  /**
   * Transform numeric values with proper type conversion
   */
  transformValue(value, field) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Handle different number types
    switch (field.type) {
      case 'autoNumber':
      case 'rating':
        return parseInt(value, 10);
        
      case 'percent':
        // Convert percentage to decimal (e.g., 85% -> 0.85)
        const percentValue = parseFloat(value);
        if (percentValue > 1) {
          // Assume it's in percentage format (85 instead of 0.85)
          return percentValue / 100;
        }
        return percentValue;
        
      case 'currency':
      case 'number':
        return parseFloat(value);
        
      default:
        return parseFloat(value);
    }
  }

  /**
   * Generate additional SQL for numeric fields
   */
  getAdditionalSQL(field) {
    const columnName = this.sanitizeFieldName(field.name);
    const tableName = this.sanitizeFieldName(field.tableName);
    const sql = [];

    // Create index for commonly queried numeric fields
    if (field.type === 'autoNumber' || 
        field.name.toLowerCase().includes('id') ||
        field.name.toLowerCase().includes('amount') ||
        field.name.toLowerCase().includes('price')) {
      sql.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_${columnName} ON "${tableName}" ("${columnName}");`);
    }

    return sql;
  }

  /**
   * Auto number fields should not be nullable
   */
  isNullable(field) {
    return field.type !== 'autoNumber';
  }
}

module.exports = NumberFieldMapper;