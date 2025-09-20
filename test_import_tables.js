const { Pool } = require('pg');
require('dotenv').config();

// Use the same database configuration as the main app
const dbConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') ? { rejectUnauthorized: false } : false,
} : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'uppal_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: false
};

const pool = new Pool(dbConfig);

async function testDatabase() {
  try {
    console.log('Connecting to database...');

    // Check existing tables
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('📋 Existing tables:', tablesResult.rows.map(row => row.table_name));

    // Create simple import tables without foreign keys for testing
    console.log('\n🔧 Creating import tables for testing...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS import_jobs (
        id SERIAL PRIMARY KEY,
        organization_id VARCHAR(255),
        user_id VARCHAR(255),
        import_type VARCHAR(50) NOT NULL CHECK (import_type IN ('leads', 'contacts')),
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500),
        file_size INTEGER,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
        field_mapping JSONB,
        import_options JSONB DEFAULT '{}'::jsonb,
        total_rows INTEGER DEFAULT 0,
        processed_rows INTEGER DEFAULT 0,
        successful_rows INTEGER DEFAULT 0,
        failed_rows INTEGER DEFAULT 0,
        duplicate_rows INTEGER DEFAULT 0,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        error_details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS import_errors (
        id SERIAL PRIMARY KEY,
        import_job_id INTEGER NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
        row_number INTEGER NOT NULL,
        row_data JSONB NOT NULL,
        error_type VARCHAR(100) NOT NULL,
        error_field VARCHAR(100),
        error_message TEXT NOT NULL,
        error_code VARCHAR(50),
        severity VARCHAR(20) DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'critical')),
        suggested_fix TEXT,
        error_context JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Import tables created successfully!');

    // Test that tables were created
    const newTablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('import_jobs', 'import_errors')
      ORDER BY table_name;
    `);

    console.log('📋 Import tables:', newTablesResult.rows.map(row => row.table_name));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testDatabase();