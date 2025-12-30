/**
 * Deploy Migration 003 to Production
 * Updates track_interaction_updates trigger to use last_modified_by column
 *
 * This fixes the error: record "new" has no field "completed_by"
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const PRODUCTION_DB = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

async function runMigration() {
  const client = new Client({
    connectionString: PRODUCTION_DB,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 DEPLOYING MIGRATION 003 TO PRODUCTION');
    console.log('='.repeat(70));
    console.log('\n📋 Migration: Update trigger to use last_modified_by');
    console.log('📦 Environment: PRODUCTION');
    console.log('🗄️  Database: uppalcrm_database');
    console.log('🔧 Fixing: record "new" has no field "completed_by" error\n');

    await client.connect();
    console.log('✅ Connected to production database\n');

    // Check if trigger exists
    console.log('🔍 Checking current trigger...');
    const triggerCheck = await client.query(`
      SELECT pg_get_functiondef(p.oid) as function_definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'track_interaction_updates'
    `);

    if (triggerCheck.rows.length > 0) {
      console.log('✅ Trigger function found: track_interaction_updates');
      const funcDef = triggerCheck.rows[0].function_definition;

      if (funcDef.includes('NEW.completed_by')) {
        console.log('⚠️  Trigger currently uses: NEW.completed_by (needs update)');
      } else if (funcDef.includes('NEW.last_modified_by')) {
        console.log('✅ Trigger already uses: NEW.last_modified_by');
      }
    } else {
      console.log('⚠️  Trigger function not found - will be created');
    }

    // Read and execute migration
    const migrationPath = path.join(__dirname, 'database', 'migrations', '003-update-trigger-use-completed-by.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\n📄 Executing migration SQL...\n');
    console.log('-'.repeat(70));

    // Set up notice listener
    client.on('notice', (msg) => {
      if (msg.message) {
        console.log('   📝', msg.message);
      }
    });

    // Execute the migration
    await client.query(migrationSQL);

    console.log('-'.repeat(70));
    console.log('\n✅ Migration SQL executed successfully!\n');

    // Verify the trigger was updated
    console.log('🔍 Verifying trigger update...\n');

    const afterCheck = await client.query(`
      SELECT pg_get_functiondef(p.oid) as function_definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.proname = 'track_interaction_updates'
    `);

    if (afterCheck.rows.length > 0) {
      const funcDef = afterCheck.rows[0].function_definition;

      console.log('📊 Trigger verification:');

      if (funcDef.includes('NEW.last_modified_by')) {
        console.log('   ✅ Uses NEW.last_modified_by (correct!)');
      } else {
        console.log('   ❌ Does NOT use NEW.last_modified_by');
      }

      if (funcDef.includes('NEW.completed_by')) {
        console.log('   ⚠️  Still references NEW.completed_by (should be removed)');
      } else {
        console.log('   ✅ No references to NEW.completed_by (good!)');
      }

      const count = (funcDef.match(/NEW\.last_modified_by/g) || []).length;
      console.log(`   📊 Found ${count} references to NEW.last_modified_by`);
    } else {
      console.log('   ❌ Trigger function not found after migration!');
      process.exit(1);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRATION 003 DEPLOYED SUCCESSFULLY TO PRODUCTION!');
    console.log('='.repeat(70));
    console.log('\n💡 Next steps:');
    console.log('   1. Test task completion in production');
    console.log('   2. The "completed_by" field error should be gone');
    console.log('   3. Task completion should work now!\n');

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ ERROR DEPLOYING MIGRATION');
    console.error('='.repeat(70));
    console.error('\nError message:', error.message);
    console.error('\nFull error:');
    console.error(error);
    console.error('\n⚠️  MIGRATION FAILED\n');
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed\n');
  }
}

runMigration();
