#!/usr/bin/env node

/**
 * Import Database Migration Runner
 * Applies SQL migration files to import databases (not the main app database)
 * This is separate from Prisma migrations which handle the main application database
 */

const fs = require('fs');
const path = require('path');

/**
 * Apply import database migrations to a specific database
 * @param {ImportDatabaseService} db - Connected import database service
 * @returns {Promise<boolean>} True if successful
 */
async function applyImportDatabaseMigrations(db) {
  try {
    console.log('🔄 Applying import database migrations...');
    
    // Create migrations tracking table if it doesn't exist
    await db.executeSQL(`
      CREATE TABLE IF NOT EXISTS _import_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Get all migration files
    const migrationsDir = path.join(__dirname, 'import-db-migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Apply in alphabetical order
    
    if (migrationFiles.length === 0) {
      console.log('📋 No migration files found');
      return true;
    }
    
    console.log(`📋 Found ${migrationFiles.length} migration files`);
    
    // Check which migrations have already been applied
    const appliedMigrations = await db.executeSQL('SELECT filename FROM _import_migrations');
    const appliedFilenames = (appliedMigrations.rows || appliedMigrations).map(row => row.filename);
    
    let appliedCount = 0;
    
    // Apply each migration file
    for (const filename of migrationFiles) {
      if (appliedFilenames.includes(filename)) {
        console.log(`⏭️  Skipping already applied migration: ${filename}`);
        continue;
      }
      
      console.log(`🔧 Applying import migration: ${filename}`);
      
      try {
        // Read and execute migration file
        const migrationPath = path.join(migrationsDir, filename);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Execute the migration
        await db.executeSQL(migrationSQL);
        
        // Record the migration as applied
        await db.executeSQL('INSERT INTO _import_migrations (filename) VALUES ($1)', [filename]);
        
        console.log(`✅ Successfully applied: ${filename}`);
        appliedCount++;
        
      } catch (error) {
        console.error(`❌ Failed to apply migration ${filename}:`, error.message);
        throw error;
      }
    }
    
    if (appliedCount > 0) {
      console.log(`🎉 Applied ${appliedCount} new import database migrations!`);
    } else {
      console.log(`✅ Import database is up to date (no new migrations)`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Import database migration failed:', error.message);
    return false;
  }
}

/**
 * Check if import database has required functions/migrations
 * @param {ImportDatabaseService} db - Connected import database service
 * @returns {Promise<boolean>} True if all required functions exist
 */
async function checkImportDatabaseReady(db) {
  try {
    // Check if analyze_relationships function exists
    const result = await db.executeSQL(`
      SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'analyze_relationships'
      ) as function_exists
    `);
    
    const functionExists = (result.rows || result)[0].function_exists;
    
    if (!functionExists) {
      console.log('⚠️  Import database missing required functions, applying migrations...');
      return await applyImportDatabaseMigrations(db);
    }
    
    console.log('✅ Import database is ready (all functions available)');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to check import database readiness:', error.message);
    return false;
  }
}

module.exports = {
  applyImportDatabaseMigrations,
  checkImportDatabaseReady
};