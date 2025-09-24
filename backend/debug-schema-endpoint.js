/**
 * Schema Response Debug Endpoint
 * Shows the raw Metadata API response to troubleshoot missing table issues
 */

router.get('/debug-schema-response', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Getting raw schema response for debugging...');
    
    // Get user settings to access Airtable credentials
    const settings = await getUserSettings(req.user.userId);
    
    if (!settings.airtableApiKey || !settings.airtableBaseId) {
      return res.status(400).json({ 
        error: 'Airtable API key and Base ID are required' 
      });
    }

    // Make direct call to Metadata API
    const metadataUrl = `https://api.airtable.com/v0/meta/bases/${settings.airtableBaseId}/tables`;
    const fetch = require('node-fetch');
    
    const response = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${settings.airtableApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Metadata API error: ${response.status} ${response.statusText}`);
    }

    const rawMetadata = await response.json();
    
    // Extract table information
    const tableInfo = rawMetadata.tables.map(table => ({
      id: table.id,
      name: table.name,
      fieldCount: table.fields ? table.fields.length : 0,
      linkedFields: table.fields ? table.fields.filter(f => 
        f.type === 'multipleRecordLinks' || f.type === 'singleRecordLink'
      ).map(f => ({
        fieldName: f.name,
        fieldType: f.type,
        linkedTableId: f.options?.linkedTableId,
        inverseLinkFieldId: f.options?.inverseLinkFieldId
      })) : []
    }));

    // Find all unique linked table IDs that are referenced
    const referencedTableIds = new Set();
    tableInfo.forEach(table => {
      table.linkedFields.forEach(field => {
        if (field.linkedTableId) {
          referencedTableIds.add(field.linkedTableId);
        }
      });
    });

    // Check which referenced table IDs are missing
    const availableTableIds = new Set(tableInfo.map(t => t.id));
    const missingTableIds = Array.from(referencedTableIds).filter(id => !availableTableIds.has(id));

    console.log(`📊 Schema analysis: ${tableInfo.length} tables, ${missingTableIds.length} missing table references`);

    res.json({
      success: true,
      data: {
        rawResponse: rawMetadata,
        analysis: {
          availableTables: tableInfo,
          totalTables: tableInfo.length,
          totalLinkedFields: tableInfo.reduce((sum, t) => sum + t.linkedFields.length, 0),
          availableTableIds: Array.from(availableTableIds),
          referencedTableIds: Array.from(referencedTableIds),
          missingTableIds: missingTableIds,
          missingTableCount: missingTableIds.length
        }
      },
      message: `Found ${tableInfo.length} tables, ${missingTableIds.length} missing table references`
    });
    
  } catch (error) {
    console.error('Schema response debug error:', error);
    res.status(500).json({ 
      error: 'Failed to get schema response: ' + error.message 
    });
  }
});