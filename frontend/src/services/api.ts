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

export const settingsAPI = {
  get: async (): Promise<Partial<Settings>> => {
    const response = await api.get('/settings');
    return response.data;
  },

  save: async (settings: Settings) => {
    const response = await api.post('/settings', settings);
    return response.data;
  },

  testConnections: async (settings: Settings): Promise<ConnectionTestResult> => {
    const response = await api.post('/settings/test', settings);
    return response.data;
  },
};

export const importAPI = {
  start: async (tableNames: string[], tables?: DiscoveredTable[]) => {
    const payload: any = { tableNames };
    if (tables && tables.length > 0) {
      payload.tables = tables;
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
};

export default api;