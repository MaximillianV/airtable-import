/**
 * Text Field Mapper
 * 
 * Handles all text-based Airtable field types:
 * - singleLineText
 * - longText  
 * - richText
 * - email
 * - phone
 * - url
 */

const BaseFieldMapper = require('./BaseFieldMapper');

class TextFieldMapper extends BaseFieldMapper {
  constructor() {
    super();
    this.fieldType = 'text';
    this.supportedTypes = [
      'singleLineText',
      'longText', 
      'richText',
      'email',
      'phone',
      'url'
    ];
  }

  /**
   * Maps text fields to appropriate PostgreSQL column types
   */
  mapToPostgreSQLColumn(field) {
    const columnName = this.sanitizeFieldName(field.name);
    let columnType;
    let constraints = [];

    switch (field.type) {
      case 'singleLineText':
      case 'email':
      case 'phone':
        columnType = 'VARCHAR(255)';
        break;
        
      case 'url':
        columnType = 'TEXT'; // URLs can be very long
        break;
        
      case 'longText':
      case 'richText':
        columnType = 'TEXT';
        break;
        
      default:
        columnType = 'TEXT'; // Safe fallback
    }

    // Add email validation constraint
    if (field.type === 'email') {
      constraints.push(`CHECK (${columnName} ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$' OR ${columnName} IS NULL)`);
    }

    // Add URL validation constraint  
    if (field.type === 'url') {
      constraints.push(`CHECK (${columnName} ~ '^https?://' OR ${columnName} IS NULL)`);
    }

    return {
      name: columnName,
      type: columnType,
      nullable: this.isNullable(field),
      constraints,
      originalField: field
    };
  }

  /**
   * Transform text values - mostly pass-through with some cleanup
   */
  transformValue(value, field) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Convert to string and trim whitespace
    let stringValue = String(value).trim();

    // Handle rich text - strip HTML tags for now
    if (field.type === 'richText') {
      // Simple HTML tag removal (could be enhanced with proper HTML parser)
      stringValue = stringValue.replace(/<[^>]*>/g, '');
    }

    // Validate email format
    if (field.type === 'email') {
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
      if (!emailRegex.test(stringValue)) {
        console.warn(`Invalid email format: ${stringValue}, storing as-is`);
      }
    }

    // Validate URL format
    if (field.type === 'url') {
      if (!stringValue.startsWith('http://') && !stringValue.startsWith('https://')) {
        console.warn(`URL missing protocol: ${stringValue}, storing as-is`);
      }
    }

    return stringValue;
  }

  /**
   * Generate additional SQL for text fields (indexes, etc.)
   */
  getAdditionalSQL(field) {
    const columnName = this.sanitizeFieldName(field.name);
    const tableName = this.sanitizeFieldName(field.tableName);
    const sql = [];

    // Create index for email fields (commonly searched)
    if (field.type === 'email') {
      sql.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_${columnName} ON "${tableName}" ("${columnName}");`);
    }

    // Create index for single line text if it's likely to be searched
    if (field.type === 'singleLineText' && (
      field.name.toLowerCase().includes('name') ||
      field.name.toLowerCase().includes('title') ||
      field.name.toLowerCase().includes('code')
    )) {
      sql.push(`CREATE INDEX IF NOT EXISTS idx_${tableName}_${columnName} ON "${tableName}" ("${columnName}");`);
    }

    return sql;
  }
}

module.exports = TextFieldMapper;