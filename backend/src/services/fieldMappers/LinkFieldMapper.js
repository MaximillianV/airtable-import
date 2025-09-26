/**
 * Link Field Mapper
 * 
 * Handles Airtable relationship field types:
 * - multipleRecordLinks (linkToAnotherRecord)
 * 
 * This mapper creates temporary array columns that will be processed
 * later by the Relationship Analyzer to create proper foreign keys
 * and junction tables.
 */

const BaseFieldMapper = require('./BaseFieldMapper');

class LinkFieldMapper extends BaseFieldMapper {
  constructor() {
    super();
    this.fieldType = 'link';
    this.supportedTypes = [
      'multipleRecordLinks'
    ];
  }

  /**
   * Maps link fields to temporary array columns
   * These will be processed later to create proper relationships
   */
  mapToPostgreSQLColumn(field) {
    const columnName = this.sanitizeFieldName(field.name);
    
    // Create temporary column to store the array of linked record IDs
    const tempColumnName = `_airtable_links_${columnName}`;

    return {
      name: tempColumnName,
      type: 'TEXT[]', // PostgreSQL array of text values
      nullable: true, // Link fields are always optional
      constraints: [],
      originalField: field,
      isTemporaryLinkField: true, // Flag to identify this as a link field
      originalColumnName: columnName // Store the intended final column name
    };
  }

  /**
   * Transform link field values to PostgreSQL array format
   */
  transformValue(value, field) {
    if (value === null || value === undefined) {
      return null;
    }

    // Airtable link fields return arrays of record IDs
    if (Array.isArray(value)) {
      // Filter out any null/undefined values and convert to strings
      const cleanedArray = value
        .filter(id => id !== null && id !== undefined && id !== '')
        .map(id => String(id));
      
      return cleanedArray.length > 0 ? cleanedArray : null;
    }

    // Single value - convert to single-item array
    if (value !== null && value !== undefined && value !== '') {
      return [String(value)];
    }

    return null;
  }

  /**
   * Link fields don't need additional SQL at this stage
   * The relationship creation happens later
   */
  getAdditionalSQL(field) {
    return []; // No additional SQL needed for temporary link columns
  }

  /**
   * Analyzes link field configuration to determine relationship characteristics
   */
  analyzeLinkField(field) {
    const analysis = {
      fieldName: field.name,
      fieldId: field.id,
      linkedTableId: field.options?.linkedTableId,
      inverseLinkFieldId: field.options?.inverseLinkFieldId,
      prefersSingleRecordLink: field.options?.prefersSingleRecordLink || false,
      isReversed: field.options?.isReversed || false,
      originalField: field
    };

    return analysis;
  }

  /**
   * Determines the potential relationship type based on field configuration
   */
  predictRelationshipType(field, dataAnalysis = null) {
    // Use field configuration first
    if (field.options?.prefersSingleRecordLink) {
      return 'one-to-one-or-many'; // Could be 1:1 or 1:M depending on reverse
    }

    // If we have data analysis, use it
    if (dataAnalysis) {
      const maxLinksPerRecord = Math.max(...dataAnalysis.linkCounts);
      if (maxLinksPerRecord <= 1) {
        return 'one-to-one-or-many';
      } else {
        return 'one-to-many';
      }
    }

    // Default assumption
    return 'one-to-many';
  }

  /**
   * Link fields are always nullable
   */
  isNullable(field) {
    return true;
  }
}

module.exports = LinkFieldMapper;