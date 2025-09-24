/**
 * Header component provides the top navigation bar for the admin dashboard.
 * Features user profile dropdown with settings, password reset, and logout options.
 * Includes mobile menu toggle and breadcrumb navigation.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Props interface for the Header component.
 */
interface HeaderProps {
  /** Current authenticated user information */
  user: any;
  /** Function to toggle mobile sidebar menu */
  onMenuToggle: () => void;
}

/**
 * User menu item interface for dropdown menu options.
 */
interface MenuItem {
  /** Display label for the menu item */
  label: string;
  /** Route path or action for the menu item */
  path?: string;
  /** Click handler function for custom actions */
  onClick?: () => void;
  /** Icon to display next to the menu item */
  icon: string;
  /** Whether this item represents a dangerous action */
  danger?: boolean;
}

/**
 * Header component for the admin dashboard.
 * Provides user profile dropdown, mobile menu toggle, and navigation context.
 * 
 * @param props - Component props containing user data and menu toggle function
 * @returns JSX element representing the dashboard header
 */
const Header: React.FC<HeaderProps> = ({ user, onMenuToggle }) => {
  // State for controlling user dropdown visibility
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Refs and hooks for navigation and authentication
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  /**
   * Generates breadcrumb navigation based on current route path.
   * Converts URL segments into readable breadcrumb items.
   * 
   * @returns Array of breadcrumb items with labels and paths
   */
  const generateBreadcrumbs = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Dashboard', path: '/admin' }];
    
    let currentPath = '';
    pathSegments.slice(1).forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      // Convert URL segments to readable labels
      const label = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      breadcrumbs.push({
        label,
        path: `/admin${currentPath}`
      });
    });
    
    return breadcrumbs;
  };

  /**
   * User dropdown menu items configuration.
   * Includes profile settings, password reset, and logout options.
   */
  const menuItems: MenuItem[] = [
    {
      label: 'Profile Settings',
      path: '/admin/profile',
      icon: '👤'
    },
    {
      label: 'Change Password',
      path: '/admin/profile/password',
      icon: '🔑'
    },
    {
      label: 'Logout',
      onClick: handleLogout,
      icon: '🚪',
      danger: true
    }
  ];

  /**
   * Handles user logout action.
   * Clears authentication state and redirects to login page.
   */
  function handleLogout() {
    logout();
    navigate('/login');
    setDropdownOpen(false);
  }

  /**
   * Handles menu item clicks.
   * Either navigates to a path or executes a custom action.
   * 
   * @param item - The menu item that was clicked
   */
  const handleMenuItemClick = (item: MenuItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.path) {
      navigate(item.path);
      setDropdownOpen(false);
    }
  };

  /**
   * Closes dropdown when clicking outside of it.
   * Adds and removes event listener for click detection.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Generate current breadcrumbs for navigation context
  const breadcrumbs = generateBreadcrumbs();

  return (
    <header style={styles.header}>
      {/* Left Section: Mobile Menu Toggle and Breadcrumbs */}
      <div style={styles.leftSection}>
        {/* Mobile Menu Toggle Button */}
        <button
          style={styles.menuToggle}
          onClick={onMenuToggle}
        >
          <span style={styles.hamburger}>☰</span>
        </button>

        {/* Breadcrumb Navigation */}
        <nav style={styles.breadcrumbs}>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path}>
              {index > 0 && <span style={styles.breadcrumbSeparator}>/</span>}
              <button
                style={{
                  ...styles.breadcrumbItem,
                  ...(index === breadcrumbs.length - 1 ? styles.breadcrumbActive : {})
                }}
                onClick={() => navigate(crumb.path)}
              >
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right Section: User Profile Dropdown */}
      <div style={styles.rightSection}>
        <div style={styles.userSection} ref={dropdownRef}>
          {/* User Profile Button */}
          <button
            style={styles.userButton}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            {/* User Avatar */}
            <div style={styles.avatar}>
              {user?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            
            {/* User Info */}
            <div style={styles.userInfo}>
              <span style={styles.userName}>
                {user?.email?.split('@')[0] || 'Admin'}
              </span>
              <span style={styles.userRole}>Administrator</span>
            </div>
            
            {/* Dropdown Arrow */}
            <span style={{
              ...styles.dropdownArrow,
              transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
            }}>
              ▼
            </span>
          </button>

          {/* User Dropdown Menu */}
          {dropdownOpen && (
            <div style={styles.dropdown}>
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  style={{
                    ...styles.dropdownItem,
                    ...(item.danger ? styles.dropdownItemDanger : {})
                  }}
                  onClick={() => handleMenuItemClick(item)}
                >
                  <span style={styles.dropdownIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

// Comprehensive styles for the header component
const styles = {
  // Main header container
  header: {
    height: '64px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 30
  },

  // Left section containing menu toggle and breadcrumbs
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },

  // Mobile menu toggle button
  menuToggle: {
    display: 'block',
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'background-color 0.2s ease',
    '@media (min-width: 1024px)': {
      display: 'none'
    }
  },

  // Hamburger menu icon
  hamburger: {
    fontSize: '18px',
    color: '#374151'
  },

  // Breadcrumb navigation container
  breadcrumbs: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },

  // Individual breadcrumb item
  breadcrumbItem: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#6b7280',
    fontSize: '14px',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'all 0.2s ease',
    ':hover': {
      backgroundColor: '#f3f4f6',
      color: '#374151'
    }
  },

  // Active breadcrumb item (current page)
  breadcrumbActive: {
    color: '#1f2937',
    fontWeight: '500'
  },

  // Breadcrumb separator
  breadcrumbSeparator: {
    color: '#d1d5db',
    fontSize: '14px'
  },

  // Right section containing user profile
  rightSection: {
    display: 'flex',
    alignItems: 'center'
  },

  // User section container
  userSection: {
    position: 'relative' as const
  },

  // User profile button
  userButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#f9fafb'
    }
  },

  // User avatar circle
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600'
  },

  // User info container
  userInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: '2px'
  },

  // User name display
  userName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1f2937',
    textTransform: 'capitalize' as const
  },

  // User role display
  userRole: {
    fontSize: '12px',
    color: '#6b7280'
  },

  // Dropdown arrow icon
  dropdownArrow: {
    fontSize: '10px',
    color: '#9ca3af',
    transition: 'transform 0.2s ease'
  },

  // Dropdown menu container
  dropdown: {
    position: 'absolute' as const,
    top: '100%',
    right: 0,
    marginTop: '4px',
    minWidth: '200px',
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    zIndex: 50,
    overflow: 'hidden'
  },

  // Individual dropdown menu item
  dropdownItem: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#f9fafb'
    }
  },

  // Dangerous menu item (like logout)
  dropdownItemDanger: {
    color: '#dc2626',
    ':hover': {
      backgroundColor: '#fef2f2'
    }
  },

  // Dropdown menu item icon
  dropdownIcon: {
    fontSize: '16px',
    minWidth: '20px',
    textAlign: 'center' as const
  }
};

export default Header;