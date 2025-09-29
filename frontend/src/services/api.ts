import axios from 'axios';
import { AuthResponse, ConnectionTestResult, ImportSession, TableTestResult } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', { email, password });
    return response.data;
  },

  verify: async () => {
    const response = await api.get('/auth/verify');
    return response.data;
  },
};

export const importAPI = {
  start: async (tableNames: string[]) => {
    const response = await api.post('/import/start', { tableNames });
    return response.data;
  },

  getStatus: async (sessionId: string): Promise<ImportSession> => {
    const response = await api.get(`/import/status/${sessionId}`);
    return response.data;
  },

  getSessions: async (): Promise<ImportSession[]> => {
    const response = await api.get('/import/sessions');
    return response.data;
  },

  testTable: async (tableName: string): Promise<TableTestResult> => {
    const response = await api.post('/import/test-table', { tableName });
    return response.data;
  },

  // Table discovery
  discoverTables: async () => {
    const response = await api.get('/import/discover-tables');
    return response.data;
  },

  // Schema and relationship analysis
  getSchemaPreview: async () => {
    const response = await api.get('/import/schema-preview');
    return response.data;
  },

  analyzeRelationships: async () => {
    const response = await api.post('/import/analyze-relationships');
    return response.data;
  },

  debugRelationships: async () => {
    const response = await api.post('/import/debug-relationships');
    return response.data;
  },

  analyzeFieldTypes: async () => {
    const response = await api.post('/import/analyze-field-types');
    return response.data;
  },

  // Advanced workflows
  startFullImportWorkflow: async () => {
    const response = await api.post('/import/start-full-import-workflow');
    return response.data;
  },

  // Table retry functionality
  retryTable: async (sessionId: string, tableName: string) => {
    const response = await api.post('/import/retry-table', { sessionId, tableName });
    return response.data;
  },
};

// V2 Import API
export const v2ImportAPI = {
  discoverTables: async () => {
    const response = await api.get('/v2-import/discover-tables');
    return response.data;
  },

  phase1CreateSchema: async (options: { selectedTables?: string[] | null }) => {
    const response = await api.post('/v2-import/phase1-create-schema', options);
    return response.data;
  },

  phase2ImportData: async (sessionId: string) => {
    const response = await api.post('/v2-import/phase2-import-data', { sessionId });
    return response.data;
  },

  analyzeRelationships: async (sessionId: string) => {
    const response = await api.post('/v2-import/analyze-relationships', { sessionId });
    return response.data;
  },

  getAnalysis: async (analysisId: string) => {
    const response = await api.get(`/v2-import/analysis/${analysisId}`);
    return response.data;
  },

  applyApprovedRelationships: async (analysisId: string, approvedRelationships: any[]) => {
    const response = await api.post('/v2-import/apply-approved-relationships', { analysisId, approvedRelationships });
    return response.data;
  },
};

export default api;