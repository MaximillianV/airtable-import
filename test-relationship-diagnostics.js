#!/usr/bin/env node

/**
 * Diagnostic script to understand why relationship analysis finds 0 relationships
 * 
 * This script will:
 * 1. Connect to the database
 * 2. Look at actual table structures and data
 * 3. Test relationship detection logic manually
 * 4. Show what columns exist and their data types
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

// Test credentials
const testCredentials = {
  email: 'admin@example.com',
  password: 'admin123'
};

let authToken = '';

/**
 * Helper function to make authenticated API calls
 */
async function apiCall(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ API call failed: ${method} ${endpoint}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Test authentication and get JWT token
 */
async function authenticate() {
  console.log('🔐 Authenticating...');
  
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, testCredentials);
    authToken = response.data.token;
    console.log('✅ Authentication successful');
    return true;
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Create a diagnostic endpoint to run SQL queries directly
 */
async function runDiagnosticSQL(sql, params = []) {
  try {
    console.log(`\n🔍 Running SQL: ${sql}`);
    if (params.length > 0) {
      console.log(`   Parameters: ${JSON.stringify(params)}`);
    }
    
    const result = await apiCall('POST', '/staged-workflow/debug-sql', {
      sql,
      params
    });
    
    return result.data;
  } catch (error) {
    console.error(`❌ SQL failed: ${error.message}`);
    return null;
  }
}

/**
 * Main diagnostic execution
 */
async function runDiagnostics() {
  console.log('🔍 Starting Relationship Analysis Diagnostics\n');
  
  // Authenticate
  const authSuccess = await authenticate();
  if (!authSuccess) {
    console.log('❌ Diagnostics aborted due to authentication failure');
    return;
  }
  
  console.log('\n📊 Step 1: Get table statistics...');
  
  // Get table info with detailed statistics
  const tableStats = await runDiagnosticSQL(`
    SELECT 
      t.table_name,
      COALESCE(s.n_tup_ins, 0) as row_count,
      COALESCE(s.n_tup_upd, 0) as updated_count,
      COALESCE(s.n_tup_del, 0) as deleted_count
    FROM information_schema.tables t
    LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
    WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
    ORDER BY COALESCE(s.n_tup_ins, 0) DESC
    LIMIT 10
  `);
  
  if (tableStats && tableStats.length > 0) {
    console.log('✅ Top 10 tables by row count:');
    tableStats.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.table_name}: ${table.row_count} rows`);
    });
    
    // Pick first two tables for detailed analysis
    const table1 = tableStats[0];
    const table2 = tableStats[1];
    
    console.log(`\n🔍 Step 2: Analyzing columns in ${table1.table_name} and ${table2.table_name}...`);
    
    // Get column details for both tables
    const table1Columns = await runDiagnosticSQL(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        character_maximum_length,
        column_default
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [table1.table_name]);
    
    const table2Columns = await runDiagnosticSQL(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        character_maximum_length,
        column_default
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [table2.table_name]);
    
    if (table1Columns && table1Columns.length > 0) {
      console.log(`\n📋 ${table1.table_name} columns:`);
      table1Columns.forEach((col, index) => {
        console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}) - ${col.is_nullable === 'YES' ? 'nullable' : 'not null'}`);
      });
    }
    
    if (table2Columns && table2Columns.length > 0) {
      console.log(`\n📋 ${table2.table_name} columns:`);
      table2Columns.forEach((col, index) => {
        console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}) - ${col.is_nullable === 'YES' ? 'nullable' : 'not null'}`);
      });
    }
    
    console.log(`\n🔍 Step 3: Looking for potential foreign key patterns...`);
    
    // Look for columns that might reference airtable_id in other tables
    const potentialFKs = await runDiagnosticSQL(`
      SELECT 
        t1.table_name as source_table,
        c1.column_name as source_column,
        c1.data_type as source_type,
        t2.table_name as target_table,
        'airtable_id' as target_column,
        'text' as target_type
      FROM information_schema.tables t1
      CROSS JOIN information_schema.tables t2
      JOIN information_schema.columns c1 ON c1.table_name = t1.table_name AND c1.table_schema = 'public'
      WHERE t1.table_schema = 'public' 
      AND t2.table_schema = 'public'
      AND t1.table_type = 'BASE TABLE'
      AND t2.table_type = 'BASE TABLE'
      AND t1.table_name != t2.table_name
      AND t1.table_name NOT LIKE 'pg_%'
      AND t2.table_name NOT LIKE 'pg_%'
      AND c1.column_name != 'airtable_id'
      AND c1.data_type IN ('text', 'character varying', 'varchar')
      AND EXISTS (
        SELECT 1 FROM information_schema.columns c2 
        WHERE c2.table_name = t2.table_name 
        AND c2.column_name = 'airtable_id' 
        AND c2.table_schema = 'public'
      )
      ORDER BY t1.table_name, c1.column_name
      LIMIT 20
    `);
    
    if (potentialFKs && potentialFKs.length > 0) {
      console.log('✅ Found potential foreign key candidates:');
      potentialFKs.forEach((fk, index) => {
        console.log(`   ${index + 1}. ${fk.source_table}.${fk.source_column} → ${fk.target_table}.${fk.target_column}`);
      });
      
      // Test the first potential relationship
      const testFK = potentialFKs[0];
      console.log(`\n🧪 Step 4: Testing relationship: ${testFK.source_table}.${testFK.source_column} → ${testFK.target_table}.${testFK.target_column}`);
      
      const relationshipTest = await runDiagnosticSQL(`
        WITH source_analysis AS (
          SELECT 
            COUNT(*) as total_rows,
            COUNT("${testFK.source_column}") as non_null_count,
            COUNT(DISTINCT "${testFK.source_column}") as distinct_count
          FROM "${testFK.source_table}"
        ),
        match_analysis AS (
          SELECT 
            COUNT(DISTINCT s."${testFK.source_column}") as source_distinct_values,
            COUNT(DISTINCT t."${testFK.target_column}") as matched_values
          FROM "${testFK.source_table}" s
          LEFT JOIN "${testFK.target_table}" t ON s."${testFK.source_column}" = t."${testFK.target_column}"
          WHERE s."${testFK.source_column}" IS NOT NULL
        )
        SELECT 
          sa.total_rows,
          sa.non_null_count,
          sa.distinct_count,
          ma.source_distinct_values,
          ma.matched_values,
          CASE 
            WHEN ma.source_distinct_values = 0 THEN 0
            ELSE ROUND((ma.matched_values::decimal / ma.source_distinct_values::decimal) * 100, 2)
          END as referential_integrity_percent
        FROM source_analysis sa, match_analysis ma
      `);
      
      if (relationshipTest && relationshipTest.length > 0) {
        const test = relationshipTest[0];
        console.log('✅ Relationship test results:');
        console.log(`   Total rows in source: ${test.total_rows}`);
        console.log(`   Non-null values: ${test.non_null_count}`);
        console.log(`   Distinct values: ${test.distinct_count}`);
        console.log(`   Source distinct values: ${test.source_distinct_values}`);
        console.log(`   Matched values: ${test.matched_values}`);
        console.log(`   Referential integrity: ${test.referential_integrity_percent}%`);
        
        // Calculate confidence manually
        const integrityPercent = parseFloat(test.referential_integrity_percent || 0);
        let confidence = 0;
        
        if (integrityPercent >= 90 && test.matched_values >= 3) {
          confidence = 0.95;
        } else if (integrityPercent >= 80 && test.matched_values >= 5) {
          confidence = 0.85;
        } else if (integrityPercent >= 70 && test.matched_values >= 10) {
          confidence = 0.75;
        } else if (integrityPercent >= 60 && test.matched_values >= 5) {
          confidence = 0.65;
        } else if (integrityPercent >= 50 && test.matched_values >= 3) {
          confidence = 0.55;
        } else if (integrityPercent >= 30 && test.matched_values >= 2) {
          confidence = 0.35;
        }
        
        console.log(`   🎯 Calculated confidence: ${(confidence * 100).toFixed(1)}%`);
        console.log(`   🚪 Confidence threshold: 30% (relationships above this are kept)`);
        
        if (confidence > 0.3) {
          console.log('   ✅ This relationship WOULD be detected (above threshold)');
        } else {
          console.log('   ❌ This relationship would NOT be detected (below threshold)');
          console.log('   💡 Reasons it might be rejected:');
          if (integrityPercent < 30) console.log('      - Referential integrity too low (<30%)');
          if (test.matched_values < 2) console.log('      - Too few matching values (<2)');
        }
      }
      
    } else {
      console.log('❌ No potential foreign key candidates found');
      console.log('💡 This suggests the issue might be:');
      console.log('   1. No text/varchar columns that could be foreign keys');
      console.log('   2. No airtable_id columns in target tables');
      console.log('   3. Column naming conventions different than expected');
    }
    
    console.log(`\n🔍 Step 5: Checking for airtable_id columns across all tables...`);
    
    const airtableIdCheck = await runDiagnosticSQL(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns 
      WHERE column_name = 'airtable_id' 
      AND table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (airtableIdCheck && airtableIdCheck.length > 0) {
      console.log('✅ Tables with airtable_id column:');
      airtableIdCheck.forEach((col, index) => {
        console.log(`   ${index + 1}. ${col.table_name}.${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('❌ No airtable_id columns found! This is the problem!');
      console.log('💡 The relationship analysis expects all tables to have an airtable_id column');
    }
    
  } else {
    console.log('❌ No tables found or failed to get table statistics');
  }
  
  console.log('\n🎉 Diagnostic analysis complete!');
}

// Run the diagnostics
runDiagnostics().catch(error => {
  console.error('❌ Diagnostic execution failed:', error.message);
  process.exit(1);
});