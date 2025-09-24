export interface User {
  id: number;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Settings {
  airtableApiKey: string;
  airtableBaseId: string;
  databaseUrl: string;
  databaseUrlStatus?: 'default' | 'configured';
}

export interface ConnectionTestResult {
  airtable: {
    success: boolean;
    message: string;
    details?: {
      tablesFound?: number;
      tableNames?: string[];
      message?: string;
    };
  };
  database: {
    success: boolean;
    message: string;
    details?: {
      type?: string;
      url?: string;
    };
  };
}

export interface ImportProgress {
  table: string;
  status: 'starting' | 'fetching' | 'creating_table' | 'inserting' | 'completed' | 'error';
  message?: string;
  recordsProcessed?: number;
  totalRecords?: number;
  error?: string;
}

export interface ImportSession {
  sessionId: string;
  status: 'starting' | 'running' | 'completed' | 'error';
  startTime: string;
  endTime?: string;
  tableNames: string[];
  results?: { [tableName: string]: ImportResult };
  error?: string;
}

export interface ImportResult {
  tableName: string;
  success: boolean;
  mode: 'import' | 'sync' | 'error';
  processedRecords: number;
  updatedRecords?: number;
  skippedRecords: number;
  totalRecords: number;
  recordsImported?: number; // Legacy compatibility
  recordsSkipped?: number; // Legacy compatibility
  error?: string;
}

export interface TableTestResult {
  tableName: string;
  accessible: boolean;
  recordCount?: number;
  message: string;
  error?: string;
}

export interface DiscoveredTable {
  id: string;
  name: string;
  recordCount: number;
  description?: string | null;
  error?: string;
}

export interface DiscoverTablesResult {
  success: boolean;
  tables: DiscoveredTable[];
  message: string;
  error?: string;
}