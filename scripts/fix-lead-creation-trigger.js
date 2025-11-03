#!/usr/bin/env node

/**
 * Fix lead creation trigger to use created_by column
 * This prevents NULL constraint violations in lead_change_history
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function fixLeadCreationTrigger() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔧 Fixing lead creation trigger...\n');

    // Read the migration SQL
    const sqlPath = path.join(__dirname, '..', 'database', 'migrations', 'fix-lead-creation-trigger.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📝 Applying migration...');
    await pool.query(sql);

    console.log('✅ Lead creation trigger function updated successfully!');
    console.log('\nChanges:');
    console.log('- Trigger now uses NEW.created_by as primary source for user_id');
    console.log('- Falls back to session variable if created_by is null');
    console.log('- Falls back to assigned_to if session variable is null');
    console.log('- Only inserts history record if user_id is not null');
    console.log('\nThis should fix the NULL constraint violation issue!');

  } catch (error) {
    console.error('❌ Error fixing trigger:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  fixLeadCreationTrigger()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { fixLeadCreationTrigger };
