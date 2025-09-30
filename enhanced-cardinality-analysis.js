/**
 * Enhanced cardinality analysis for relationships
 * Properly determines one-to-one, one-to-many, many-to-one, and many-to-many relationships
 */

/**
 * Analyzes the true cardinality of a relationship by checking both directions
 * @param {ImportDatabaseService} db - Database connection
 * @param {string} fromTable - Source table name
 * @param {string} fromField - Source field name
 * @param {string} toTable - Target table name
 * @param {string} toField - Target field name (usually 'airtable_id')
 * @param {boolean} isArrayField - Whether the source field is a TEXT[] array
 * @returns {Promise<Object>} Cardinality analysis result
 */
async function analyzeRelationshipCardinality(db, fromTable, fromField, toTable, toField, isArrayField) {
  try {
    console.log(`🔍 Analyzing cardinality: ${fromTable}.${fromField} → ${toTable}.${toField} (${isArrayField ? 'array' : 'scalar'})`);
    
    let maxLinksFrom = 0;
    let maxLinksTo = 0;
    
    if (isArrayField) {
      // For array fields: Check maximum array length
      const fromSideQuery = `
        SELECT MAX(cardinality(${fromField})) AS max_links_from
        FROM ${fromTable}
        WHERE ${fromField} IS NOT NULL
      `;
      
      // For array fields: Check how many times each target ID is referenced
      const toSideQuery = `
        SELECT MAX(reference_count) AS max_links_to
        FROM (
          SELECT COUNT(*) AS reference_count
          FROM ${fromTable},
          unnest(${fromField}) AS referenced_id
          WHERE ${fromField} IS NOT NULL
          GROUP BY referenced_id
        ) AS counts
      `;
      
      const fromResult = await db.executeSQL(fromSideQuery);
      const toResult = await db.executeSQL(toSideQuery);
      
      maxLinksFrom = parseInt(fromResult.rows?.[0]?.max_links_from || fromResult[0]?.max_links_from || 0);
      maxLinksTo = parseInt(toResult.rows?.[0]?.max_links_to || toResult[0]?.max_links_to || 0);
      
    } else {
      // For scalar fields: From side is always 1 (one record can only reference one other record)
      maxLinksFrom = 1;
      
      // For scalar fields: Check how many times each target ID is referenced
      const toSideQuery = `
        SELECT MAX(reference_count) AS max_links_to
        FROM (
          SELECT COUNT(*) AS reference_count
          FROM ${fromTable}
          WHERE ${fromField} IS NOT NULL
          GROUP BY ${fromField}
        ) AS counts
      `;
      
      const toResult = await db.executeSQL(toSideQuery);
      maxLinksTo = parseInt(toResult.rows?.[0]?.max_links_to || toResult[0]?.max_links_to || 0);
    }
    
    // Determine cardinality for each side
    const fromCardinality = maxLinksFrom > 1 ? 'many' : 'one';
    const toCardinality = maxLinksTo > 1 ? 'many' : 'one';
    const relationshipType = `${fromCardinality}-to-${toCardinality}`;
    
    console.log(`   📊 Cardinality analysis: ${fromCardinality}-to-${toCardinality} (max from: ${maxLinksFrom}, max to: ${maxLinksTo})`);
    
    return {
      fromCardinality,
      toCardinality,
      relationshipType,
      maxLinksFrom,
      maxLinksTo,
      analysis: {
        fromSide: `One ${fromTable} record can link to ${maxLinksFrom} ${toTable} record${maxLinksFrom === 1 ? '' : 's'}`,
        toSide: `One ${toTable} record can be referenced by ${maxLinksTo} ${fromTable} record${maxLinksTo === 1 ? '' : 's'}`
      }
    };
    
  } catch (error) {
    console.error(`❌ Cardinality analysis failed for ${fromTable}.${fromField} → ${toTable}.${toField}:`, error.message);
    return {
      fromCardinality: 'unknown',
      toCardinality: 'unknown', 
      relationshipType: 'unknown',
      maxLinksFrom: 0,
      maxLinksTo: 0,
      error: error.message
    };
  }
}

/**
 * PostgreSQL function approach for batch cardinality analysis
 * Creates a function that can analyze multiple relationships at once
 */
const CARDINALITY_ANALYSIS_FUNCTION = `
CREATE OR REPLACE FUNCTION analyze_relationships(relations jsonb)
RETURNS TABLE (
    from_table text,
    from_field text,
    to_table text,
    relationship_type text,
    max_links_from bigint,
    max_links_to bigint,
    error_message text
)
LANGUAGE plpgsql
AS $$
DECLARE
    rel_obj jsonb;
    v_from_table text;
    v_from_field text;
    v_to_table text;
    v_field_type text;
    sql_from_side text;
    sql_to_side text;
    max_from bigint;
    max_to bigint;
BEGIN
    FOR rel_obj IN SELECT * FROM jsonb_array_elements(relations)
    LOOP
        v_from_table := rel_obj->>'fromTable';
        v_from_field := rel_obj->>'fromField';
        v_to_table := rel_obj->>'toTable';
        v_field_type := rel_obj->>'fieldType';

        max_from := 0;
        max_to := 0;

        BEGIN
            IF v_field_type = 'array' THEN
                sql_from_side := format('SELECT MAX(cardinality(%I)) FROM %I WHERE %I IS NOT NULL', v_from_field, v_from_table, v_from_field);
                sql_to_side := format('SELECT MAX(ref_count) FROM (SELECT COUNT(*) AS ref_count FROM %I, unnest(%I) AS ref_id WHERE %I IS NOT NULL GROUP BY ref_id) AS counts', v_from_table, v_from_field, v_from_field);

                EXECUTE sql_from_side INTO max_from;
                EXECUTE sql_to_side INTO max_to;

            ELSE
                max_from := 1;
                sql_to_side := format('SELECT MAX(ref_count) FROM (SELECT COUNT(*) AS ref_count FROM %I WHERE %I IS NOT NULL GROUP BY %I) AS counts', v_from_table, v_from_field, v_from_field);

                EXECUTE sql_to_side INTO max_to;
            END IF;

            from_table := v_from_table;
            from_field := v_from_field;
            to_table := v_to_table;
            relationship_type := CONCAT(
                CASE WHEN COALESCE(max_from, 0) > 1 THEN 'many' ELSE 'one' END,
                '-to-',
                CASE WHEN COALESCE(max_to, 0) > 1 THEN 'many' ELSE 'one' END
            );
            max_links_from := COALESCE(max_from, 0);
            max_links_to := COALESCE(max_to, 0);
            error_message := NULL;

        EXCEPTION WHEN others THEN
            from_table := v_from_table;
            from_field := v_from_field;
            to_table := v_to_table;
            relationship_type := 'error';
            max_links_from := 0;
            max_links_to := 0;
            error_message := SQLERRM;
        END;

        RETURN NEXT;
    END LOOP;
END;
$$;
`;

/**
 * Ensures the PostgreSQL function exists for batch cardinality analysis
 * @param {ImportDatabaseService} db - Database connection
 */
async function ensureCardinalityAnalysisFunction(db) {
  try {
    // Use the import database migration runner to ensure functions are available
    const { checkImportDatabaseReady } = require('./backend/import-db-migration-runner');
    const isReady = await checkImportDatabaseReady(db);
    
    if (isReady) {
      console.log('✅ Import database ready with analyze_relationships function');
      return true;
    } else {
      console.error('❌ Failed to ensure analyze_relationships function is available');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to check/create analyze_relationships function:', error.message);
    return false;
  }
}

/**
 * Uses the PostgreSQL function to analyze multiple relationships at once
 * @param {ImportDatabaseService} db - Database connection
 * @param {Array} relationships - Array of relationship objects
 * @returns {Promise<Array>} Enhanced relationships with cardinality analysis
 */
async function batchAnalyzeCardinality(db, relationships) {
  try {
    // First ensure the function exists via migration system
    await ensureCardinalityAnalysisFunction(db);
    
    // Prepare relationships data for the function
    const relationshipsData = relationships.map(rel => ({
      fromTable: rel.fromTable,
      fromField: rel.fromField,
      toTable: rel.toTable,
      fieldType: rel.statistics?.fieldType === 'TEXT[] array' ? 'array' : 'scalar'
    }));
    
    // Execute the batch analysis
    const query = `SELECT * FROM analyze_relationships($1::jsonb)`;
    const result = await db.executeSQL(query, [JSON.stringify(relationshipsData)]);
    const cardinalityResults = result.rows || result;
    
    // Merge cardinality results back with original relationships
    const enhancedRelationships = relationships.map(rel => {
      const cardinalityResult = cardinalityResults.find(cr => 
        cr.from_table === rel.fromTable && 
        cr.from_field === rel.fromField &&
        cr.to_table === rel.toTable
      );
      
      if (cardinalityResult && !cardinalityResult.error_message) {
        return {
          ...rel,
          relationshipType: cardinalityResult.relationship_type,
          cardinalityAnalysis: {
            fromCardinality: cardinalityResult.relationship_type.split('-to-')[0],
            toCardinality: cardinalityResult.relationship_type.split('-to-')[1],
            maxLinksFrom: parseInt(cardinalityResult.max_links_from),
            maxLinksTo: parseInt(cardinalityResult.max_links_to),
            analysis: {
              fromSide: `One ${rel.fromTable} record can link to ${cardinalityResult.max_links_from} ${rel.toTable} record${cardinalityResult.max_links_from === '1' ? '' : 's'}`,
              toSide: `One ${rel.toTable} record can be referenced by ${cardinalityResult.max_links_to} ${rel.fromTable} record${cardinalityResult.max_links_to === '1' ? '' : 's'}`
            }
          }
        };
      } else {
        return {
          ...rel,
          relationshipType: 'cardinality-analysis-failed',
          cardinalityAnalysis: {
            error: cardinalityResult?.error_message || 'Failed to analyze cardinality'
          }
        };
      }
    });
    
    return enhancedRelationships;
    
  } catch (error) {
    console.error('❌ Batch cardinality analysis failed:', error.message);
    return relationships.map(rel => ({
      ...rel,
      relationshipType: 'cardinality-analysis-error',
      cardinalityAnalysis: { error: error.message }
    }));
  }
}

/**
 * Checks if a field name suggests it's a lookup field that should be excluded
 * @param {string} fieldName - Field name to check
 * @returns {boolean} True if field appears to be a lookup field
 */
function isLookupField(fieldName) {
  const lookupPatterns = [
    /lookup/i,           // Contains "lookup"
    /^.*_lookup$/i,      // Ends with "_lookup"
    /^lookup_.*$/i,      // Starts with "lookup_"
    /rollup/i,           // Contains "rollup" 
    /formula/i,          // Contains "formula"
    /calculated/i,       // Contains "calculated"
    /computed/i,         // Contains "computed"
    /derived/i           // Contains "derived"
  ];
  
  return lookupPatterns.some(pattern => pattern.test(fieldName));
}

module.exports = {
  analyzeRelationshipCardinality,
  ensureCardinalityAnalysisFunction, 
  batchAnalyzeCardinality,
  isLookupField,
  CARDINALITY_ANALYSIS_FUNCTION
};