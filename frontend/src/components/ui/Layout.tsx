/**
 * Layout components for consistent page structure.
 * Provides sidebar navigation, page headers, and content containers.
 * 
 * Based on modern admin dashboard patterns with responsive design.
 * Includes navigation state management and active page highlighting.
 */

import React, { createContext, useContext, useState } from 'react';
import { theme } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';

// Layout context for managing sidebar state
interface LayoutContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};

// Navigation item interface
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: string | number;
}

// Main layout props
export interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
}

/**
 * Sidebar navigation component with user profile and navigation items.
 * Handles active state highlighting and responsive collapse.
 */
export const Sidebar: React.FC<{ currentPath: string }> = ({ currentPath }) => {
  const { user, logout } = useAuth();
  
  // Define navigation items for the application
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', path: '/dashboard' },
    { id: 'import', label: 'Import Data', icon: '📥', path: '/import' },
    { id: 'settings', label: 'Settings', icon: '⚙️', path: '/settings' },
  ];
  
  // Sidebar container styles
  const sidebarStyles: React.CSSProperties = {
    ...theme.layout.sidebar.background,
    width: theme.layout.sidebar.width,
    height: '100vh',
    position: 'fixed',
    left: 0,
    top: 0,
    display: 'flex',
    flexDirection: 'column',
    borderRight: `1px solid ${theme.colors.neutral[200]}`,
    zIndex: 1000,
  };
  
  // User profile section styles
  const profileStyles: React.CSSProperties = {
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.neutral[200]}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };
  
  // User avatar styles
  const avatarStyles: React.CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: theme.colors.primary[500],
    color: theme.colors.neutral.white,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 600,
  };
  
  // Navigation container styles
  const navStyles: React.CSSProperties = {
    flex: 1,
    padding: theme.spacing.md,
  };
  
  // Navigation item base styles
  const navItemStyles: React.CSSProperties = {
    ...theme.layout.sidebar.navItem,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    marginBottom: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    textDecoration: 'none',
    color: theme.colors.neutral[600],
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  };
  
  // Active navigation item styles
  const activeNavItemStyles: React.CSSProperties = {
    ...theme.layout.sidebar.navItemActive,
    backgroundColor: theme.colors.primary[50],
    color: theme.colors.primary[700],
    fontWeight: 600,
  };
  
  // Logout button styles
  const logoutStyles: React.CSSProperties = {
    ...navItemStyles,
    marginTop: 'auto',
    color: theme.colors.semantic.error,
    borderTop: `1px solid ${theme.colors.neutral[200]}`,
    marginBottom: 0,
    borderRadius: 0,
  };
  
  /**
   * Handle navigation item clicks.
   */
  const handleNavClick = (path: string) => {
    window.location.href = path;
  };
  
  /**
   * Get user initials for avatar display.
   */
  const getUserInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };
  
  return (
    <div style={sidebarStyles}>
      {/* User profile section */}
      <div style={profileStyles}>
        <div style={avatarStyles}>
          {getUserInitials(user?.email || 'U')}
        </div>
        <div>
          <div style={{ ...theme.typography.small, fontWeight: 600 }}>
            {user?.email}
          </div>
          <div style={{ ...theme.typography.small, color: theme.colors.neutral[400] }}>
            Administrator
          </div>
        </div>
      </div>
      
      {/* Navigation items */}
      <nav style={navStyles}>
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <div
              key={item.id}
              style={{
                ...navItemStyles,
                ...(isActive && activeNavItemStyles),
              }}
              onClick={() => handleNavClick(item.path)}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = theme.colors.neutral[50];
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && (
                <span style={{
                  marginLeft: 'auto',
                  backgroundColor: theme.colors.primary[500],
                  color: theme.colors.neutral.white,
                  fontSize: '12px',
                  padding: '2px 6px',
                  borderRadius: '12px',
                  minWidth: '18px',
                  textAlign: 'center',
                }}>
                  {item.badge}
                </span>
              )}
            </div>
          );
        })}
        
        {/* Logout button */}
        <div
          style={logoutStyles}
          onClick={logout}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.semantic.error + '10';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span style={{ fontSize: '18px' }}>🚪</span>
          <span>Logout</span>
        </div>
      </nav>
    </div>
  );
};

/**
 * Page header component with title and optional actions.
 * Provides consistent header styling across all pages.
 */
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => {
  const headerStyles: React.CSSProperties = {
    ...theme.layout.page.header,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.neutral[200]}`,
  };
  
  const titleSectionStyles: React.CSSProperties = {
    flex: 1,
  };
  
  const titleStyles: React.CSSProperties = {
    ...theme.typography.h1,
    margin: 0,
    marginBottom: subtitle ? theme.spacing.xs : 0,
  };
  
  const subtitleStyles: React.CSSProperties = {
    ...theme.typography.body,
    color: theme.colors.neutral[600],
    margin: 0,
  };
  
  const actionsStyles: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing.sm,
    alignItems: 'center',
  };
  
  return (
    <div style={headerStyles}>
      <div style={titleSectionStyles}>
        <h1 style={titleStyles}>{title}</h1>
        {subtitle && <p style={subtitleStyles}>{subtitle}</p>}
      </div>
      {actions && <div style={actionsStyles}>{actions}</div>}
    </div>
  );
};

/**
 * Main layout component with sidebar and content area.
 * Provides consistent layout structure for all application pages.
 */
export const Layout: React.FC<LayoutProps> = ({ children, currentPath }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Main container styles
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: theme.colors.neutral[50],
  };
  
  // Content area styles
  const contentStyles: React.CSSProperties = {
    ...theme.layout.page.content,
    flex: 1,
    marginLeft: theme.layout.sidebar.width,
    padding: theme.spacing.xl,
    minHeight: '100vh',
  };
  
  return (
    <LayoutContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
      <div style={containerStyles}>
        <Sidebar currentPath={currentPath} />
        <main style={contentStyles}>
          {children}
        </main>
      </div>
    </LayoutContext.Provider>
  );
};

export default Layout;