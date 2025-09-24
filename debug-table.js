// Debug script to check table structure and drop if needed
const { Client } = require('pg');

async function debugTable() {
  const client = new Client({
    connectionString: 'postgresql://postgres:password@localhost:5432/airtable_import_data_appkj2fWXmFXFdMJE',
    ssl: false
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if Discounts table exists
    const checkTableResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'Discounts'
    `);

    if (checkTableResult.rows.length > 0) {
      console.log('Discounts table exists, checking structure...');
      
      // Get table structure
      const columnsResult = await client.query(`
        SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Discounts'
        ORDER BY ordinal_position
      `);

      console.log('Current table structure:');
      columnsResult.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} ${row.numeric_precision ? `(${row.numeric_precision},${row.numeric_scale})` : ''}`);
      });

      // Drop the table to force recreation
      console.log('\nDropping table to force recreation with correct schema...');
      await client.query('DROP TABLE IF EXISTS "Discounts"');
      console.log('Table dropped successfully');
    } else {
      console.log('Discounts table does not exist');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

debugTable();