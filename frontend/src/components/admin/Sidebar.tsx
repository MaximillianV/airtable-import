/**
 * Sidebar component provides navigation for the admin dashboard.
 * Features collapsible sections for Users and Se      <aside
        style={{
          ...styles.sidebar,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)'
        }}
        className="sidebar"
      >th sub-navigation items.
 * Responsive design with mobile-friendly interactions.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Props interface for the Sidebar component.
 */
interface SidebarProps {
  /** Whether the sidebar is open (for mobile responsiveness) */
  isOpen: boolean;
  /** Function to toggle sidebar visibility */
  onToggle: () => void;
  /** Current active path for highlighting navigation items */
  currentPath: string;
}

/**
 * Navigation item interface for type safety.
 */
interface NavItem {
  /** Display name for the navigation item */
  name: string;
  /** Route path for navigation */
  path: string;
  /** Icon component or string for the navigation item */
  icon: string;
  /** Whether this item is currently active */
  active?: boolean;
}

/**
 * Navigation section interface for grouped navigation items.
 */
interface NavSection {
  /** Section title (e.g., "Users", "Settings") */
  title: string;
  /** Array of navigation items in this section */
  items: NavItem[];
  /** Whether this section is expanded by default */
  expanded?: boolean;
}

/**
 * Sidebar navigation component for the admin dashboard.
 * Provides organized navigation with Users and Settings sections.
 * 
 * @param props - Component props containing sidebar state and navigation data
 * @returns JSX element representing the sidebar navigation
 */
const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, currentPath }) => {
  // State for tracking which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['Users', 'Settings']) // Default expanded sections
  );
  
  const navigate = useNavigate();

  /**
   * Navigation sections configuration with Users and Settings.
   * Each section contains multiple navigation items with paths and icons.
   */
  const navSections: NavSection[] = [
    {
      title: 'Users',
      expanded: expandedSections.has('Users'),
      items: [
        { name: 'Users List', path: '/admin/users', icon: '👥' },
        { name: 'Roles', path: '/admin/users/roles', icon: '🔐' },
        { name: 'Permissions', path: '/admin/users/permissions', icon: '⚡' }
      ]
    },
    {
      title: 'Settings',
      expanded: expandedSections.has('Settings'),
      items: [
        { name: 'Import Settings', path: '/admin/settings/import', icon: '⚙️' },
        { name: 'Import Status', path: '/admin/settings/status', icon: '📊' },
        { name: 'Import Sessions', path: '/admin/settings/sessions', icon: '📋' }
      ]
    }
  ];

  /**
   * Toggles the expansion state of a navigation section.
   * Maintains state of which sections are currently expanded.
   * 
   * @param sectionTitle - The title of the section to toggle
   */
  const toggleSection = (sectionTitle: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionTitle)) {
      newExpanded.delete(sectionTitle);
    } else {
      newExpanded.add(sectionTitle);
    }
    setExpandedSections(newExpanded);
  };

  /**
   * Handles navigation item clicks.
   * Navigates to the selected path and closes mobile sidebar.
   * 
   * @param path - The route path to navigate to
   */
  const handleItemClick = (path: string) => {
    navigate(path);
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      onToggle();
    }
  };

  return (
    <>
      {/* Sidebar Container */}
      <div 
        style={{
          ...styles.sidebar,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)'
        }}
        className="sidebar"
      >
        {/* Sidebar Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Airtable Import</h2>
          <p style={styles.subtitle}>Admin Dashboard</p>
        </div>

        {/* Navigation Sections */}
        <nav style={styles.nav}>
          {navSections.map((section) => (
            <div key={section.title} style={styles.section}>
              {/* Section Header - Clickable to expand/collapse */}
              <button
                style={styles.sectionHeader}
                onClick={() => toggleSection(section.title)}
              >
                <span style={styles.sectionTitle}>{section.title}</span>
                <span style={{
                  ...styles.expandIcon,
                  transform: expandedSections.has(section.title) ? 'rotate(90deg)' : 'rotate(0deg)'
                }}>
                  ▶
                </span>
              </button>

              {/* Section Items - Show/hide based on expansion state */}
              {expandedSections.has(section.title) && (
                <div style={styles.sectionItems}>
                  {section.items.map((item) => {
                    const isActive = currentPath === item.path || currentPath.startsWith(item.path);
                    
                    return (
                      <button
                        key={item.path}
                        style={{
                          ...styles.navItem,
                          ...(isActive ? styles.navItemActive : {})
                        }}
                        onClick={() => handleItemClick(item.path)}
                      >
                        <span style={styles.navIcon}>{item.icon}</span>
                        <span style={styles.navText}>{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Version 1.0.0
          </p>
        </div>
      </div>
    </>
  );
};

// Comprehensive styles for the sidebar component
const styles = {
  // Main sidebar container
  sidebar: {
    width: '280px',
    height: '100vh',
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'fixed' as const,
    left: 0,
    top: 0,
    zIndex: 50,
    transition: 'transform 0.3s ease-in-out',
    boxShadow: '4px 0 6px -1px rgba(0, 0, 0, 0.1)'
  },

  // Sidebar header with title and subtitle
  header: {
    padding: '24px 20px',
    borderBottom: '1px solid #334155',
    backgroundColor: '#0f172a'
  },

  // Main title styling
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '0 0 4px 0',
    color: '#f1f5f9'
  },

  // Subtitle styling
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: 0
  },

  // Navigation container
  nav: {
    flex: 1,
    padding: '16px 0',
    overflow: 'auto'
  },

  // Navigation section container
  section: {
    marginBottom: '8px'
  },

  // Section header button (clickable to expand/collapse)
  sectionHeader: {
    width: '100%',
    padding: '12px 20px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#e2e8f0',
    fontSize: '14px',
    fontWeight: '600',
    textAlign: 'left' as const,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    transition: 'all 0.2s ease',
    ':hover': {
      backgroundColor: '#334155'
    }
  },

  // Section title text
  sectionTitle: {
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontSize: '12px'
  },

  // Expand/collapse icon
  expandIcon: {
    fontSize: '10px',
    transition: 'transform 0.2s ease',
    color: '#94a3b8'
  },

  // Container for section navigation items
  sectionItems: {
    paddingLeft: '8px'
  },

  // Individual navigation item styling
  navItem: {
    width: '100%',
    padding: '12px 20px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#cbd5e1',
    fontSize: '14px',
    textAlign: 'left' as const,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'all 0.2s ease',
    borderRadius: '6px',
    margin: '2px 12px',
    ':hover': {
      backgroundColor: '#334155',
      color: '#f1f5f9'
    }
  },

  // Active navigation item styling
  navItemActive: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    fontWeight: '500',
    ':hover': {
      backgroundColor: '#2563eb'
    }
  },

  // Navigation item icon
  navIcon: {
    fontSize: '16px',
    minWidth: '20px',
    textAlign: 'center' as const
  },

  // Navigation item text
  navText: {
    flex: 1
  },

  // Sidebar footer
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid #334155',
    backgroundColor: '#0f172a'
  },

  // Footer text styling
  footerText: {
    fontSize: '12px',
    color: '#64748b',
    textAlign: 'center' as const,
    margin: 0
  }
};

export default Sidebar;