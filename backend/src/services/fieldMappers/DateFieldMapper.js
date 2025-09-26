/**
 * Date Field Mapper
 * 
 * Handles all date/time Airtable field types:
 * - date
 * - dateTime  
 * - createdTime
 * - lastModifiedTime
 * - duration
 */

const BaseFieldMapper = require('./BaseFieldMapper');

class DateFieldMapper extends BaseFieldMapper {
  constructor() {
    super();
    this.fieldType = 'date';
    this.supportedTypes = [
      'date',
      'dateTime',
      'createdTime', 
      'lastModifiedTime',
      'duration'
    ];
  }

  /**
   * Maps date/time fields to appropriate PostgreSQL column types
   */
  mapToPostgreSQLColumn(field) {
    const columnName = this.sanitizeFieldName(field.name);
    let columnType;
    let constraints = [];

    switch (field.type) {
      case 'date':
        columnType = 'DATE';
        break;
        
      case 'dateTime':
      case 'createdTime':
      case 'lastModifiedTime':
        columnType = 'TIMESTAMP';
        break;
        
      case 'duration':
        // Store duration in seconds as integer
        columnType = 'INTEGER';
        constraints.push(`CHECK (${columnName} >= 0)`); // Duration can't be negative
        break;
        
      default:
        columnType = 'TIMESTAMP'; // Safe fallback
    }

    // System fields are typically not nullable
    const isSystemField = field.type === 'createdTime' || field.type === 'lastModifiedTime';

    return {
      name: columnName,
      type: columnType,
      nullable: isSystemField ? false : this.isNullable(field),
      constraints,
      originalField: field
    };
  }

  /**
   * Transform date/time values to PostgreSQL format
   */
  transformValue(value, field) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    switch (field.type) {
      case 'date':
        // Airtable date format: "2023-12-25"
        return this.parseDate(value);
        
      case 'dateTime':
      case 'createdTime':
      case 'lastModifiedTime':
        // Airtable datetime format: "2023-12-25T10:30:00.000Z"
        return this.parseDateTime(value);
        
      case 'duration':
        // Convert duration to seconds
        return this.parseDuration(value);
        
      default:
        return this.parseDateTime(value);
    }
  }

  /**
   * Parse date string to PostgreSQL DATE format
   */
  parseDate(value) {
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date value: ${value}, storing as null`);
        return null;
      }
      // Return YYYY-MM-DD format
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.warn(`Error parsing date ${value}:`, error.message);
      return null;
    }
  }

  /**
   * Parse datetime string to PostgreSQL TIMESTAMP format
   */
  parseDateTime(value) {
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        console.warn(`Invalid datetime value: ${value}, storing as null`);
        return null;
      }
      // Return ISO timestamp
      return date.toISOString();
    } catch (error) {
      console.warn(`Error parsing datetime ${value}:`, error.message);
      return null;
    }
  }

  /**
   * Parse duration to seconds
   */
  parseDuration(value) {
    try {
      // Airtable duration can be in various formats
      if (typeof value === 'number') {
        return Math.floor(value); // Assume it's already in seconds
      }
      
      if (typeof value === 'string') {
        // Try to parse common duration formats
        // "1:30:45" (H:M:S), "90:45" (M:S), "45" (seconds)
        const parts = value.split(':').map(p => parseInt(p, 10));
        
        if (parts.length === 3) { // H:M:S
          return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) { // M:S
          return parts[0] * 60 + parts[1];
        } else if (parts.length === 1) { // Seconds
          return parts[0];
        }
      }
      
      console.warn(`Unable to parse duration: ${value}, storing as null`);
      return null;
    } catch (error) {
      console.warn(`Error parsing duration ${value}:`, error.message);
      return null;
    }
  }

  /**
   * Generate additional SQL for date fields
   */
  getAdditionalSQL(field) {
    const columnName = this.sanitizeFieldName(field.name);
    const tableName = this.sanitizeFieldName(field.tableName);
    const sql = [];

    // Create indexes for date fields that are commonly used in queries
    if (field.type === 'createdTime' || 
        field.type === 'lastModifiedTime' ||
        field.name.toLowerCase().includes('date') ||
        field.name.toLowerCase().includes('created') ||
        field.name.toLowerCase().includes('modified')) {
      sql.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_${columnName} ON "${tableName}" ("${columnName}");`);
    }

    return sql;
  }

  /**
   * System date fields should not be nullable
   */
  isNullable(field) {
    return field.type !== 'createdTime' && field.type !== 'lastModifiedTime';
  }
}

module.exports = DateFieldMapper;