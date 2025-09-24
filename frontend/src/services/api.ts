import axios from 'axios';
import { AuthResponse, Settings, ConnectionTestResult, ImportSession, TableTestResult, DiscoverTablesResult, DiscoveredTable } from '../types';

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

// Handle 401 responses - only redirect for JWT authentication failures, not Airtable API failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect to login for JWT authentication failures from our backend
      // Check if this is a JWT authentication error vs an Airtable API error
      const errorMessage = error.response?.data?.error || '';
      
      // JWT authentication errors from our backend middleware
      const isJWTError = errorMessage.includes('No token provided') || 
                        errorMessage.includes('Access denied') || 
                        errorMessage.includes('Invalid token');
      
      // Airtable API errors should not trigger login redirect
      const isAirtableError = errorMessage.includes('Invalid API key') ||
                             errorMessage.includes('Base not found') ||
                             errorMessage.includes('Access denied - check API key');
      
      if (isJWTError && !isAirtableError) {
        console.log('JWT authentication failed, redirecting to login');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else {
        // This is likely an Airtable API error or other service error, don't redirect
        console.log('Non-JWT 401 error (likely external API):', errorMessage);
      }
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

export const settingsAPI = {
  get: async (): Promise<Partial<Settings>> => {
    const response = await api.get('/settings');
    return response.data;
  },

  save: async (settings: Partial<Settings>) => {
    const response = await api.post('/settings', settings);
    return response.data;
  },

  testConnections: async (settings: Settings): Promise<ConnectionTestResult> => {
    const response = await api.post('/settings/test', settings);
    return response.data;
  },

  testSavedConnections: async (): Promise<ConnectionTestResult> => {
    const response = await api.post('/settings/test-saved');
    return response.data;
  },
};

export const importAPI = {
  start: async (tableNames: string[], tables?: DiscoveredTable[], overwrite?: boolean) => {
    const payload: any = { tableNames };
    if (tables && tables.length > 0) {
      payload.tables = tables;
    }
    if (overwrite !== undefined) {
      payload.overwrite = overwrite;
    }
    const response = await api.post('/import/start', payload);
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

  discoverTables: async (): Promise<DiscoverTablesResult> => {
    const response = await api.get('/import/discover-tables');
    return response.data;
  },

  getSchemaPreview: async () => {
    const response = await api.get('/import/schema-preview');
    return response.data;
  },

  retryTable: async (sessionId: string, tableName: string) => {
    const response = await api.post('/import/retry-table', { sessionId, tableName });
    return response.data;
  },
};

export default api;