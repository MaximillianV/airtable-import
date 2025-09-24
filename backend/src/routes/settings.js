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
    
    // Determine database URL status
    let databaseUrlStatus = 'default';
    if (settings?.databaseUrl) {
      // Check if it's a custom database URL (not the default local one)
      const isLocalDefault = settings.databaseUrl.includes('localhost') || 
                            settings.databaseUrl.includes('127.0.0.1') ||
                            settings.databaseUrl.includes('.sqlite') ||
                            settings.databaseUrl.startsWith('postgresql://postgres:password@localhost');
      databaseUrlStatus = isLocalDefault ? 'default' : 'configured';
    }
    
    // Return sanitized settings (hide sensitive data)
    const sanitizedSettings = {
      airtableBaseId: settings?.airtableBaseId || '',
      databaseUrl: settings?.databaseUrl ? (databaseUrlStatus === 'default' ? '***DEFAULT***' : '***CONFIGURED***') : '',
      databaseUrlStatus: databaseUrlStatus,
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
 * Reset database URL to default endpoint
 */
router.post('/reset-database', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const existingSettings = await db.getSettings(userId);
    
    if (!existingSettings) {
      return res.status(404).json({ error: 'No settings found to reset' });
    }

    // Reset to default local PostgreSQL URL
    const defaultDatabaseUrl = 'postgresql://postgres:password@localhost:5432/airtable_import';
    
    const updateData = {
      airtableApiKey: existingSettings.airtableApiKey,
      airtableBaseId: existingSettings.airtableBaseId,
      databaseUrl: defaultDatabaseUrl
    };

    await db.saveSettings(userId, updateData);
    
    console.log(`✅ Database URL reset to default for user ${req.user.email}`);
    res.json({ 
      message: 'Database URL reset to default successfully'
    });
  } catch (error) {
    console.error('❌ Error resetting database URL:', error.message);
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
 * Test connections using saved settings endpoint
 * Retrieves user's actual saved settings and tests connections
 */
router.post('/test-saved', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get the actual saved settings (not sanitized)
    const settings = await db.getSettings(userId);
    
    if (!settings) {
      return res.status(404).json({ 
        error: 'No settings found. Please configure your settings first.' 
      });
    }

    // Validate that we have the required settings
    if (!settings.airtableApiKey || !settings.airtableBaseId || !settings.databaseUrl) {
      return res.status(400).json({ 
        error: 'Incomplete settings. Please ensure Airtable API key, base ID, and database URL are configured.' 
      });
    }

    // Test connections using import service with actual saved values
    const importService = new ImportService();
    const results = await importService.testConnections(
      settings.airtableApiKey,
      settings.airtableBaseId,
      settings.databaseUrl
    );

    console.log(`✅ Connection test completed using saved settings for user ${req.user.email}:`, {
      airtable: results.airtable.success,
      database: results.database.success
    });

    res.json(results);
  } catch (error) {
    console.error('❌ Error testing saved connections:', error.message);
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