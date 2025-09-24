/**
 * AdminLayout component provides the main admin dashboard structure.
 * Features a sidebar navigation, header with user profile, and main content area.
 * Supports nested routing for different admin sections and provides consistent layout.
 */
import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './admin/Sidebar';
import Header from './admin/Header';
import './admin/admin.css';

/**
 * Props interface for the AdminLayout component.
 */
interface AdminLayoutProps {
  /** Child components to render in the main content area */
  children?: React.ReactNode;
}

/**
 * AdminLayout component that provides the main admin dashboard structure.
 * Includes sidebar navigation, header with user profile, and main content area.
 * 
 * @param props - Component props
 * @returns JSX element representing the admin dashboard layout
 */
const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  // State for controlling sidebar visibility on mobile devices
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Authentication context and navigation hooks
  const { user } = useAuth();
  const location = useLocation();


  /**
   * Toggles the sidebar visibility state.
   * Used primarily for mobile responsive design.
   */
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div style={styles.container}>
      {/* Sidebar Navigation Component */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={toggleSidebar}
        currentPath={location.pathname}
      />
      
      {/* Main Content Area */}
      <div style={styles.mainContent} className="admin-main-content">
        {/* Header with User Profile */}
        <Header 
          user={user} 
          onMenuToggle={toggleSidebar}
        />
        
        {/* Page Content Area */}
        <main style={styles.content}>
          {/* Render child components or nested routes */}
          {children || <Outlet />}
        </main>
      </div>
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          style={styles.overlay} 
          className={`sidebar-overlay ${!sidebarOpen ? 'hidden' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

// Style object with comprehensive admin dashboard styling
const styles = {
  // Main container for the entire admin layout
  container: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#f8fafc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  
  // Main content area (everything except sidebar)
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    minWidth: 0, // Prevents flex item from overflowing
    overflow: 'hidden'
  },
  
  // Content area for page components
  content: {
    flex: 1,
    padding: '24px',
    overflow: 'auto',
    backgroundColor: '#f8fafc'
  },
  
  // Mobile overlay for sidebar
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 40,
    display: 'block'
  }
};

export default AdminLayout;