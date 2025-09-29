const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireSettingsPermission } = require('../middleware/permissions');

const router = express.Router();

// Settings are now managed via environment variables - no database needed

/**
 * GET /api/settings - Retrieve current system configuration status from environment variables
 * Returns whether required environment variables are configured
 * Requires ADMIN or SUPERADMIN permissions for access
 */
router.get('/', authenticateToken, requireSettingsPermission, async (req, res) => {
  try {
    // Get settings from environment variables
    const airtableApiKey = process.env.AIRTABLE_API_KEY;
    const airtableBaseId = process.env.AIRTABLE_BASE_ID;
    const databaseUrl = process.env.DATABASE_URL;
    
    // Check if configuration is complete
    const airtableConfigured = !!(airtableApiKey && airtableBaseId);
    const databaseConfigured = !!databaseUrl;
    
    // Return configuration status (hide sensitive values)
    const configStatus = {
      airtableApiKey: airtableConfigured ? '***CONFIGURED***' : '',
      airtableBaseId: airtableBaseId || '',
      databaseUrl: databaseConfigured ? '***CONFIGURED***' : '',
      configurationComplete: airtableConfigured && databaseConfigured
    };

    res.json(configStatus);
  } catch (error) {
    console.error('❌ Error getting settings:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST route removed - all settings are now managed via environment variables
// Use .env file to configure AIRTABLE_API_KEY, AIRTABLE_BASE_ID, and DATABASE_URL

/**
 * Get settings from environment variables for internal use by other services
 * Returns the environment-based configuration for service-to-service calls
 * 
 * @returns {Object} Environment-based settings
 */
function getSettingsFromEnv() {
  return {
    airtableApiKey: process.env.AIRTABLE_API_KEY,
    airtableBaseId: process.env.AIRTABLE_BASE_ID,
    databaseUrl: process.env.DATABASE_URL
  };
}

module.exports = { router, getSettingsFromEnv };