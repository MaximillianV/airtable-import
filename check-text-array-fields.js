/**
 * Check for TEXT[] fields in the DigitalOcean database
 * This troubleshoots why relationship analysis found 0 relationships
 */

async function checkTextArrayFields() {
  try {
    const { getUserSettings } = require('./backend/src/routes/settings');
    const ImportDatabaseService = require('./backend/src/services/importDatabase');
    
    console.log('🔍 Checking DigitalOcean database for TEXT[] fields...');
    
    // Get user settings
    const settings = await getUserSettings(1);
    console.log('📊 Database:', settings.databaseUrl ? 
      (settings.databaseUrl.includes('digitalocean') ? '🌊 DigitalOcean' : 
       settings.databaseUrl.includes('localhost') ? '🏠 Local' : 'Unknown') : 'Not configured');
    
    // Connect to database
    const importDb = new ImportDatabaseService();
    await importDb.connect(settings.databaseUrl, settings.airtableBaseId);
    console.log('✅ Connected to database');
    
    // Check for imported tables (excluding system tables)
    console.log('\n📋 Checking for imported tables...');
    const tablesQuery = `
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('_prisma_migrations', 'settings', 'users')
      ORDER BY table_name
    `;
    
    const tablesResult = await importDb.executeSQL(tablesQuery);
    
    if (tablesResult.rows.length > 0) {
      console.log(`📊 Found ${tablesResult.rows.length} imported tables:`);
      tablesResult.rows.forEach(row => {
        console.log(`   📄 ${row.table_name} (${row.column_count} columns)`);
      });
      
      // Now check specifically for TEXT[] columns (multipleRecordLinks)
      console.log('\n🔗 Checking for TEXT[] array columns...');
      const arrayFieldsQuery = `
        SELECT 
          c.table_name, 
          c.column_name, 
          c.data_type,
          c.udt_name,
          CASE 
            WHEN c.udt_name = '_text' THEN 'TEXT[] Array'
            WHEN c.data_type = 'ARRAY' THEN 'Array Type'
            ELSE c.data_type
          END as field_type
        FROM information_schema.columns c
        JOIN information_schema.tables t ON t.table_name = c.table_name
        WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT IN ('_prisma_migrations', 'settings', 'users')
        AND (c.udt_name = '_text' OR c.data_type = 'ARRAY')
        ORDER BY c.table_name, c.column_name
      `;
      
      const arrayResult = await importDb.executeSQL(arrayFieldsQuery);
      
      if (arrayResult.rows.length > 0) {
        console.log(`✅ Found ${arrayResult.rows.length} TEXT[] array fields:`);
        arrayResult.rows.forEach(row => {
          console.log(`   🔗 ${row.table_name}.${row.column_name} (${row.field_type})`);
        });
        
        // Sample some data from these array fields
        console.log('\n🔍 Sampling array field data...');
        for (const row of arrayResult.rows.slice(0, 3)) {
          try {
            const sampleQuery = `SELECT "${row.column_name}" FROM "${row.table_name}" WHERE "${row.column_name}" IS NOT NULL LIMIT 3`;
            const sampleResult = await importDb.executeSQL(sampleQuery);
            
            console.log(`   📋 ${row.table_name}.${row.column_name} sample data:`);
            if (sampleResult.rows.length > 0) {
              sampleResult.rows.forEach((dataRow, idx) => {
                const value = dataRow[row.column_name];
                const displayValue = Array.isArray(value) ? JSON.stringify(value) : value;
                console.log(`     [${idx+1}] ${displayValue}`);
              });
            } else {
              console.log('     (No data found)');
            }
          } catch (err) {
            console.log(`     Error sampling ${row.table_name}.${row.column_name}: ${err.message}`);
          }
        }
        
        console.log('\n✅ TEXT[] fields found - relationship analysis should work!');
        console.log('❗ The issue might be in the relationship analysis logic itself');
        
      } else {
        console.log('❌ No TEXT[] array fields found!');
        console.log('❗ This explains why relationship analysis found 0 relationships');
        console.log('❗ The V2 import may not have properly created TEXT[] columns for multipleRecordLinks fields');
        
        // Check what types of columns we do have
        console.log('\n🧐 Let\'s see what column types we have instead:');
        const allColumnsQuery = `
          SELECT 
            c.table_name, 
            c.column_name, 
            c.data_type,
            c.udt_name
          FROM information_schema.columns c
          JOIN information_schema.tables t ON t.table_name = c.table_name
          WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          AND t.table_name NOT IN ('_prisma_migrations', 'settings', 'users')
          ORDER BY c.table_name, c.column_name
          LIMIT 20
        `;
        
        const allColumnsResult = await importDb.executeSQL(allColumnsQuery);
        allColumnsResult.rows.forEach(row => {
          console.log(`   📝 ${row.table_name}.${row.column_name} (${row.data_type}/${row.udt_name})`);
        });
      }
      
    } else {
      console.log('❌ No imported tables found!');
      console.log('❗ Did the V2 import actually run successfully?');
    }
    
    await importDb.disconnect();
    console.log('\n🔚 Database check complete');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

checkTextArrayFields();