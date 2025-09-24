/**
 * Users page component provides user management functionality with tabbed interface.
 * Features tabs for Users List, Roles, and Permissions management.
 * Includes user creation, editing, and role assignment capabilities.
 */
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * User data interface for type safety.
 */
interface User {
  /** Unique user identifier */
  id: number;
  /** User email address */
  email: string;
  /** User creation timestamp */
  createdAt: string;
  /** User last update timestamp */
  updatedAt: string;
  /** User role assignments */
  roles?: string[];
  /** User status (active/inactive) */
  status?: 'active' | 'inactive';
}

/**
 * Role data interface for role management.
 */
interface Role {
  /** Unique role identifier */
  id: string;
  /** Role display name */
  name: string;
  /** Role description */
  description: string;
  /** Associated permissions */
  permissions: string[];
}

/**
 * Permission data interface for permission management.
 */
interface Permission {
  /** Unique permission identifier */
  id: string;
  /** Permission name */
  name: string;
  /** Permission description */
  description: string;
  /** Resource this permission applies to */
  resource: string;
}

/**
 * Tab configuration interface for navigation tabs.
 */
interface Tab {
  /** Tab identifier */
  id: string;
  /** Tab display label */
  label: string;
  /** Tab route path */
  path: string;
  /** Tab icon */
  icon: string;
}

/**
 * Users management component with tabbed interface.
 * Provides comprehensive user, role, and permission management.
 * 
 * @returns JSX element representing the users management interface
 */
const Users: React.FC = () => {
  // State management for users, roles, permissions, and UI
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Navigation hooks
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * Tab configuration for Users section navigation.
   * Defines the available tabs and their routing paths.
   */
  const tabs: Tab[] = [
    { id: 'users', label: 'Users List', path: '/admin/users', icon: '👥' },
    { id: 'roles', label: 'Roles', path: '/admin/users/roles', icon: '🔐' },
    { id: 'permissions', label: 'Permissions', path: '/admin/users/permissions', icon: '⚡' }
  ];

  /**
   * Sample users data for demonstration.
   * In a real application, this would come from an API.
   */
  const sampleUsers: User[] = [
    {
      id: 1,
      email: 'admin@example.com',
      createdAt: '2025-09-24T10:00:00Z',
      updatedAt: '2025-09-24T10:00:00Z',
      roles: ['admin'],
      status: 'active'
    },
    {
      id: 2,
      email: 'user@example.com',
      createdAt: '2025-09-24T11:00:00Z',
      updatedAt: '2025-09-24T11:00:00Z',
      roles: ['user'],
      status: 'active'
    }
  ];

  /**
   * Sample roles data for demonstration.
   * Defines different user roles and their permissions.
   */
  const sampleRoles: Role[] = [
    {
      id: 'admin',
      name: 'Administrator',
      description: 'Full system access with all permissions',
      permissions: ['users.read', 'users.write', 'settings.read', 'settings.write', 'import.execute']
    },
    {
      id: 'user',
      name: 'Regular User',
      description: 'Standard user with limited permissions',
      permissions: ['import.execute', 'settings.read']
    }
  ];

  /**
   * Sample permissions data for demonstration.
   * Defines granular permissions for different system resources.
   */
  const samplePermissions: Permission[] = [
    { id: 'users.read', name: 'Read Users', description: 'View user information', resource: 'users' },
    { id: 'users.write', name: 'Write Users', description: 'Create and modify users', resource: 'users' },
    { id: 'settings.read', name: 'Read Settings', description: 'View system settings', resource: 'settings' },
    { id: 'settings.write', name: 'Write Settings', description: 'Modify system settings', resource: 'settings' },
    { id: 'import.execute', name: 'Execute Import', description: 'Run data import operations', resource: 'import' }
  ];

  /**
   * Loads users, roles, and permissions data.
   * In a real application, this would fetch from API endpoints.
   */
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Simulate API calls with sample data
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setUsers(sampleUsers);
      setRoles(sampleRoles);
      setPermissions(samplePermissions);
    } catch (error) {
      console.error('Error loading users data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Determines active tab based on current route path.
   * Updates active tab state when route changes.
   */
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/roles')) {
      setActiveTab('roles');
    } else if (path.includes('/permissions')) {
      setActiveTab('permissions');
    } else {
      setActiveTab('users');
    }
  }, [location.pathname]);

  /**
   * Loads data when component mounts.
   */
  useEffect(() => {
    loadData();
  }, []);

  /**
   * Handles tab navigation clicks.
   * Updates route and active tab state.
   * 
   * @param tab - The tab configuration object that was clicked
   */
  const handleTabClick = (tab: Tab) => {
    setActiveTab(tab.id);
    navigate(tab.path);
  };

  /**
   * Handles user creation form submission.
   * Creates new user and updates the users list.
   * 
   * @param userData - Form data for the new user
   */
  const handleCreateUser = async (userData: Partial<User>) => {
    try {
      // In a real application, this would make an API call
      const newUser: User = {
        id: users.length + 1,
        email: userData.email || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        roles: userData.roles || ['user'],
        status: 'active'
      };
      
      setUsers([...users, newUser]);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  /**
   * Handles user status toggle (active/inactive).
   * Updates user status in the users list.
   * 
   * @param userId - ID of the user to toggle
   */
  const handleToggleUserStatus = (userId: number) => {
    setUsers(users.map(user => 
      user.id === userId 
        ? { ...user, status: user.status === 'active' ? 'inactive' : 'active' }
        : user
    ));
  };

  /**
   * Renders the Users List tab content.
   * Shows table of users with actions for each user.
   */
  const renderUsersTab = () => (
    <div style={styles.tabContent}>
      {/* Users List Header */}
      <div style={styles.tabHeader}>
        <div>
          <h3 style={styles.tabTitle}>Users Management</h3>
          <p style={styles.tabDescription}>Manage system users and their access</p>
        </div>
        <button
          style={styles.primaryButton}
          onClick={() => setShowCreateModal(true)}
        >
          <span>➕</span>
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.tableHeaderCell}>Email</th>
              <th style={styles.tableHeaderCell}>Roles</th>
              <th style={styles.tableHeaderCell}>Status</th>
              <th style={styles.tableHeaderCell}>Created</th>
              <th style={styles.tableHeaderCell}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={styles.tableRow}>
                <td style={styles.tableCell}>
                  <div style={styles.userCell}>
                    <div style={styles.userAvatar}>
                      {user.email.charAt(0).toUpperCase()}
                    </div>
                    <span>{user.email}</span>
                  </div>
                </td>
                <td style={styles.tableCell}>
                  <div style={styles.rolesBadges}>
                    {user.roles?.map(role => (
                      <span key={role} style={styles.roleBadge}>
                        {role}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={styles.tableCell}>
                  <span style={{
                    ...styles.statusBadge,
                    ...(user.status === 'active' ? styles.statusActive : styles.statusInactive)
                  }}>
                    {user.status}
                  </span>
                </td>
                <td style={styles.tableCell}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td style={styles.tableCell}>
                  <div style={styles.actionButtons}>
                    <button
                      style={styles.actionButton}
                      onClick={() => setSelectedUser(user)}
                    >
                      Edit
                    </button>
                    <button
                      style={styles.actionButton}
                      onClick={() => handleToggleUserStatus(user.id)}
                    >
                      {user.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  /**
   * Renders the Roles tab content.
   * Shows available roles and their permissions.
   */
  const renderRolesTab = () => (
    <div style={styles.tabContent}>
      <div style={styles.tabHeader}>
        <div>
          <h3 style={styles.tabTitle}>Role Management</h3>
          <p style={styles.tabDescription}>Define roles and assign permissions</p>
        </div>
        <button style={styles.primaryButton}>
          <span>➕</span>
          Add Role
        </button>
      </div>

      <div style={styles.cardsGrid}>
        {roles.map(role => (
          <div key={role.id} style={styles.roleCard}>
            <div style={styles.roleCardHeader}>
              <h4 style={styles.roleCardTitle}>{role.name}</h4>
              <span style={styles.roleCardId}>{role.id}</span>
            </div>
            <p style={styles.roleCardDescription}>{role.description}</p>
            <div style={styles.permissionsList}>
              <strong>Permissions:</strong>
              <div style={styles.permissionsBadges}>
                {role.permissions.map(permission => (
                  <span key={permission} style={styles.permissionBadge}>
                    {permission}
                  </span>
                ))}
              </div>
            </div>
            <div style={styles.roleCardActions}>
              <button style={styles.secondaryButton}>Edit</button>
              <button style={styles.dangerButton}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Renders the Permissions tab content.
   * Shows all available system permissions organized by resource.
   */
  const renderPermissionsTab = () => {
    // Group permissions by resource for better organization
    const permissionsByResource = permissions.reduce((acc, permission) => {
      if (!acc[permission.resource]) {
        acc[permission.resource] = [];
      }
      acc[permission.resource].push(permission);
      return acc;
    }, {} as Record<string, Permission[]>);

    return (
      <div style={styles.tabContent}>
        <div style={styles.tabHeader}>
          <div>
            <h3 style={styles.tabTitle}>Permissions Management</h3>
            <p style={styles.tabDescription}>Manage system permissions and access control</p>
          </div>
          <button style={styles.primaryButton}>
            <span>➕</span>
            Add Permission
          </button>
        </div>

        {Object.entries(permissionsByResource).map(([resource, resourcePermissions]) => (
          <div key={resource} style={styles.permissionGroup}>
            <h4 style={styles.permissionGroupTitle}>
              {resource.charAt(0).toUpperCase() + resource.slice(1)} Permissions
            </h4>
            <div style={styles.permissionsList}>
              {resourcePermissions.map(permission => (
                <div key={permission.id} style={styles.permissionItem}>
                  <div style={styles.permissionInfo}>
                    <strong style={styles.permissionName}>{permission.name}</strong>
                    <span style={styles.permissionId}>({permission.id})</span>
                    <p style={styles.permissionDescription}>{permission.description}</p>
                  </div>
                  <div style={styles.permissionActions}>
                    <button style={styles.secondaryButton}>Edit</button>
                    <button style={styles.dangerButton}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Loading users data...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Page Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Users & Access Control</h1>
        <p style={styles.description}>
          Manage users, roles, and permissions for your Airtable Import system
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={styles.tabNavigation}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {})
            }}
            onClick={() => handleTabClick(tab)}
          >
            <span style={styles.tabIcon}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && renderUsersTab()}
      {activeTab === 'roles' && renderRolesTab()}
      {activeTab === 'permissions' && renderPermissionsTab()}
    </div>
  );
};

// Comprehensive styles for the Users management component
const styles = {
  // Main container
  container: {
    maxWidth: '1200px',
    margin: '0 auto'
  },

  // Page header
  header: {
    marginBottom: '32px'
  },

  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: '0 0 8px 0'
  },

  description: {
    fontSize: '16px',
    color: '#6b7280',
    margin: 0
  },

  // Tab navigation
  tabNavigation: {
    display: 'flex',
    borderBottom: '2px solid #e5e7eb',
    marginBottom: '32px',
    gap: '4px'
  },

  tab: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease'
  },

  tabActive: {
    color: '#3b82f6',
    borderBottomColor: '#3b82f6'
  },

  tabIcon: {
    fontSize: '16px'
  },

  // Tab content
  tabContent: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
  },

  tabHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px'
  },

  tabTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#1f2937',
    margin: '0 0 4px 0'
  },

  tabDescription: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0
  },

  // Buttons
  primaryButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background-color 0.2s ease'
  },

  secondaryButton: {
    padding: '6px 12px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },

  dangerButton: {
    padding: '6px 12px',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },

  // Table styles
  tableContainer: {
    overflowX: 'auto' as const
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const
  },

  tableHeader: {
    backgroundColor: '#f9fafb'
  },

  tableHeaderCell: {
    padding: '12px',
    textAlign: 'left' as const,
    fontSize: '12px',
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },

  tableRow: {
    borderBottom: '1px solid #e5e7eb'
  },

  tableCell: {
    padding: '12px',
    fontSize: '14px',
    color: '#1f2937'
  },

  userCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },

  userAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '600'
  },

  rolesBadges: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap' as const
  },

  roleBadge: {
    padding: '2px 8px',
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '500'
  },

  statusBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '500',
    textTransform: 'capitalize' as const
  },

  statusActive: {
    backgroundColor: '#d1fae5',
    color: '#065f46'
  },

  statusInactive: {
    backgroundColor: '#fee2e2',
    color: '#991b1b'
  },

  actionButtons: {
    display: 'flex',
    gap: '8px'
  },

  actionButton: {
    padding: '4px 8px',
    backgroundColor: 'transparent',
    color: '#3b82f6',
    border: '1px solid #3b82f6',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },

  // Cards grid
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px'
  },

  roleCard: {
    padding: '20px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    backgroundColor: '#ffffff'
  },

  roleCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },

  roleCardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    margin: 0
  },

  roleCardId: {
    padding: '2px 6px',
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: 'monospace'
  },

  roleCardDescription: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '16px'
  },

  permissionsList: {
    marginBottom: '16px'
  },

  permissionsBadges: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    marginTop: '8px'
  },

  permissionBadge: {
    padding: '2px 6px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderRadius: '4px',
    fontSize: '10px',
    fontFamily: 'monospace'
  },

  roleCardActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px'
  },

  // Permission groups
  permissionGroup: {
    marginBottom: '32px'
  },

  permissionGroupTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '1px solid #e5e7eb'
  },

  permissionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    marginBottom: '8px'
  },

  permissionInfo: {
    flex: 1
  },

  permissionName: {
    fontSize: '14px',
    color: '#1f2937'
  },

  permissionId: {
    fontSize: '12px',
    color: '#6b7280',
    fontFamily: 'monospace',
    marginLeft: '8px'
  },

  permissionDescription: {
    fontSize: '13px',
    color: '#6b7280',
    margin: '4px 0 0 0'
  },

  permissionActions: {
    display: 'flex',
    gap: '8px'
  },

  // Loading state
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    gap: '16px'
  },

  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e5e7eb',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
};

export default Users;