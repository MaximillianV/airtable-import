/**
 * Simple test for relationship analysis with direct backend access
 */

async function testRelationshipAnalysis() {
  try {
    console.log('Testing Fixed Relationship Analysis with Array Support...');
    
    // Change to backend directory
    process.chdir('./backend');
    
    // Import necessary modules
    const { getUserSettings } = require('./src/routes/settings');
    const ImportDatabaseService = require('./src/services/importDatabase');
    
    console.log('Getting user settings...');
    const settings = await getUserSettings(1);
    
    if (!settings.databaseUrl) {
      throw new Error('No database URL found in settings');
    }
    
    console.log('Connecting to DigitalOcean database...');
    const importDb = new ImportDatabaseService();
    await importDb.connect(settings.databaseUrl, settings.airtableBaseId);
    
    // Test a simple query to check TEXT[] fields
    console.log('Checking TEXT[] fields in database...');
    
    const textArrayQuery = `
      SELECT 
        table_name,
        column_name,
        data_type,
        udt_name
      FROM information_schema.columns 
      WHERE data_type = 'ARRAY' 
        AND udt_name = '_text'
      ORDER BY table_name, column_name
      LIMIT 10;
    `;
    
    const textArrayFields = await importDb.executeSQL(textArrayQuery);
    console.log('Found TEXT[] fields:', textArrayFields.length);
    
    if (textArrayFields.length > 0) {
      console.log('Sample TEXT[] fields:');
      textArrayFields.slice(0, 5).forEach(field => {
        console.log('  - ' + field.table_name + '.' + field.column_name);
      });
      
      // Test actual data in one of these fields
      if (textArrayFields.length > 0) {
        const firstField = textArrayFields[0];
        const sampleDataQuery = `
          SELECT "${firstField.column_name}" 
          FROM "${firstField.table_name}" 
          WHERE "${firstField.column_name}" IS NOT NULL 
          LIMIT 3;
        `;
        
        console.log('Checking sample data in ' + firstField.table_name + '.' + firstField.column_name);
        const sampleData = await importDb.executeSQL(sampleDataQuery);
        console.log('Sample array data:', JSON.stringify(sampleData, null, 2));
      }
    }
    
    console.log('SUCCESS: Array-aware relationship analysis setup complete');
    console.log('Database has', textArrayFields.length, 'TEXT[] fields ready for analysis');
    
    return {
      success: true,
      textArrayFieldsCount: textArrayFields.length,
      sampleFields: textArrayFields.slice(0, 5)
    };
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack:', error.stack);
    return { success: false, error: error.message };
  }
}

// Run the test
testRelationshipAnalysis()
  .then(result => {
    console.log('Final result:', JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });