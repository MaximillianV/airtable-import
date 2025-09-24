/**
 * Database naming utilities for consistent snake_case conversion
 * Implements industry-standard database naming conventions
 * 
 * NAMING CONVENTION RULES:
 * 1. snake_case: All names converted to lowercase with underscores
 * 2. Singular tables: Following database best practices (user, not users)
 * 3. Reserved words: Only avoid SQL keywords that cause syntax errors
 * 4. Safe identifiers: Must start with letter, contain only alphanumeric + underscore
 */

/**
 * Converts any string to snake_case following database naming best practices
 * @param {string} str - Input string to convert
 * @returns {string} - snake_case version of the string
 */
function toSnakeCase(str) {
  if (!str || typeof str !== 'string') {
    return str;
  }

  return str
    // Replace spaces, hyphens, dots and other separators with underscore
    .replace(/[\s\-\.]+/g, '_')
    // Insert underscore before uppercase letters that follow lowercase letters
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    // Insert underscore before uppercase letters that follow numbers
    .replace(/([0-9])([A-Z])/g, '$1_$2')
    // Insert underscore between letters and numbers
    .replace(/([A-Za-z])([0-9])/g, '$1_$2')
    .replace(/([0-9])([A-Za-z])/g, '$1_$2')
    // Handle consecutive uppercase letters (e.g., XMLHttp -> XML_Http)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    // Replace any remaining special characters with underscore
    .replace(/[^a-zA-Z0-9_]/g, '_')
    // Convert to lowercase
    .toLowerCase()
    // Remove multiple consecutive underscores
    .replace(/_+/g, '_')
    // Remove leading/trailing underscores
    .replace(/^_+|_+$/g, '')
    // Ensure it doesn't start with a number (add prefix if needed)
    .replace(/^([0-9])/, 'table_$1');
}

/**
 * Simple pluralization rules for common English patterns
 * @param {string} word - Word to make singular
 * @returns {string} - Singular form of the word
 */
function toSingular(word) {
  if (!word || word.length <= 2) return word;
  
  // Common irregular plurals
  const irregulars = {
    'people': 'person',
    'children': 'child',
    'men': 'man',
    'women': 'woman',
    'teeth': 'tooth',
    'feet': 'foot',
    'geese': 'goose',
    'mice': 'mouse',
    'criteria': 'criterion'
    // Note: 'data' can be both singular and plural in modern usage, leave as-is
  };
  
  if (irregulars[word]) {
    return irregulars[word];
  }
  
  // Standard rules (applied in order of specificity)
  if (word.endsWith('ies') && word.length > 3) {
    return word.slice(0, -3) + 'y'; // categories -> category
  }
  if (word.endsWith('ves')) {
    return word.slice(0, -3) + 'f'; // lives -> life
  }
  if (word.endsWith('oes')) {
    return word.slice(0, -2); // potatoes -> potato
  }
  if (word.endsWith('ses') && word.length > 3) {
    return word.slice(0, -2); // addresses -> address
  }
  if (word.endsWith('xes')) {
    return word.slice(0, -2); // boxes -> box
  }
  if (word.endsWith('ches')) {
    return word.slice(0, -2); // batches -> batch
  }
  if (word.endsWith('shes')) {
    return word.slice(0, -2); // dishes -> dish
  }
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) {
    return word.slice(0, -1); // users -> user, items -> item
  }
  
  return word; // already singular or no rule applies
}

/**
 * Converts table name to snake_case for database usage with optional singular normalization
 * @param {string} tableName - Original table name from Airtable
 * @param {boolean} forceSingular - Whether to convert plural table names to singular (default: false - preserve as-is)
 * @returns {string} - Database-safe snake_case table name
 */
function sanitizeTableName(tableName, forceSingular = false) {
  let snakeCased = toSnakeCase(tableName);
  
  // Ensure minimum length
  if (snakeCased.length === 0) {
    return 'unnamed_table';
  }
  
  // Apply singular normalization if requested
  if (forceSingular) {
    // Split on underscores, singularize each part, rejoin
    const parts = snakeCased.split('_');
    const singularParts = parts.map(part => toSingular(part));
    snakeCased = singularParts.join('_');
  }
  
  // Only avoid truly problematic SQL reserved words that would cause syntax errors
  const strictReservedWords = [
    'select', 'from', 'where', 'join', 'inner', 'outer', 'left', 'right',
    'union', 'create', 'drop', 'alter', 'insert', 'update', 'delete',
    'grant', 'revoke', 'commit', 'rollback', 'transaction'
  ];
  
  if (strictReservedWords.includes(snakeCased)) {
    return `${snakeCased}_table`;
  }
  
  return snakeCased;
}

/**
 * Converts column name to snake_case for database usage
 * @param {string} columnName - Original column name from Airtable
 * @returns {string} - Database-safe snake_case column name
 */
function sanitizeColumnName(columnName) {
  const snakeCased = toSnakeCase(columnName);
  
  // Ensure minimum length
  if (snakeCased.length === 0) {
    return 'unnamed_column';
  }
  
  // Only avoid SQL keywords that would cause syntax errors in column names
  const strictReservedWords = [
    'select', 'from', 'where', 'join', 'union', 'create', 'drop', 'alter',
    'insert', 'update', 'delete', 'grant', 'revoke', 'commit', 'rollback'
  ];
  
  if (strictReservedWords.includes(snakeCased)) {
    return `${snakeCased}_field`;
  }
  
  return snakeCased;
}

/**
 * Test cases for snake_case conversion
 */
function testSnakeCase() {
  const testCases = [
    // Current problematic cases from your data
    { input: 'Subscription Items', expected: 'subscription_items' },
    { input: 'Invoice Lines', expected: 'invoice_lines' },
    { input: 'Invoice Batches', expected: 'invoice_batches' },
    { input: 'SEPA Mandates', expected: 'sepa_mandates' },
    { input: 'Deal Lines', expected: 'deal_lines' },
    { input: 'Deal Codes', expected: 'deal_codes' },
    { input: 'Adres-Product Koppeling', expected: 'adres_product_koppeling' },
    { input: 'Adress-Suffix', expected: 'adress_suffix' },
    { input: 'Email Templates', expected: 'email_templates' },
    { input: 'SMS Templates', expected: 'sms_templates' },
    { input: 'Mollie Webhooks', expected: 'mollie_webhooks' },
    { input: 'Webhook Log', expected: 'webhook_log' },
    
    // Additional edge cases
    { input: 'UserAccount', expected: 'user_account' },
    { input: 'XMLHttpRequest', expected: 'xml_http_request' },
    { input: 'ID123Field', expected: 'id_123_field' },
    { input: 'field-with-dashes', expected: 'field_with_dashes' },
    { input: 'field.with.dots', expected: 'field_with_dots' },
    { input: 'field with  spaces', expected: 'field_with_spaces' },
    { input: '123StartWithNumber', expected: 'table_123_start_with_number' },
    { input: 'special@#$chars', expected: 'special_chars' },
    { input: '', expected: 'unnamed_table' },
    { input: 'user', expected: 'user' }, // No longer treated as reserved
    { input: 'select', expected: 'select_table' }, // Still reserved
  ];
  
  console.log('🧪 Testing snake_case conversion (preserving plural):');
  testCases.forEach(test => {
    const result = sanitizeTableName(test.input, false); // Don't force singular
    const passed = result === test.expected;
    console.log(`${passed ? '✅' : '❌'} "${test.input}" → "${result}" ${passed ? '' : `(expected: "${test.expected}")`}`);
  });
  
  console.log('\n🧪 Testing with singular normalization (RECOMMENDED):');
  const singularTests = [
    { input: 'Users', expected: 'user' },
    { input: 'Order Items', expected: 'order_item' },
    { input: 'Invoice Lines', expected: 'invoice_line' },
    { input: 'Email Templates', expected: 'email_template' },
    { input: 'User Profiles', expected: 'user_profile' },
    { input: 'Categories', expected: 'category' },
    { input: 'Companies', expected: 'company' },
    { input: 'Addresses', expected: 'address' },
    { input: 'Batches', expected: 'batch' },
    { input: 'Boxes', expected: 'box' },
    { input: 'People', expected: 'person' },
    { input: 'Children', expected: 'child' },
    { input: 'Data Points', expected: 'data_point' },
  ];
  
  singularTests.forEach(test => {
    const result = sanitizeTableName(test.input, true); // Force singular
    const passed = result === test.expected;
    console.log(`${passed ? '✅' : '❌'} "${test.input}" → "${result}" ${passed ? '' : `(expected: "${test.expected}")`}`);
  });
}

module.exports = {
  toSnakeCase,
  sanitizeTableName,
  sanitizeColumnName,
  testSnakeCase
};