import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import AdminLayout from './components/AdminLayout';
import Dashboard from './components/Dashboard';
import Import from './components/Import';
import V2Import from './components/V2Import';
import SessionDetail from './components/SessionDetail';
import AdminSettings from './components/admin/settings/AdminSettings';
import Users from './components/admin/users/Users';
import Profile from './components/admin/Profile';
import ERDSchemaAnalyzer from './components/ERDSchemaAnalyzer';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

/**
 * Main App component with routing configuration for the Airtable Import system.
 * Features authentication flow and admin dashboard with nested routing.
 * Provides protected routes for authenticated users and clean URL structure.
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public authentication routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Protected admin dashboard routes */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }>
              {/* Dashboard - main admin overview */}
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              
              {/* Import functionality */}
              <Route path="import" element={<Import />} />
              <Route path="v2-import" element={<V2Import />} />
              <Route path="sessions/:sessionId" element={<SessionDetail />} />
              
              {/* ERD Schema Analyzer */}
              <Route path="erd" element={<ERDSchemaAnalyzer />} />
              
              {/* Users management section */}
              <Route path="users" element={<Users />} />
              <Route path="users/list" element={<Users />} />
              <Route path="users/roles" element={<Users />} />
              <Route path="users/permissions" element={<Users />} />
              
              {/* Settings section with tabs */}
              <Route path="settings" element={<AdminSettings />} />
              <Route path="settings/import" element={<AdminSettings />} />
              <Route path="settings/status" element={<AdminSettings />} />
              <Route path="settings/sessions" element={<AdminSettings />} />
              
              {/* Profile management */}
              <Route path="profile" element={<Profile />} />
            </Route>
            
            {/* Legacy route redirects for backward compatibility */}
            <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
            <Route path="/import" element={<Navigate to="/admin/import" replace />} />
            
            {/* Default route - redirect to admin dashboard */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            
            {/* Catch-all route - redirect to admin dashboard */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
