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

  /**
   * Discovers all tables in the Airtable base with their record counts.
   * Uses the Airtable Metadata API to fetch table information and then
   * queries each table to get accurate record counts.
   * 
   * @returns {Promise<Array>} Array of table objects with name, id, and recordCount
   * @throws {Error} When API access fails or base is not accessible
   */
  async discoverTablesWithCounts() {
    if (!this.base) {
      throw new Error('Not connected to Airtable');
    }

    try {
      console.log('Discovering tables using Airtable Metadata API...');
      
      // Step 1: Get table metadata from Airtable Metadata API
      const metadataUrl = `https://api.airtable.com/v0/meta/bases/${this.baseId}/tables`;
      const response = await fetch(metadataUrl, {
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
        throw new Error(`Metadata API error: ${response.status} ${response.statusText}`);
      }

      const metadata = await response.json();
      
      if (!metadata || !metadata.tables || !Array.isArray(metadata.tables)) {
        throw new Error('Invalid response from Metadata API - no tables found');
      }

      console.log(`Found ${metadata.tables.length} tables in base`);

      // Step 2: Get record counts for each table using the data API
      const tablesWithCounts = [];
      
      for (const tableInfo of metadata.tables) {
        try {
          console.log(`Getting record count for table: ${tableInfo.name}`);
          
          // Use the airtable.js library to get record count
          // We'll fetch just the first page to get the total count from offset
          const page = await this.base(tableInfo.name).select({
            maxRecords: 1, // Just get one record to minimize data transfer
            pageSize: 1
          }).firstPage();
          
          // Get the total count by making a separate request to count all records
          let recordCount = 0;
          await this.base(tableInfo.name).select().eachPage((records, fetchNextPage) => {
            recordCount += records.length;
            fetchNextPage();
          });

          tablesWithCounts.push({
            id: tableInfo.id,
            name: tableInfo.name,
            recordCount: recordCount,
            description: tableInfo.description || null
          });

          console.log(`Table "${tableInfo.name}": ${recordCount} records`);
        } catch (tableError) {
          console.warn(`Could not get record count for table "${tableInfo.name}":`, tableError.message);
          
          // Still include the table but with unknown record count
          tablesWithCounts.push({
            id: tableInfo.id,
            name: tableInfo.name,
            recordCount: -1, // -1 indicates unknown count
            description: tableInfo.description || null,
            error: tableError.message
          });
        }
      }

      console.log(`Successfully discovered ${tablesWithCounts.length} tables with record counts`);
      return tablesWithCounts;
    } catch (error) {
      console.error('Error discovering tables with counts:', error.message);
      throw error;
    }
  }

  /**
   * Legacy method for backward compatibility.
   * Now calls the enhanced discoverTablesWithCounts method.
   * 
   * @returns {Promise<Array>} Array of table names
   */
  async discoverTables() {
    try {
      const tablesWithCounts = await this.discoverTablesWithCounts();
      return tablesWithCounts.map(table => table.name);
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