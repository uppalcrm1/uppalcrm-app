const fs = require('fs').promises;
const path = require('path');
const db = require('./connection');

class MigrationRunner {
  constructor() {
    this.migrationsDir = path.join(__dirname, 'migrations');
  }

  async ensureMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await db.query(query);
    console.log('✅ Schema migrations table ready');
  }

  async getAppliedMigrations() {
    try {
      const result = await db.query(
        'SELECT version FROM schema_migrations ORDER BY version'
      );
      return result.rows.map(row => row.version);
    } catch (error) {
      console.log('⚠️ Migrations table does not exist yet');
      return [];
    }
  }

  async getPendingMigrations() {
    await this.ensureMigrationsTable();
    const appliedMigrations = await this.getAppliedMigrations();

    const files = await fs.readdir(this.migrationsDir);
    const migrationFiles = files
      .filter(f => f.endsWith('.sql') && f !== 'schema_migrations.sql')
      .sort();

    const pending = migrationFiles.filter(file => {
      const version = file.split('_')[0];
      return !appliedMigrations.includes(version);
    });

    return pending;
  }

  async runMigration(filename) {
    const filePath = path.join(this.migrationsDir, filename);
    const sql = await fs.readFile(filePath, 'utf8');
    const version = filename.split('_')[0];
    const name = filename.replace('.sql', '');

    console.log(`🔄 Running migration: ${filename}`);

    try {
      // Split SQL into statements, separating CREATE INDEX CONCURRENTLY
      const statements = this.parseStatements(sql);
      const { concurrentStatements, transactionalStatements } = this.separateConcurrentStatements(statements);

      // Get a client directly from the pool for manual transaction control
      const client = await db.pool.connect();

      try {
        // Run transactional statements in a transaction
        if (transactionalStatements.length > 0) {
          await client.query('BEGIN');
          try {
            for (const stmt of transactionalStatements) {
              if (stmt.trim()) {
                await client.query(stmt);
              }
            }
            await client.query('COMMIT');
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          }
        }

        // Run CONCURRENT statements separately (outside of transaction)
        for (const stmt of concurrentStatements) {
          if (stmt.trim()) {
            console.log('  ⚡ Running concurrent index creation...');
            await client.query(stmt);
          }
        }
      } finally {
        client.release();
      }

      // Record migration
      await db.query(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        [version, name]
      );

      console.log(`✅ Migration completed: ${filename}`);
      return { success: true, version, name };
    } catch (error) {
      console.error(`❌ Migration failed: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Parse SQL into individual statements
   * Handles multi-line statements and comments
   */
  parseStatements(sql) {
    // Remove comments
    let cleaned = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    // Split by semicolon but preserve statements
    const statements = cleaned
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    return statements;
  }

  /**
   * Separate CREATE INDEX CONCURRENTLY from other statements
   * These must run outside of transactions
   */
  separateConcurrentStatements(statements) {
    const concurrentStatements = [];
    const transactionalStatements = [];

    for (const stmt of statements) {
      if (stmt.toUpperCase().includes('CREATE INDEX') && stmt.toUpperCase().includes('CONCURRENTLY')) {
        concurrentStatements.push(stmt);
      } else {
        transactionalStatements.push(stmt);
      }
    }

    return { concurrentStatements, transactionalStatements };
  }

  async runPending() {
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      console.log('✅ No pending migrations');
      return [];
    }

    console.log(`📋 Found ${pending.length} pending migration(s)`);
    const results = [];

    for (const migration of pending) {
      try {
        const result = await this.runMigration(migration);
        results.push(result);
      } catch (error) {
        console.error(`❌ Migration failed, stopping: ${migration}`);
        throw error;
      }
    }

    return results;
  }

  async status() {
    await this.ensureMigrationsTable();
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();

    return {
      applied: applied.length,
      pending: pending.length,
      appliedMigrations: applied,
      pendingMigrations: pending
    };
  }
}

module.exports = new MigrationRunner();
