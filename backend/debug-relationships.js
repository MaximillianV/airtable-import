/**
 * Temporary debug script to troubleshoot relationship detection
 * This will help us understand why table ID tblbg7W8lk6EEEzPz is not found
 */

const { RelationshipDetector } = require('./src/services/relationshipDetector');

async function debugRelationships() {
  try {
    console.log('🔍 Starting relationship debugging...');
    
    // You'll need to replace these with your actual Airtable credentials
    const apiKey = process.env.AIRTABLE_API_KEY || 'YOUR_API_KEY_HERE';
    const baseId = process.env.AIRTABLE_BASE_ID || 'YOUR_BASE_ID_HERE';
    
    if (apiKey === 'YOUR_API_KEY_HERE' || baseId === 'YOUR_BASE_ID_HERE') {
      console.error('❌ Please set AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables');
      process.exit(1);
    }
    
    // Create relationship detector
    const detector = new RelationshipDetector();
    await detector.connect(apiKey, baseId);
    
    // Get debug information
    const debugInfo = await detector.getDebugInformation();
    
    console.log('\n📊 SUMMARY:');
    console.log(`Total tables: ${debugInfo.summary.totalTables}`);
    console.log(`Total fields: ${debugInfo.summary.totalFields}`);
    console.log(`Linked record fields: ${debugInfo.summary.linkedRecordFields}`);
    
    console.log('\n📋 AVAILABLE TABLES:');
    debugInfo.tables.forEach(table => {
      console.log(`   ${table.name} (ID: ${table.id}) - ${table.recordCount} records`);
    });
    
    console.log('\n🔗 LINKED FIELDS WITH ISSUES:');
    const problematicFields = debugInfo.linkedFields.filter(f => 
      f.detectedRelationshipType.includes('unknown') || !f.linkedTableName
    );
    
    problematicFields.forEach(field => {
      console.log(`   ${field.sourceTable}.${field.fieldName}:`);
      console.log(`     - Target ID: ${field.linkedTableId}`);
      console.log(`     - Target Name: ${field.linkedTableName || 'NOT FOUND'}`);
      console.log(`     - Field Type: ${field.fieldType}`);
      console.log(`     - Relationship: ${field.detectedRelationshipType}`);
    });
    
    console.log('\n⚠️ POTENTIAL ISSUES:');
    debugInfo.potentialIssues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
    
    // Specifically look for the Contact table issue
    const contactIssues = debugInfo.potentialIssues.filter(issue => 
      issue.includes('Contact') || issue.includes('tblbg7W8lk6EEEzPz')
    );
    
    if (contactIssues.length > 0) {
      console.log('\n🎯 CONTACT TABLE SPECIFIC ISSUES:');
      contactIssues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error(error.stack);
  }
}

// Run the debug script
debugRelationships().then(() => {
  console.log('\n✅ Debug complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});