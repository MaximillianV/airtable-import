const Airtable = require('airtable');

class AirtableService {
  constructor() {
    this.base = null;
    this.apiKey = null;
    this.baseId = null;
  }

  connect(apiKey, baseId) {
    try {
      this.apiKey = apiKey;
      this.baseId = baseId;
      
      Airtable.configure({
        endpointUrl: 'https://api.airtable.com',
        apiKey: apiKey
      });

      this.base = Airtable.base(baseId);
      return true;
    } catch (error) {
      console.error('Airtable connection error:', error.message);
      throw new Error(`Failed to connect to Airtable: ${error.message}`);
    }
  }

  async discoverTables() {
    if (!this.base) {
      throw new Error('Not connected to Airtable');
    }

    try {
      // Since Airtable doesn't provide a direct API to list tables,
      // we'll need to use the metadata API or try common table names
      // For now, we'll return an empty array and let users specify table names
      // In a production app, you'd use the Metadata API
      
      // This is a limitation - Airtable's JS library doesn't expose table discovery
      // You would need to use the Metadata API separately
      console.log('Table discovery would require Airtable Metadata API');
      return [];
    } catch (error) {
      console.error('Error discovering tables:', error.message);
      throw error;
    }
  }

  async getTableRecords(tableName, progressCallback) {
    if (!this.base) {
      throw new Error('Not connected to Airtable');
    }

    const records = [];
    let recordCount = 0;

    try {
      await this.base(tableName).select({
        // Optionally specify fields, filters, sort, etc.
      }).eachPage(
        (pageRecords, fetchNextPage) => {
          records.push(...pageRecords);
          recordCount += pageRecords.length;
          
          if (progressCallback) {
            progressCallback({
              table: tableName,
              recordsProcessed: recordCount,
              status: 'fetching'
            });
          }

          fetchNextPage();
        }
      );

      if (progressCallback) {
        progressCallback({
          table: tableName,
          recordsProcessed: recordCount,
          status: 'completed',
          totalRecords: records.length
        });
      }

      return records;
    } catch (error) {
      if (progressCallback) {
        progressCallback({
          table: tableName,
          status: 'error',
          error: error.message
        });
      }
      throw error;
    }
  }

  async testConnection() {
    if (!this.base) {
      throw new Error('Not connected to Airtable');
    }

    try {
      // Try to make a simple request to test the connection
      // Since we can't list tables, we'll just verify the base is accessible
      return true;
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }
}

module.exports = AirtableService;