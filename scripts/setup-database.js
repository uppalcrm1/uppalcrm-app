#!/usr/bin/env node

/**
 * Database setup script for subscription management system
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../database/connection');

async function setupDatabase() {
  console.log('🗄️  Setting up subscription database schema...\n');

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, '../database/subscription_management_schema.sql');

    if (!fs.existsSync(schemaPath)) {
      console.error('❌ Schema file not found:', schemaPath);
      return;
    }

    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    console.log('📖 Reading schema file...');

    // Split and execute the schema
    const statements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📋 Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await query(statement);

        if (statement.includes('CREATE TABLE')) {
          const match = statement.match(/CREATE TABLE.*?(\w+)/i);
          if (match) console.log(`✅ Created table: ${match[1]}`);
        } else if (statement.includes('INSERT INTO subscription_plans')) {
          console.log(`✅ Inserted subscription plans`);
        } else if (statement.includes('CREATE FUNCTION')) {
          const match = statement.match(/CREATE.*FUNCTION (\w+)/i);
          if (match) console.log(`✅ Created function: ${match[1]}`);
        }
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.error(`❌ Error: ${error.message}`);
        }
      }
    }

    // Verify setup
    const tablesResult = await query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name LIKE 'subscription%' OR table_name LIKE 'plan%')
    `);

    console.log(`\n✅ Setup complete! Created ${tablesResult.rows.length} tables.`);

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  setupDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = setupDatabase;