const Airtable = require('airtable');
const fetch = require('node-fetch');

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
      // Test the connection by trying to access the base metadata
      // We'll attempt to read from a likely table or just verify API access
      
      // Method 1: Try to make a basic API call to test credentials
      const testUrl = `https://api.airtable.com/v0/meta/bases/${this.baseId}/tables`;
      const response = await fetch(testUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        throw new Error('Invalid API key - authentication failed');
      } else if (response.status === 403) {
        throw new Error('Access denied - check API key permissions');
      } else if (response.status === 404) {
        throw new Error('Base not found - check Base ID');
      } else if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Successful response should have tables array
      if (data && data.tables && Array.isArray(data.tables)) {
        return {
          success: true,
          tablesFound: data.tables.length,
          tableNames: data.tables.map(table => table.name).slice(0, 5) // First 5 table names
        };
      } else {
        // Fallback: just verify we got a valid response
        return {
          success: true,
          message: 'Connection successful (basic verification)'
        };
      }
    } catch (error) {
      // Handle network errors, invalid JSON, etc.
      if (error.message.includes('fetch')) {
        throw new Error('Network error - could not reach Airtable API');
      }
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }
}

module.exports = AirtableService;