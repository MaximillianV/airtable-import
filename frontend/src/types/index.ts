export interface User {
  id: number;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
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
  debugMode?: boolean;
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

// Database Relationship Analysis Types
export interface DatabaseRelationship {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  relationshipType: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  cardinality: {
    sourceMin: number;
    sourceMax: number | 'N';
    targetMin: number;
    targetMax: number | 'N';
    confidence: 'low' | 'medium' | 'high';
  };
  isRequired: boolean;
  constraintName: string;
  junctionTable?: {
    name: string;
    sourceColumn: string;
    targetColumn: string;
  } | null;
  sql: string;
}

export interface RelationshipAnalysisResult {
  success: boolean;
  message: string;
  data: {
    relationships: DatabaseRelationship[];
    summary: {
      totalRelationships: number;
      relationshipTypes: Record<string, number>;
      tablesAnalyzed: number;
      timestamp: string;
    };
  };
  summary: {
    totalRelationships: number;
    relationshipTypes: Record<string, number>;
    tablesAnalyzed: number;
    timestamp: string;
  };
}

// ERD Visualization Types
export interface ERDTable {
  id: string;
  name: string;
  displayName: string;
  position: { x: number; y: number };
  columns: ERDColumn[];
  relationships: ERDRelationship[];
}

export interface ERDColumn {
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isRequired: boolean;
  isUnique: boolean;
  originalAirtableType?: string;
}

export interface ERDRelationship {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  relationshipType: string;
  isRequired: boolean;
  constraintName: string;
}