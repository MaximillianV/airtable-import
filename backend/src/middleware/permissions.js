/**
 * Permission middleware for role-based access control.
 * Implements superadmin permissions where SUPERADMIN role gets automatic access to all features.
 * Provides fine-grained permission checking for specific features like debug mode, settings management, etc.
 */

/**
 * Permission middleware factory that creates middleware for specific permission checks.
 * SUPERADMIN users automatically bypass all permission checks for full system access.
 * 
 * @param {string} permission - The permission name to check (e.g., 'debug', 'settings', 'user_management')
 * @param {Object} options - Configuration options for permission checking
 * @param {boolean} options.allowAdmin - Whether ADMIN role should also have this permission
 * @returns {Function} Express middleware function for permission checking
 */
function requirePermission(permission, options = {}) {
  return (req, res, next) => {
    try {
      // Extract user information from JWT token (set by auth middleware)
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ 
          error: 'Authentication required for permission check',
          permission,
          required: true
        });
      }
      
      // SUPERADMIN users have automatic access to all features
      // This provides a master override for system administration
      if (user.role === 'SUPERADMIN') {
        console.log(`🔑 SUPERADMIN access granted for permission: ${permission}`);
        return next();
      }
      
      // Check specific permission based on user role
      const hasPermission = checkUserPermission(user.role, permission, options);
      
      if (!hasPermission) {
        console.log(`🚫 Permission denied for user ${user.email} (${user.role}) - required: ${permission}`);
        return res.status(403).json({ 
          error: 'Insufficient permissions for this operation',
          permission,
          userRole: user.role,
          required: true
        });
      }
      
      console.log(`✅ Permission granted for user ${user.email} (${user.role}) - permission: ${permission}`);
      next();
    } catch (error) {
      console.error('Permission check failed:', error);
      res.status(500).json({ 
        error: 'Permission validation error',
        permission
      });
    }
  };
}

/**
 * Check if a user role has a specific permission.
 * Implements the permission matrix for different user roles.
 * 
 * @param {string} userRole - The user's role (USER, ADMIN, SUPERADMIN)
 * @param {string} permission - The permission to check
 * @param {Object} options - Permission check options
 * @returns {boolean} True if user has the permission, false otherwise
 */
function checkUserPermission(userRole, permission, options = {}) {
  // Permission matrix defining what each role can access
  const permissions = {
    USER: [
      'import',           // Can perform data imports
      'view_sessions'     // Can view their import sessions
    ],
    ADMIN: [
      'import',           // Can perform data imports
      'view_sessions',    // Can view import sessions
      'settings',         // Can modify system settings
      'view_users'        // Can view user list
    ],
    SUPERADMIN: [
      '*'                 // Wildcard - has all permissions
    ]
  };
  
  // Get permissions for user role
  const rolePermissions = permissions[userRole] || [];
  
  // SUPERADMIN wildcard check (should be handled above, but double-check)
  if (rolePermissions.includes('*')) {
    return true;
  }
  
  // Direct permission check
  if (rolePermissions.includes(permission)) {
    return true;
  }
  
  // Check if ADMIN role should also have this permission
  if (options.allowAdmin && userRole === 'ADMIN') {
    return true;
  }
  
  return false;
}

/**
 * Middleware to require debug permissions.
 * Only SUPERADMIN and optionally ADMIN users can access debug features.
 */
const requireDebugPermission = requirePermission('debug', { allowAdmin: true });

/**
 * Middleware to require settings management permissions.
 * Only SUPERADMIN and ADMIN users can modify system settings.
 */
const requireSettingsPermission = requirePermission('settings', { allowAdmin: true });

/**
 * Middleware to require user management permissions.
 * Only SUPERADMIN users can manage other users.
 */
const requireUserManagementPermission = requirePermission('user_management');

/**
 * Check if current user has a specific permission (for use in route handlers).
 * Useful for conditional feature availability in API responses.
 * 
 * @param {Object} user - User object from JWT token
 * @param {string} permission - Permission to check
 * @returns {boolean} True if user has permission
 */
function hasPermission(user, permission) {
  if (!user) return false;
  
  // SUPERADMIN always has all permissions
  if (user.role === 'SUPERADMIN') {
    return true;
  }
  
  return checkUserPermission(user.role, permission);
}

module.exports = {
  requirePermission,
  requireDebugPermission,
  requireSettingsPermission,
  requireUserManagementPermission,
  hasPermission,
  checkUserPermission
};