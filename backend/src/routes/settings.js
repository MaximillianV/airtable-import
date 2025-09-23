const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const ImportService = require('../services/import');
const DatabaseService = require('../services/database');

const router = express.Router();

// Initialize database service
const db = new DatabaseService();

/**
 * Initialize database connection for settings management
 */
async function initializeSettingsService() {
  try {
    await db.connect();
    console.log('✅ Settings service database connection established');
  } catch (error) {
    console.error('❌ Failed to connect settings service to database:', error.message);
  }
}

// Initialize on startup
initializeSettingsService();

/**
 * Get user settings endpoint
 * Retrieves settings from Prisma database with sensitive data sanitization
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get settings from database using Prisma
    const settings = await db.getSettings(req.user.userId);
    
    // Return sanitized settings (hide sensitive data)
    const sanitizedSettings = {
      airtableBaseId: settings?.airtableBaseId || '',
      databaseUrl: settings?.databaseUrl ? '***CONFIGURED***' : '',
      airtableApiKey: settings?.airtableApiKey ? '***CONFIGURED***' : '',
      lastUpdated: settings?.updatedAt || null
    };

    res.json(sanitizedSettings);
  } catch (error) {
    console.error('❌ Error getting settings:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update user settings endpoint
 * Saves settings to Prisma database with validation
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { airtableApiKey, airtableBaseId, databaseUrl } = req.body;

    // Get existing settings to support partial updates
    const userId = req.user.userId;
    const existingSettings = await db.getSettings(userId);
    
    // Prepare update object with only provided values
    const updateData = {};
    
    // Only update airtableApiKey if provided and not empty
    if (airtableApiKey && airtableApiKey.trim() !== '') {
      updateData.airtableApiKey = airtableApiKey;
    } else if (existingSettings?.airtableApiKey) {
      updateData.airtableApiKey = existingSettings.airtableApiKey;
    }
    
    // Only update airtableBaseId if provided and not empty
    if (airtableBaseId && airtableBaseId.trim() !== '') {
      updateData.airtableBaseId = airtableBaseId;
    } else if (existingSettings?.airtableBaseId) {
      updateData.airtableBaseId = existingSettings.airtableBaseId;
    }
    
    // Only update databaseUrl if provided (can be empty to clear)
    if (databaseUrl !== undefined) {
      updateData.databaseUrl = databaseUrl;
    } else if (existingSettings?.databaseUrl) {
      updateData.databaseUrl = existingSettings.databaseUrl;
    }

    // Validate that we have required fields after merging
    if (!updateData.airtableApiKey || !updateData.airtableBaseId) {
      return res.status(400).json({ 
        error: 'Airtable API key and base ID are required. Please provide missing values or ensure they are already configured.' 
      });
    }

    // Validate URL format if provided
    if (updateData.databaseUrl && updateData.databaseUrl.trim() !== '') {
      try {
        new URL(updateData.databaseUrl);
      } catch (urlError) {
        return res.status(400).json({ 
          error: 'Invalid database URL format' 
        });
      }
    }

    // Save settings using Prisma
    const savedSettings = await db.saveSettings(userId, updateData);

    console.log(`✅ Settings saved for user ${req.user.email}`);
    res.json({ 
      message: 'Settings saved successfully',
      timestamp: savedSettings.updatedAt
    });
  } catch (error) {
    console.error('❌ Error saving settings:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Test connections endpoint
 * Validates Airtable and database connections without saving settings
 */
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { airtableApiKey, airtableBaseId, databaseUrl } = req.body;

    // Validate required fields
    if (!airtableApiKey || !airtableBaseId || !databaseUrl) {
      return res.status(400).json({ 
        error: 'Airtable API key, base ID, and database URL are required' 
      });
    }

    // Test connections using import service
    const importService = new ImportService();
    const results = await importService.testConnections(
      airtableApiKey,
      airtableBaseId,
      databaseUrl
    );

    console.log(`✅ Connection test completed for user ${req.user.email}:`, {
      airtable: results.airtable.success,
      database: results.database.success
    });

    res.json(results);
  } catch (error) {
    console.error('❌ Error testing connections:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get user settings for internal use by other services
 * Returns the actual settings object (not sanitized) for service-to-service calls
 * 
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} User settings or null if not found
 */
async function getUserSettings(userId) {
  try {
    return await db.getSettings(userId);
  } catch (error) {
    console.error('❌ Error getting user settings:', error.message);
    return null;
  }
}

module.exports = { router, getUserSettings };