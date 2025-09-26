/**
 * Base Field Mapper Class
 * 
 * Provides common functionality for all Airtable field type mappers.
 * Each specific field type extends this base class to implement:
 * - PostgreSQL column type mapping
 * - Data transformation during import
 * - Special handling requirements
 */

class BaseFieldMapper {
  constructor() {
    this.fieldType = 'base';
  }

  /**
   * Maps Airtable field to PostgreSQL column definition
   * @param {Object} field - Airtable field definition
   * @returns {Object} PostgreSQL column definition
   */
  mapToPostgreSQLColumn(field) {
    throw new Error('mapToPostgreSQLColumn must be implemented by subclass');
  }

  /**
   * Transforms raw Airtable data for PostgreSQL storage
   * @param {*} value - Raw value from Airtable
   * @param {Object} field - Airtable field definition
   * @returns {*} Transformed value for PostgreSQL
   */
  transformValue(value, field) {
    // Default: return as-is (most fields don't need transformation)
    return value;
  }

  /**
   * Validates if this mapper can handle the given field type
   * @param {string} fieldType - Airtable field type
   * @returns {boolean} True if this mapper handles this field type
   */
  canHandle(fieldType) {
    return this.supportedTypes.includes(fieldType);
  }

  /**
   * Generates any additional SQL needed for this field type
   * @param {Object} field - Airtable field definition
   * @returns {Array<string>} Array of SQL statements
   */
  getAdditionalSQL(field) {
    return []; // Most fields don't need additional SQL
  }

  /**
   * Sanitizes field name for PostgreSQL
   * @param {string} name - Original field name
   * @returns {string} PostgreSQL-safe column name
   */
  sanitizeFieldName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^(\d)/, '_$1') // Can't start with number
      .substring(0, 63); // PostgreSQL identifier limit
  }

  /**
   * Determines if field should be nullable
   * @param {Object} field - Airtable field definition
   * @returns {boolean} True if column should be nullable
   */
  isNullable(field) {
    // Most Airtable fields are nullable by default
    return true;
  }
}

module.exports = BaseFieldMapper;