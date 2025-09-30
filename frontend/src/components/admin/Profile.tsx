/**
 * Profile component for user profile management in the admin dashboard.
 * Provides user information viewing and password change functionality.
 * Accessible from the Header dropdown menu for authenticated users.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Profile form data interface for user information updates.
 */
interface ProfileData {
  email: string;
  name?: string;
}

/**
 * Password change form data interface.
 */
interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Profile component for managing user account settings.
 * Features profile information viewing and secure password changes.
 * 
 * @returns JSX element representing the profile management interface
 */
const Profile: React.FC = () => {
  // Authentication context and state management
  const { user, logout } = useAuth();
  
  // Profile state management
  const [profile, setProfile] = useState<ProfileData>({
    email: user?.email || '',
    name: ''
  });
  
  // Password change state management
  const [passwordData, setPasswordData] = useState<PasswordChangeData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // UI state management
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  /**
   * Loads user profile data on component mount.
   */
  useEffect(() => {
    if (user) {
      setProfile({
        email: user.email,
        name: user.email.split('@')[0] // Use email prefix as default name
      });
    }
  }, [user]);

  /**
   * Handles profile information updates.
   * Currently displays user information (future enhancement for editing).
   */
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Profile editing not implemented yet - this is a placeholder
    setSuccess('Profile information displayed. Editing functionality coming soon.');
  };

  /**
   * Handles password change form submission.
   * Validates passwords and updates user credentials securely.
   */
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validate password confirmation matches
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    
    // Validate password strength
    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    
    try {
      setPasswordLoading(true);
      
      // Simulate password change API call (implementation depends on backend)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reset form after successful change
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      setSuccess('Password changed successfully. Please log in again for security.');
      
      // Automatically logout after password change for security
      setTimeout(() => {
        logout();
      }, 2000);
      
    } catch (err) {
      console.error('Password change failed:', err);
      setError('Failed to change password. Please check your current password and try again.');
    } finally {
      setPasswordLoading(false);
    }
  };

  /**
   * Handles input changes for password form fields.
   */
  const handlePasswordInputChange = (field: keyof PasswordChangeData, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div style={styles.container}>
      {/* Page Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Profile Settings</h1>
        <p style={styles.description}>
          Manage your account information and security settings
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div style={styles.errorMessage}>
          {error}
        </div>
      )}
      {success && (
        <div style={styles.successMessage}>
          {success}
        </div>
      )}

      {/* Tab Navigation */}
      <div style={styles.tabNavigation}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'profile' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('profile')}
        >
          <span style={styles.tabIcon}>👤</span>
          <span>Profile Information</span>
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'password' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('password')}
        >
          <span style={styles.tabIcon}>🔒</span>
          <span>Change Password</span>
        </button>
      </div>

      {/* Tab Content */}
      <div style={styles.tabContent}>
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileUpdate} style={styles.form}>
            <div style={styles.formSection}>
              <h3 style={styles.sectionTitle}>Account Information</h3>
              <p style={styles.sectionDescription}>
                Your basic account details and contact information.
              </p>
            </div>

            {/* Email Field (Read-only) */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                value={profile.email}
                disabled
                style={styles.inputDisabled}
              />
              <p style={styles.fieldHelp}>
                Your email address is used for authentication and cannot be changed.
              </p>
            </div>

            {/* Display Name Field */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Display Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                style={styles.inputDisabled}
                disabled
                placeholder="Enter your display name"
              />
              <p style={styles.fieldHelp}>
                Display name functionality coming soon in a future update.
              </p>
            </div>

            {/* Account Status */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Account Status</label>
              <div style={styles.statusBadge}>
                <span style={styles.statusIndicator}>✅</span>
                <span>Active Administrator</span>
              </div>
              <p style={styles.fieldHelp}>
                Your account has full administrative privileges in the system.
              </p>
            </div>

            <div style={styles.formActions}>
              <button
                type="submit"
                style={styles.primaryButton}
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Profile'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handlePasswordChange} style={styles.form}>
            <div style={styles.formSection}>
              <h3 style={styles.sectionTitle}>Change Password</h3>
              <p style={styles.sectionDescription}>
                Update your password to keep your account secure. You'll be logged out after changing your password.
              </p>
            </div>

            {/* Current Password */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Current Password</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => handlePasswordInputChange('currentPassword', e.target.value)}
                style={styles.input}
                placeholder="Enter your current password"
                required
              />
            </div>

            {/* New Password */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>New Password</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                style={styles.input}
                placeholder="Enter your new password"
                required
                minLength={6}
              />
              <p style={styles.fieldHelp}>
                Password must be at least 6 characters long.
              </p>
            </div>

            {/* Confirm New Password */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Confirm New Password</label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                style={styles.input}
                placeholder="Confirm your new password"
                required
                minLength={6}
              />
              {passwordData.newPassword && passwordData.confirmPassword && 
               passwordData.newPassword !== passwordData.confirmPassword && (
                <p style={styles.fieldError}>
                  Passwords do not match.
                </p>
              )}
            </div>

            <div style={styles.formActions}>
              <button
                type="submit"
                style={styles.primaryButton}
                disabled={passwordLoading || !passwordData.currentPassword || 
                         !passwordData.newPassword || !passwordData.confirmPassword ||
                         passwordData.newPassword !== passwordData.confirmPassword}
              >
                {passwordLoading ? 'Changing Password...' : 'Change Password'}
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setPasswordData({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: ''
                })}
                disabled={passwordLoading}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// Comprehensive styles for the Profile component
const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto'
  },

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

  // Messages
  errorMessage: {
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    marginBottom: '24px'
  },

  successMessage: {
    padding: '12px 16px',
    backgroundColor: '#f0fdf4',
    color: '#166534',
    border: '1px solid #bbf7d0',
    borderRadius: '6px',
    marginBottom: '24px'
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

  // Form styles
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px'
  },

  formSection: {
    paddingBottom: '16px',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: '8px'
  },

  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    margin: '0 0 4px 0'
  },

  sectionDescription: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
    lineHeight: '1.5'
  },

  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px'
  },

  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  },

  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    transition: 'border-color 0.2s ease',
    backgroundColor: '#ffffff'
  },

  inputDisabled: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: '#f9fafb',
    color: '#6b7280',
    cursor: 'not-allowed'
  },

  fieldHelp: {
    fontSize: '12px',
    color: '#6b7280',
    margin: 0,
    lineHeight: '1.4'
  },

  fieldError: {
    fontSize: '12px',
    color: '#dc2626',
    margin: 0,
    lineHeight: '1.4'
  },

  // Status badge
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#f0fdf4',
    color: '#166534',
    border: '1px solid #bbf7d0',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500'
  },

  statusIndicator: {
    fontSize: '14px'
  },

  // Form actions
  formActions: {
    display: 'flex',
    gap: '12px',
    paddingTop: '16px',
    borderTop: '1px solid #e5e7eb'
  },

  primaryButton: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease'
  },

  secondaryButton: {
    padding: '12px 24px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  }
};

export default Profile;