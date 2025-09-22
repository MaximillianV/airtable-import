const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const ImportService = require('../services/import');

const router = express.Router();

// In-memory settings storage (in production, use a proper database)
const userSettings = new Map();

// Get user settings
router.get('/', authenticateToken, (req, res) => {
  try {
    const settings = userSettings.get(req.user.userId) || {};
    
    // Remove sensitive data before sending
    const sanitizedSettings = {
      airtableBaseId: settings.airtableBaseId || '',
      databaseUrl: settings.databaseUrl ? '***CONFIGURED***' : '',
      airtableApiKey: settings.airtableApiKey ? '***CONFIGURED***' : ''
    };

    res.json(sanitizedSettings);
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user settings
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { airtableApiKey, airtableBaseId, databaseUrl } = req.body;

    if (!airtableApiKey || !airtableBaseId || !databaseUrl) {
      return res.status(400).json({ 
        error: 'Airtable API key, base ID, and database URL are required' 
      });
    }

    // Store settings
    userSettings.set(req.user.userId, {
      airtableApiKey,
      airtableBaseId,
      databaseUrl,
      updatedAt: new Date().toISOString()
    });

    res.json({ 
      message: 'Settings saved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test connections with provided credentials
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { airtableApiKey, airtableBaseId, databaseUrl } = req.body;

    if (!airtableApiKey || !airtableBaseId || !databaseUrl) {
      return res.status(400).json({ 
        error: 'Airtable API key, base ID, and database URL are required' 
      });
    }

    const importService = new ImportService();
    const results = await importService.testConnections(
      airtableApiKey,
      airtableBaseId,
      databaseUrl
    );

    res.json(results);
  } catch (error) {
    console.error('Error testing connections:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user settings for internal use
function getUserSettings(userId) {
  return userSettings.get(userId);
}

module.exports = { router, getUserSettings };