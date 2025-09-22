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
}

export interface ConnectionTestResult {
  airtable: {
    success: boolean;
    message: string;
  };
  database: {
    success: boolean;
    message: string;
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
  results?: ImportResult[];
  error?: string;
}

export interface ImportResult {
  tableName: string;
  success: boolean;
  recordsImported: number;
  totalRecords?: number;
  error?: string;
}

export interface TableTestResult {
  tableName: string;
  accessible: boolean;
  recordCount?: number;
  message: string;
  error?: string;
}