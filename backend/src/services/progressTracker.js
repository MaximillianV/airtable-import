/**
 * Progress Tracker Service (TQDM Style)
 * 
 * This service provides TQDM-style progress tracking with ETA calculations,
 * percentage completion, total progress per session/job, and table-by-table
 * progress monitoring for background processes.
 * 
 * Features:
 * - ETA calculations based on processing speed
 * - Total percentage based on completed tables vs total tables  
 * - Real-time progress updates via Socket.IO
 * - Background process monitoring
 * - Detailed session/job progress tracking
 */

class ProgressTracker {
  constructor(socketService) {
    this.socket = socketService;
    this.sessions = new Map(); // sessionId -> session data
    this.progressUpdateInterval = 1000; // Update every 1 second
  }

  /**
   * Initializes a new progress tracking session for import jobs.
   * Sets up session data structure and begins progress monitoring.
   * 
   * @param {string} sessionId - Unique identifier for the import session
   * @param {Array} tableNames - Array of table names to be processed
   * @param {Object} options - Additional session options
   * @returns {Object} Session initialization data
   */
  initializeSession(sessionId, tableNames, options = {}) {
    console.log(`Initializing progress tracking session: ${sessionId}`);
    
    const session = {
      sessionId,
      startTime: new Date(),
      endTime: null,
      status: 'initializing',
      totalTables: tableNames.length,
      completedTables: 0,
      currentTable: null,
      currentTableIndex: -1,
      tables: tableNames.map((name, index) => ({
        name,
        index,
        status: 'pending', // pending, processing, completed, error
        startTime: null,
        endTime: null,
        recordsTotal: 0,
        recordsProcessed: 0,
        recordsPerSecond: 0,
        eta: null,
        error: null
      })),
      overallProgress: {
        percentage: 0,
        eta: null,
        recordsPerSecond: 0,
        totalRecordsProcessed: 0,
        totalRecordsEstimate: 0
      },
      lastUpdateTime: new Date(),
      backgroundProcess: options.isBackground || false,
      updateInterval: null
    };
    
    this.sessions.set(sessionId, session);
    
    // Start automatic progress updates for background processes
    if (session.backgroundProcess) {
      this.startProgressUpdates(sessionId);
    }
    
    // Emit initial session state
    this.emitProgressUpdate(sessionId);
    
    return {
      sessionId,
      totalTables: session.totalTables,
      status: session.status,
      backgroundProcess: session.backgroundProcess
    };
  }

  /**
   * Starts processing a specific table within a session.
   * Updates session state and begins table-level progress tracking.
   * 
   * @param {string} sessionId - Session identifier
   * @param {string} tableName - Name of table being processed
   * @param {number} totalRecords - Total number of records in the table
   */
  startTableProcessing(sessionId, tableName, totalRecords) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found: ${sessionId}`);
      return;
    }
    
    // Find and update the table being processed
    const tableIndex = session.tables.findIndex(t => t.name === tableName);
    if (tableIndex === -1) {
      console.warn(`Table ${tableName} not found in session ${sessionId}`);
      return;
    }
    
    const table = session.tables[tableIndex];
    table.status = 'processing';
    table.startTime = new Date();
    table.recordsTotal = totalRecords;
    table.recordsProcessed = 0;
    
    // Update session state
    session.currentTable = tableName;
    session.currentTableIndex = tableIndex;
    session.status = 'processing';
    session.overallProgress.totalRecordsEstimate += totalRecords;
    
    console.log(`Started processing table ${tableName} with ${totalRecords} records`);
    this.emitProgressUpdate(sessionId);
  }

  /**
   * Updates progress for the currently processing table.
   * Calculates processing speed, ETA, and overall session progress.
   * 
   * @param {string} sessionId - Session identifier
   * @param {string} tableName - Name of table being updated
   * @param {number} recordsProcessed - Number of records processed so far
   * @param {Object} additionalData - Additional progress data
   */
  updateTableProgress(sessionId, tableName, recordsProcessed, additionalData = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found: ${sessionId}`);
      return;
    }
    
    const table = session.tables.find(t => t.name === tableName);
    if (!table) {
      console.warn(`Table ${tableName} not found in session ${sessionId}`);
      return;
    }
    
    // Update table progress
    const previousProcessed = table.recordsProcessed;
    table.recordsProcessed = recordsProcessed;
    
    // Calculate processing speed (records per second)
    const now = new Date();
    const timeElapsed = (now - table.startTime) / 1000; // seconds
    if (timeElapsed > 0) {
      table.recordsPerSecond = recordsProcessed / timeElapsed;
    }
    
    // Calculate ETA for this table
    const remainingRecords = table.recordsTotal - recordsProcessed;
    if (table.recordsPerSecond > 0 && remainingRecords > 0) {
      const etaSeconds = remainingRecords / table.recordsPerSecond;
      table.eta = new Date(now.getTime() + etaSeconds * 1000);
    }
    
    // Update overall session progress
    this.updateOverallProgress(session);
    
    // Update last update time
    session.lastUpdateTime = now;
    
    // Emit progress update
    this.emitProgressUpdate(sessionId);
    
    // Log progress periodically (every 10% or every 1000 records)
    const progressPercentage = (recordsProcessed / table.recordsTotal) * 100;
    const recordsIncrement = recordsProcessed - previousProcessed;
    if (recordsIncrement >= 1000 || progressPercentage % 10 < 1) {
      console.log(`Table ${tableName}: ${recordsProcessed}/${table.recordsTotal} (${progressPercentage.toFixed(1)}%) - ${table.recordsPerSecond.toFixed(1)} records/sec`);
    }
  }

  /**
   * Completes processing for a specific table.
   * Marks table as completed and updates overall session progress.
   * 
   * @param {string} sessionId - Session identifier
   * @param {string} tableName - Name of completed table
   * @param {Object} results - Processing results for the table
   */
  completeTableProcessing(sessionId, tableName, results = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found: ${sessionId}`);
      return;
    }
    
    const table = session.tables.find(t => t.name === tableName);
    if (!table) {
      console.warn(`Table ${tableName} not found in session ${sessionId}`);
      return;
    }
    
    // Mark table as completed
    table.status = 'completed';
    table.endTime = new Date();
    table.recordsProcessed = table.recordsTotal; // Ensure 100% completion
    
    // Update session progress
    session.completedTables++;
    
    // Move to next table or complete session
    if (session.completedTables >= session.totalTables) {
      this.completeSession(sessionId, { success: true, ...results });
    } else {
      // Update current table to next pending table
      const nextTable = session.tables.find(t => t.status === 'pending');
      if (nextTable) {
        session.currentTable = nextTable.name;
        session.currentTableIndex = nextTable.index;
      }
    }
    
    // Update overall progress
    this.updateOverallProgress(session);
    
    console.log(`Completed processing table ${tableName} (${session.completedTables}/${session.totalTables} tables done)`);
    this.emitProgressUpdate(sessionId);
  }

  /**
   * Marks a table as failed with error information.
   * Updates session state and continues with remaining tables.
   * 
   * @param {string} sessionId - Session identifier
   * @param {string} tableName - Name of failed table
   * @param {Error} error - Error that occurred during processing
   */
  failTableProcessing(sessionId, tableName, error) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found: ${sessionId}`);
      return;
    }
    
    const table = session.tables.find(t => t.name === tableName);
    if (!table) {
      console.warn(`Table ${tableName} not found in session ${sessionId}`);
      return;
    }
    
    // Mark table as failed
    table.status = 'error';
    table.endTime = new Date();
    table.error = {
      message: error.message,
      timestamp: new Date()
    };
    
    // Update session progress (count as "completed" for progress calculation)
    session.completedTables++;
    
    // Update overall progress
    this.updateOverallProgress(session);
    
    console.error(`Failed processing table ${tableName}: ${error.message}`);
    this.emitProgressUpdate(sessionId);
  }

  /**
   * Completes the entire import session.
   * Finalizes session data and stops progress monitoring.
   * 
   * @param {string} sessionId - Session identifier
   * @param {Object} results - Final session results
   */
  completeSession(sessionId, results = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found: ${sessionId}`);
      return;
    }
    
    // Mark session as completed
    session.status = results.success ? 'completed' : 'error';
    session.endTime = new Date();
    session.overallProgress.percentage = 100;
    session.overallProgress.eta = null;
    
    // Stop automatic updates
    if (session.updateInterval) {
      clearInterval(session.updateInterval);
      session.updateInterval = null;
    }
    
    // Calculate final statistics
    const totalTime = (session.endTime - session.startTime) / 1000; // seconds
    const successfulTables = session.tables.filter(t => t.status === 'completed').length;
    const failedTables = session.tables.filter(t => t.status === 'error').length;
    
    console.log(`Session ${sessionId} completed in ${totalTime.toFixed(1)}s: ${successfulTables} successful, ${failedTables} failed`);
    
    // Final progress update
    this.emitProgressUpdate(sessionId, {
      ...results,
      finalStats: {
        totalTime,
        successfulTables,
        failedTables,
        totalRecordsProcessed: session.overallProgress.totalRecordsProcessed
      }
    });
  }

  /**
   * Updates overall session progress calculations.
   * Computes total percentage, ETA, and processing speeds.
   * 
   * @param {Object} session - Session data to update
   */
  updateOverallProgress(session) {
    // Calculate overall percentage based on completed tables
    session.overallProgress.percentage = (session.completedTables / session.totalTables) * 100;
    
    // Calculate total records processed across all tables
    session.overallProgress.totalRecordsProcessed = session.tables
      .reduce((total, table) => total + table.recordsProcessed, 0);
    
    // Calculate overall processing speed
    const totalTimeElapsed = (new Date() - session.startTime) / 1000; // seconds
    if (totalTimeElapsed > 0) {
      session.overallProgress.recordsPerSecond = 
        session.overallProgress.totalRecordsProcessed / totalTimeElapsed;
    }
    
    // Calculate overall ETA based on remaining tables and current speed
    const remainingTables = session.totalTables - session.completedTables;
    if (remainingTables > 0 && session.overallProgress.recordsPerSecond > 0) {
      // Estimate remaining records
      const avgRecordsPerTable = session.overallProgress.totalRecordsEstimate / session.totalTables;
      const estimatedRemainingRecords = remainingTables * avgRecordsPerTable;
      
      const etaSeconds = estimatedRemainingRecords / session.overallProgress.recordsPerSecond;
      session.overallProgress.eta = new Date(Date.now() + etaSeconds * 1000);
    } else {
      session.overallProgress.eta = null;
    }
  }

  /**
   * Starts automatic progress updates for background processes.
   * Emits progress updates at regular intervals.
   * 
   * @param {string} sessionId - Session identifier
   */
  startProgressUpdates(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.updateInterval) {
      return; // Already started or session not found
    }
    
    session.updateInterval = setInterval(() => {
      if (session.status === 'processing') {
        this.emitProgressUpdate(sessionId);
      } else if (session.status === 'completed' || session.status === 'error') {
        // Stop updates for completed sessions
        clearInterval(session.updateInterval);
        session.updateInterval = null;
      }
    }, this.progressUpdateInterval);
    
    console.log(`Started automatic progress updates for session ${sessionId}`);
  }

  /**
   * Emits progress update via Socket.IO to connected clients.
   * Sends TQDM-style progress information with ETA and statistics.
   * 
   * @param {string} sessionId - Session identifier
   * @param {Object} additionalData - Additional data to include
   */
  emitProgressUpdate(sessionId, additionalData = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    
    // Format progress data for client consumption
    const progressData = {
      sessionId,
      timestamp: new Date(),
      status: session.status,
      overallProgress: {
        percentage: session.overallProgress.percentage,
        completedTables: session.completedTables,
        totalTables: session.totalTables,
        eta: session.overallProgress.eta,
        recordsPerSecond: session.overallProgress.recordsPerSecond,
        totalRecordsProcessed: session.overallProgress.totalRecordsProcessed,
        totalRecordsEstimate: session.overallProgress.totalRecordsEstimate
      },
      currentTable: session.currentTable ? {
        name: session.currentTable,
        index: session.currentTableIndex,
        ...session.tables[session.currentTableIndex]
      } : null,
      tables: session.tables.map(table => ({
        name: table.name,
        status: table.status,
        percentage: table.recordsTotal > 0 ? (table.recordsProcessed / table.recordsTotal) * 100 : 0,
        recordsProcessed: table.recordsProcessed,
        recordsTotal: table.recordsTotal,
        recordsPerSecond: table.recordsPerSecond,
        eta: table.eta,
        error: table.error
      })),
      tqdmStyle: this.generateTQDMStyleProgress(session),
      ...additionalData
    };
    
    // Emit to all connected clients
    this.socket.emit('importProgress', progressData);
    
    // Also emit session-specific update
    this.socket.emit(`importProgress:${sessionId}`, progressData);
  }

  /**
   * Generates TQDM-style progress bar text for console-like display.
   * Creates familiar progress bar format with percentage, ETA, and speed.
   * 
   * @param {Object} session - Session data
   * @returns {Object} TQDM-style progress information
   */
  generateTQDMStyleProgress(session) {
    const overallPercentage = session.overallProgress.percentage;
    const completedTables = session.completedTables;
    const totalTables = session.totalTables;
    const recordsPerSecond = session.overallProgress.recordsPerSecond;
    const eta = session.overallProgress.eta;
    
    // Generate progress bar (50 characters wide)
    const barWidth = 50;
    const filledWidth = Math.floor((overallPercentage / 100) * barWidth);
    const progressBar = '█'.repeat(filledWidth) + '░'.repeat(barWidth - filledWidth);
    
    // Format ETA
    let etaText = 'N/A';
    if (eta) {
      const etaSeconds = (eta - new Date()) / 1000;
      if (etaSeconds > 0) {
        const hours = Math.floor(etaSeconds / 3600);
        const minutes = Math.floor((etaSeconds % 3600) / 60);
        const seconds = Math.floor(etaSeconds % 60);
        etaText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }
    
    // Current table progress (if processing)
    let currentTableProgress = '';
    if (session.currentTable) {
      const currentTable = session.tables[session.currentTableIndex];
      if (currentTable) {
        const tablePercentage = currentTable.recordsTotal > 0 ? 
          (currentTable.recordsProcessed / currentTable.recordsTotal) * 100 : 0;
        currentTableProgress = `${session.currentTable}: ${currentTable.recordsProcessed}/${currentTable.recordsTotal} (${tablePercentage.toFixed(1)}%)`;
      }
    }
    
    return {
      progressBar,
      percentage: `${overallPercentage.toFixed(1)}%`,
      tables: `${completedTables}/${totalTables}`,
      speed: `${recordsPerSecond.toFixed(1)} records/sec`,
      eta: etaText,
      currentTable: currentTableProgress,
      // Full TQDM-style line
      tqdmLine: `${progressBar} ${overallPercentage.toFixed(1)}% | ${completedTables}/${totalTables} tables | ${recordsPerSecond.toFixed(1)} records/sec | ETA: ${etaText}`
    };
  }

  /**
   * Gets current session data for monitoring and display.
   * 
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Session data or null if not found
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Gets all active sessions for monitoring dashboard.
   * 
   * @returns {Array} Array of active session data
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * Cleans up completed sessions to prevent memory leaks.
   * Removes sessions older than specified age.
   * 
   * @param {number} maxAgeHours - Maximum age in hours (default: 24)
   */
  cleanupOldSessions(maxAgeHours = 24) {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if ((session.status === 'completed' || session.status === 'error') && 
          session.endTime && session.endTime < cutoffTime) {
        
        // Stop any remaining intervals
        if (session.updateInterval) {
          clearInterval(session.updateInterval);
        }
        
        this.sessions.delete(sessionId);
        console.log(`Cleaned up old session: ${sessionId}`);
      }
    }
  }
}

module.exports = ProgressTracker;