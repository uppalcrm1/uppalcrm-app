/**
 * Database Migration Runner
 * Automatically runs pending migrations on server startup
 */

const fs = require('fs')
const path = require('path')
const { query } = require('./connection')

class MigrationRunner {
  /**
   * Run all pending migrations
   * @returns {Promise<Array>} - Array of migration names that were executed
   */
  static async runPending() {
    try {
      const executedMigrations = []

      // List of migrations to run in order
      const migrations = [
        'add_overall_visibility_to_system_fields'
      ]

      console.log(`🔄 Running ${migrations.length} migration(s)...`)

      for (const migrationName of migrations) {
        try {
          const migrationPath = path.join(__dirname, `${migrationName}.sql`)

          if (!fs.existsSync(migrationPath)) {
            console.warn(`⚠️ Migration file not found: ${migrationPath}`)
            continue
          }

          console.log(`  🔧 Executing: ${migrationName}`)
          const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

          // Execute the migration
          await query(migrationSQL)
          executedMigrations.push(migrationName)

          console.log(`  ✅ Completed: ${migrationName}`)
        } catch (error) {
          // Some migrations may fail if their changes are already applied
          // This is OK - we just log it and continue
          if (error.message && error.message.includes('already exists')) {
            console.log(`  ℹ️  Already applied: ${migrationName}`)
            executedMigrations.push(migrationName)
          } else {
            console.error(`  ⚠️  Migration failed (${migrationName}): ${error.message}`)
            // Don't throw - let the app continue running even if one migration fails
          }
        }
      }

      console.log(`✅ Migration run complete (${executedMigrations.length} executed)`)
      return executedMigrations
    } catch (error) {
      console.error('❌ Fatal migration error:', error)
      throw error
    }
  }
}

module.exports = MigrationRunner
