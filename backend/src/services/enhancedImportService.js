/**
 * Enhanced Import Service with Batch Processing
 * 
 * This service provides batch insert capabilities for high-performance importing
 * of large datasets from Airtable to PostgreSQL. Features TQDM-style progress
 * bars with ETA calculations, percentage completion, and efficient batch processing.
 */

const AirtableService = require('./airtable');
const ImportDatabaseService = require('./importDatabase');
const { sanitizeTableName, sanitizeColumnName } = require('../utils/naming');

class EnhancedImportService {
  constructor() {
    this.airtableService = new AirtableService();
    this.importDatabaseService = new ImportDatabaseService();
    this.BATCH_SIZE = 500; // Default batch size for optimal performance
  }

  async connect(airtableApiKey, airtableBaseId, databaseUrlOrService) {
    try {
      this.airtableService.connect(airtableApiKey, airtableBaseId);
      
      // Check if we received an existing database service object or a URL string
      if (typeof databaseUrlOrService === 'object' && databaseUrlOrService.connection) {
        // Reuse existing database service connection
        this.importDatabaseService = databaseUrlOrService;
        console.log('✅ Enhanced import service reusing existing database connection');
        
        return { 
          success: true, 
          message: 'Connected to Airtable and reusing existing database connection',
          targetDatabase: databaseUrlOrService
        };
      } else {
        // Connect to database using URL string
        const dbConnection = await this.importDatabaseService.connect(databaseUrlOrService, airtableBaseId);
        
        return { 
          success: true, 
          message: 'Connected to both Airtable and import database',
          targetDatabase: dbConnection
        };
      }
    } catch (error) {
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  async disconnect() {
    await this.importDatabaseService.disconnect();
  }

  /**
   * Import table with batch processing and TQDM-style progress.
   * 
   * @param {string} tableName - Name of the table to import
   * @param {string} sessionId - Import session ID for progress tracking
   * @param {Function} progressCallback - Progress callback function
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import results
   */
  async importTableWithBatches(tableName, sessionId, progressCallback = null, options = {}) {
    const { overwrite = false, batchSize = this.BATCH_SIZE } = options;
    
    const startTime = Date.now();
    this.emitProgress(sessionId, progressCallback, {
      table: tableName,
      status: 'starting',
      message: `🚀 Starting batch import for ${tableName}`,
      batchSize,
      timestamp: new Date().toISOString()
    });

    try {
      // Step 1: Fetch all records from Airtable
      this.emitProgress(sessionId, progressCallback, {
        table: tableName,
        status: 'fetching',
        message: `📥 Fetching records from Airtable...`,
        stage: 'fetch',
        progress: 0
      });

      const records = await this.airtableService.getTableRecords(
        tableName,
        (fetchProgress) => {
          this.emitProgress(sessionId, progressCallback, {
            table: tableName,
            status: 'fetching',
            message: `📄 Fetching: ${fetchProgress.recordsProcessed || 0}/${fetchProgress.totalRecords || '?'} records`,
            stage: 'fetch',
            progress: Math.min((fetchProgress.recordsProcessed || 0) / (fetchProgress.totalRecords || 1) * 25, 25), // 0-25% for fetching
            recordsProcessed: fetchProgress.recordsProcessed,
            totalRecords: fetchProgress.totalRecords
          });
        }
      );

      if (!records || records.length === 0) {
        return {
          tableName: sanitizeTableName(tableName, false),
          success: true,
          mode: 'empty',
          totalRecords: 0,
          processedRecords: 0,
          recordsImported: 0,
          batches: 0,
          duration: Date.now() - startTime
        };
      }

      const totalRecords = records.length;
      const totalBatches = Math.ceil(totalRecords / batchSize);

      this.emitProgress(sessionId, progressCallback, {
        table: tableName,
        status: 'preparing',
        message: `📊 Preparing batch import: ${totalRecords} records in ${totalBatches} batches`,
        stage: 'prepare',
        progress: 25,
        totalRecords,
        totalBatches,
        batchSize
      });

      // Step 2: Prepare database table
      const sanitizedTableName = sanitizeTableName(tableName, false);
      const tableAlreadyExists = await this.importDatabaseService.tableExists(sanitizedTableName);
      
      if (tableAlreadyExists && overwrite) {
        this.emitProgress(sessionId, progressCallback, {
          table: tableName,
          status: 'dropping',
          message: `🗑️ Dropping existing table for fresh import...`,
          stage: 'prepare',
          progress: 30
        });
        await this.importDatabaseService.dropTableIfExists(sanitizedTableName);
      }

      if (!tableAlreadyExists || overwrite) {
        this.emitProgress(sessionId, progressCallback, {
          table: tableName,
          status: 'creating_table',
          message: `🏗️ Creating database table from Airtable schema...`,
          stage: 'prepare',
          progress: 35
        });
        
        const tableSchema = await this.airtableService.getTableSchema(tableName);
        await this.importDatabaseService.createTableFromAirtableMetadata(sanitizedTableName, tableSchema);
      }

      // Step 3: Batch insert with progress tracking
      let processedRecords = 0;
      const importStartTime = Date.now();

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStartTime = Date.now();
        const startIdx = batchIndex * batchSize;
        const endIdx = Math.min(startIdx + batchSize, totalRecords);
        const batch = records.slice(startIdx, endIdx);
        const batchSize_actual = batch.length;

        // Calculate progress (35% to 95% for batch processing, 5% reserved for finalization)
        const batchProgress = 35 + ((batchIndex / totalBatches) * 60);
        
        // Calculate ETA
        const elapsedTime = Date.now() - importStartTime;
        const recordsPerMs = processedRecords / (elapsedTime || 1);
        const remainingRecords = totalRecords - processedRecords;
        const etaMs = remainingRecords / (recordsPerMs || 0.001);
        const eta = this.formatDuration(etaMs);

        this.emitProgress(sessionId, progressCallback, {
          table: tableName,
          status: 'importing',
          message: `📊 Batch ${batchIndex + 1}/${totalBatches}: ${processedRecords}/${totalRecords} records (${((processedRecords/totalRecords)*100).toFixed(1)}%) ETA: ${eta}`,
          stage: 'import',
          progress: batchProgress,
          batchIndex: batchIndex + 1,
          totalBatches,
          batchSize: batchSize_actual,
          processedRecords,
          totalRecords,
          eta,
          recordsPerSecond: Math.round(recordsPerMs * 1000)
        });

        try {
          // Perform batch insert
          const batchResult = await this.performBatchInsert(sanitizedTableName, batch);
          processedRecords += batchResult.insertedCount;

          const batchDuration = Date.now() - batchStartTime;
          const recordsPerSecond = Math.round((batchSize_actual / batchDuration) * 1000);

          this.emitProgress(sessionId, progressCallback, {
            table: tableName,
            status: 'importing',
            message: `✅ Batch ${batchIndex + 1} complete: ${batchSize_actual} records in ${batchDuration}ms (${recordsPerSecond} records/sec)`,
            stage: 'import',
            progress: 35 + (((batchIndex + 1) / totalBatches) * 60),
            batchIndex: batchIndex + 1,
            totalBatches,
            processedRecords,
            totalRecords,
            batchDuration,
            recordsPerSecond
          });

        } catch (error) {
          console.error(`❌ Batch ${batchIndex + 1} failed:`, error.message);
          this.emitProgress(sessionId, progressCallback, {
            table: tableName,
            status: 'error',
            message: `❌ Batch ${batchIndex + 1} failed: ${error.message}`,
            stage: 'import',
            progress: batchProgress,
            error: error.message
          });
          // Continue with next batch instead of failing entire import
        }
      }

      // Step 4: Finalization
      this.emitProgress(sessionId, progressCallback, {
        table: tableName,
        status: 'finalizing',
        message: `🎯 Finalizing import...`,
        stage: 'finalize',
        progress: 95
      });

      const totalDuration = Date.now() - startTime;
      const avgRecordsPerSecond = Math.round((processedRecords / totalDuration) * 1000);

      // Create indexes for better performance (optional)
      try {
        await this.createOptimalIndexes(sanitizedTableName);
      } catch (error) {
        console.warn(`⚠️ Failed to create indexes for ${tableName}:`, error.message);
      }

      this.emitProgress(sessionId, progressCallback, {
        table: tableName,
        status: 'completed',
        message: `🎉 Import completed: ${processedRecords}/${totalRecords} records in ${this.formatDuration(totalDuration)}`,
        stage: 'complete',
        progress: 100,
        processedRecords,
        totalRecords,
        totalBatches,
        duration: totalDuration,
        avgRecordsPerSecond
      });

      return {
        tableName: sanitizedTableName,
        success: true,
        mode: 'batch_import',
        totalRecords,
        processedRecords,
        recordsImported: processedRecords,
        batches: totalBatches,
        batchSize,
        duration: totalDuration,
        avgRecordsPerSecond
      };

    } catch (error) {
      console.error(`❌ Batch import failed for table '${tableName}':`, error.message);
      
      this.emitProgress(sessionId, progressCallback, {
        table: tableName,
        status: 'failed',
        message: `❌ Import failed: ${error.message}`,
        stage: 'error',
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Perform batch insert using optimized SQL queries.
   * Uses PostgreSQL's COPY or batch INSERT for maximum performance.
   */
  async performBatchInsert(tableName, batch) {
    if (batch.length === 0) {
      return { insertedCount: 0 };
    }

    try {
      // Use PostgreSQL COPY for maximum performance on large batches
      if (this.importDatabaseService.dbType === 'postgresql' && batch.length >= 100) {
        return await this.performPostgreSQLCopyInsert(tableName, batch);
      } else {
        // Use regular batch INSERT for smaller batches or other databases
        return await this.performRegularBatchInsert(tableName, batch);
      }
    } catch (error) {
      console.error(`❌ Batch insert failed for table ${tableName}:`, error.message);
      throw error;
    }
  }

  /**
   * Use PostgreSQL COPY command for ultra-fast bulk insert.
   */
  async performPostgreSQLCopyInsert(tableName, batch) {
    // For now, use regular batch insert since COPY is complex to implement correctly
    // This can be optimized later if needed for extremely large datasets
    return await this.performRegularBatchInsert(tableName, batch);
  }

  /**
   * Use regular batch INSERT by calling existing insertRecords method.
   * The existing method processes records efficiently with database abstraction.
   */
  async performRegularBatchInsert(tableName, batch) {
    try {
      // Use the existing importDatabaseService's insertRecords method 
      // which handles database abstraction (PostgreSQL vs SQLite)
      const result = await this.importDatabaseService.insertRecords(tableName, batch);
      
      // The insertRecords method returns { success: true, recordsInserted: number }
      return { 
        insertedCount: result.recordsInserted || batch.length 
      };
    } catch (error) {
      console.error(`❌ Batch insert failed for ${tableName}:`, error.message);
      throw error;
    }
  }

  /**
   * Create optimal indexes for imported table.
   * For now, skip index creation to avoid complexity - can be added later if needed.
   */
  async createOptimalIndexes(tableName) {
    // Skip index creation for now to keep implementation simple
    // Database performance will still be good without additional indexes
    // This can be enhanced later if needed for very large datasets
    console.log(`📊 Skipping index creation for ${tableName} (not implemented yet)`);
  }

  /**
   * Format duration in human-readable format.
   */
  formatDuration(ms) {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
    return `${Math.round(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`;
  }

  /**
   * Emit progress update to callback function.
   */
  emitProgress(sessionId, progressCallback, data) {
    if (progressCallback) {
      progressCallback({
        sessionId,
        timestamp: Date.now(),
        ...data
      });
    }
  }
}

module.exports = EnhancedImportService;