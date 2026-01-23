/**
 * Database Migration Service
 * Handles running database migrations and schema updates
 */

const fs = require('fs')
const path = require('path')

class MigrationService {
  /**
   * Apply a specific migration file
   * @param {Database} db - Database connection
   * @param {string} migrationName - Name of the migration file (without .sql extension)
   * @returns {Promise<boolean>} - True if migration was applied successfully
   */
  static async applyMigration(db, migrationName) {
    try {
      const migrationPath = path.join(__dirname, `../database/${migrationName}.sql`)

      if (!fs.existsSync(migrationPath)) {
        console.warn(`⚠️ Migration file not found: ${migrationPath}`)
        return false
      }

      const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

      console.log(`🔄 Applying migration: ${migrationName}`)
      await db.query(migrationSQL)
      console.log(`✅ Migration applied: ${migrationName}`)

      return true
    } catch (error) {
      console.error(`❌ Migration failed (${migrationName}):`, error.message)
      // Don't throw - let the app continue to run even if migration fails
      return false
    }
  }

  /**
   * Apply all pending migrations
   * @param {Database} db - Database connection
   * @returns {Promise<void>}
   */
  static async applyPendingMigrations(db) {
    const migrations = [
      'add_overall_visibility_to_system_fields'
    ]

    console.log('🔄 Running pending migrations...')

    for (const migration of migrations) {
      await this.applyMigration(db, migration)
    }

    console.log('✅ All pending migrations completed')
  }

  /**
   * Check if a column exists in a table
   * @param {Database} db - Database connection
   * @param {string} tableName - Table name
   * @param {string} columnName - Column name
   * @returns {Promise<boolean>}
   */
  static async columnExists(db, tableName, columnName) {
    try {
      const result = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
      `, [tableName, columnName])

      return result.rows.length > 0
    } catch (error) {
      console.error(`Error checking column existence:`, error.message)
      return false
    }
  }
}

module.exports = MigrationService
