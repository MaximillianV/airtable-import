const { getUserSettings } = require('./backend/src/routes/settings');
const ImportDatabaseService = require('./backend/src/services/importDatabase');

async function checkTextArrays() {
  try {
    const settings = await getUserSettings(1);
    const importDb = new ImportDatabaseService();
    await importDb.connect(settings.databaseUrl, settings.airtableBaseId);
    
    console.log('🔍 Checking for TEXT[] fields in DigitalOcean database...');
    
    const query = `
      SELECT 
        c.table_name, 
        c.column_name, 
        c.data_type, 
        c.udt_name,
        CASE WHEN c.udt_name = '_text' THEN 'TEXT[]' ELSE c.data_type END as display_type
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_name = c.table_name
      WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND t.table_name NOT IN ('_prisma_migrations', 'settings', 'users')
      AND (c.udt_name = '_text' OR c.data_type = 'ARRAY' OR c.column_name ILIKE '%link%')
      ORDER BY c.table_name, c.column_name
    `;
    
    const result = await importDb.query(query);
    
    if (result.rows.length > 0) {
      console.log(`\n✅ Found ${result.rows.length} potential link fields:`);
      result.rows.forEach(row => {
        console.log(`   🔗 ${row.table_name}.${row.column_name} (${row.display_type})`);
      });
      
      // Sample some data
      console.log('\n🔍 Sampling data from first TEXT[] field...');
      const firstTextArray = result.rows.find(row => row.udt_name === '_text');
      if (firstTextArray) {
        const sampleQuery = `SELECT "${firstTextArray.column_name}" FROM "${firstTextArray.table_name}" WHERE "${firstTextArray.column_name}" IS NOT NULL LIMIT 3`;
        const sampleResult = await importDb.query(sampleQuery);
        console.log(`   📊 Sample data from ${firstTextArray.table_name}.${firstTextArray.column_name}:`);
        sampleResult.rows.forEach((row, idx) => {
          console.log(`   [${idx+1}] ${JSON.stringify(row[firstTextArray.column_name])}`);
        });
      }
    } else {
      console.log('\n❌ No TEXT[] fields found!');
      console.log('❗ This means the V2 import did not create TEXT[] fields for multipleRecordLinks');
      console.log('❗ This is why relationship analysis found 0 relationships');
    }
    
    await importDb.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTextArrays();
