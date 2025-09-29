/**
 * Environment Settings Utility
 * 
 * Provides centralized access to environment variables for application configuration.
 * All settings are managed through environment variables in .env file.
 * This utility is used by import services to get configuration without API calls.
 */

/**
 * Get application settings from environment variables
 * Used internally by import services to access configuration
 * 
 * @returns {Object} Configuration object with environment variable values
 */
function getSettingsFromEnv() {
  return {
    airtableApiKey: process.env.AIRTABLE_API_KEY,
    airtableBaseId: process.env.AIRTABLE_BASE_ID,
    databaseUrl: process.env.DATABASE_URL
  };
}

/**
 * Check if all required environment variables are configured
 * Used to validate that the application has necessary configuration
 * 
 * @returns {boolean} True if all required settings are present
 */
function isConfigurationComplete() {
  const settings = getSettingsFromEnv();
  return !!(settings.airtableApiKey && settings.airtableBaseId && settings.databaseUrl);
}

/**
 * Get configuration status for logging/debugging purposes
 * Returns which environment variables are configured without exposing values
 * 
 * @returns {Object} Configuration status object
 */
function getConfigurationStatus() {
  const settings = getSettingsFromEnv();
  return {
    airtableApiKey: !!settings.airtableApiKey,
    airtableBaseId: !!settings.airtableBaseId,
    databaseUrl: !!settings.databaseUrl,
    complete: isConfigurationComplete()
  };
}

module.exports = {
  getSettingsFromEnv,
  isConfigurationComplete,
  getConfigurationStatus
};