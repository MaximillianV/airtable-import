const Airtable = require('airtable');
const fetch = require('node-fetch');
const schemaCache = require('./schemaCache');

class AirtableService {
  constructor() {
    this.base = null;
    this.apiKey = null;
    this.baseId = null;
  }

  connect(apiKey, baseId) {
    try {
      console.log(`🔍 Airtable.connect called with:`, {
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey ? apiKey.length : 0,
        apiKeyStart: apiKey ? apiKey.substring(0, 10) + '...' : null,
        apiKeyFormat: apiKey ? (apiKey.startsWith('pat') ? 'PAT' : apiKey.startsWith('key') ? 'Legacy' : 'Unknown') : 'None',
        hasBaseId: !!baseId,
        baseId: baseId
      });

      // Validate API key format
      if (!apiKey || (!apiKey.startsWith('pat') && !apiKey.startsWith('key'))) {
        throw new Error('Invalid Airtable API key format. Expected key to start with "pat" or "key"');
      }

      this.apiKey = apiKey;
      this.baseId = baseId;
      
      Airtable.configure({
        endpointUrl: 'https://api.airtable.com',
        apiKey: apiKey
      });

      console.log(`🔍 Airtable.configure completed, creating base instance...`);
      this.base = Airtable.base(baseId);
      
      console.log(`✅ Airtable connection successful`);
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

    // Check cache first to avoid duplicate API calls
    const cachedTables = schemaCache.getTablesDiscovery(this.baseId);
    if (cachedTables) {
      console.log(`📋 Using cached table discovery for base ${this.baseId} (${cachedTables.length} tables)`);
      return cachedTables;
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
      
      // Cache the results to avoid duplicate API calls
      schemaCache.setTablesDiscovery(this.baseId, tablesWithCounts);
      
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
    console.log(`🔍 getTableRecords called for table: ${tableName}`);
    
    if (!this.base) {
      throw new Error('Not connected to Airtable');
    }

    // Test the API key with a direct HTTP request first
    console.log(`🧪 Testing API key with direct HTTP request...`);
    try {
      // First test: Base metadata (requires less permissions)
      const metaUrl = `https://api.airtable.com/v0/meta/bases/${this.baseId}/tables`;
      const metaResponse = await fetch(metaUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`🧪 Base metadata test:`, {
        status: metaResponse.status,
        statusText: metaResponse.statusText,
        ok: metaResponse.ok
      });
      
      if (metaResponse.ok) {
        const metaData = await metaResponse.json();
        console.log(`🧪 Base metadata success - found ${metaData.tables?.length || 0} tables`);
      } else {
        const metaError = await metaResponse.text();
        console.log(`🧪 Base metadata error:`, metaError);
      }

      // Second test: Table records (requires read permissions)
      const testUrl = `https://api.airtable.com/v0/${this.baseId}/${encodeURIComponent(tableName)}?maxRecords=1`;
      const testResponse = await fetch(testUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`🧪 Table records test:`, {
        status: testResponse.status,
        statusText: testResponse.statusText,
        ok: testResponse.ok
      });
      
      if (!testResponse.ok) {
        const errorBody = await testResponse.text();
        console.log(`🧪 Table records error:`, errorBody);
      } else {
        const testData = await testResponse.json();
        console.log(`🧪 Table records success - found ${testData.records?.length || 0} records`);
      }
    } catch (directError) {
      console.error(`🧪 Direct API test failed:`, directError.message);
    }

    const records = [];
    let recordCount = 0;

    try {
      console.log(`🔍 Starting Airtable query for table: ${tableName}`);
      
      await this.base(tableName).select({
        // Optionally specify fields, filters, sort, etc.
      }).eachPage(
        (pageRecords, fetchNextPage) => {
          console.log(`📄 Got page with ${pageRecords.length} records for table: ${tableName}`);
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

      console.log(`✅ Completed Airtable query for table: ${tableName}, total records: ${records.length}`);

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
      console.error(`❌ Airtable query error for table ${tableName}:`, error);
      
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

  /**
   * Get table schema with field types from Airtable Metadata API
   * 
   * @param {string} tableName - Name of the table to get schema for
   * @returns {Promise<Object>} Table schema with field definitions
   * @throws {Error} When API access fails or table not found
   */
  async getTableSchema(tableName) {
    if (!this.base) {
      throw new Error('Not connected to Airtable');
    }

    // Check cache first to avoid duplicate API calls
    const cachedSchema = schemaCache.getTableSchema(this.baseId, tableName);
    if (cachedSchema) {
      console.log(`📋 Using cached schema for table ${this.baseId}:${tableName} (${cachedSchema.fields?.length || 0} fields)`);
      return cachedSchema;
    }

    try {
      console.log(`🔍 Getting schema for table: ${tableName}`);
      
      // Get table metadata from Airtable Metadata API
      const metadataUrl = `https://api.airtable.com/v0/meta/bases/${this.baseId}/tables`;
      const response = await fetch(metadataUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Metadata API error: ${response.status} ${response.statusText}`);
      }

      const metadata = await response.json();
      
      if (!metadata || !metadata.tables || !Array.isArray(metadata.tables)) {
        throw new Error('Invalid response from Metadata API - no tables found');
      }

      // Find the specific table
      const tableInfo = metadata.tables.find(table => table.name === tableName);
      if (!tableInfo) {
        throw new Error(`Table "${tableName}" not found in base`);
      }

      console.log(`📋 Found table "${tableName}" with ${tableInfo.fields?.length || 0} fields`);
      
      // Log field information for debugging
      if (tableInfo.fields) {
        console.log(`🔍 Field details for table "${tableName}":`);
        tableInfo.fields.forEach(field => {
          console.log(`  - "${field.name}": type="${field.type}" ${field.options ? `options=${JSON.stringify(field.options)}` : ''}`);
        });
      }

      const tableSchema = {
        id: tableInfo.id,
        name: tableInfo.name,
        description: tableInfo.description || null,
        fields: tableInfo.fields || []
      };

      // Cache the schema to avoid duplicate API calls
      schemaCache.setTableSchema(this.baseId, tableName, tableSchema);

      return tableSchema;
    } catch (error) {
      console.error(`Error getting schema for table "${tableName}":`, error.message);
      throw error;
    }
  }

  /**
   * Gets complete schema information for all tables in the base.
   * This includes table metadata, field definitions, and field types
   * needed for comprehensive field analysis.
   * 
   * @returns {Promise<Object>} Complete schema information with tables and fields
   * @throws {Error} When API access fails or schema cannot be retrieved
   */
  async getSchemaInfo() {
    if (!this.base) {
      throw new Error('Not connected to Airtable');
    }

    console.log('🔍 Getting complete schema information from Airtable Metadata API...');

    try {
      // Use the Metadata API to get complete schema with field definitions
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

      console.log(`✅ Retrieved schema for ${metadata.tables.length} tables`);

      // Return the schema information in the expected format
      return {
        baseId: this.baseId,
        tables: metadata.tables.map(table => ({
          id: table.id,
          name: table.name,
          description: table.description || '',
          fields: table.fields || []
        }))
      };

    } catch (error) {
      console.error('❌ Failed to get schema info:', error.message);
      throw new Error(`Failed to retrieve schema information: ${error.message}`);
    }
  }
}

module.exports = AirtableService;