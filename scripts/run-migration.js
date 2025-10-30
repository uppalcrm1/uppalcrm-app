/**
 * Migration Runner Script
 * Runs database migrations using Node.js pg library
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Create database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render databases
  }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔌 Connected to Render PostgreSQL database');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Step 1: Check current database state
    console.log('\n📊 STEP 1: Checking current database state...\n');

    const orgCountResult = await client.query('SELECT COUNT(*) FROM organizations');
    const orgCount = parseInt(orgCountResult.rows[0].count);
    console.log(`   ✓ Found ${orgCount} organizations in database`);

    const existingTablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('organization_ai_settings', 'sentiment_analysis_history', 'churn_alerts')
      ORDER BY table_name
    `);

    if (existingTablesResult.rows.length > 0) {
      console.log(`\n   ⚠️  WARNING: Some AI tables already exist:`);
      existingTablesResult.rows.forEach(row => {
        console.log(`      - ${row.table_name}`);
      });
      console.log(`\n   Migration will use IF NOT EXISTS to avoid errors.\n`);
    } else {
      console.log(`   ✓ No AI tables found - clean migration\n`);
    }

    // Step 2: Read migration file
    console.log('📄 STEP 2: Reading migration file...\n');
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '007_organization_ai_settings.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log(`   ✓ Loaded migration file (${(migrationSQL.length / 1024).toFixed(1)} KB)\n`);

    // Step 3: Run migration
    console.log('🚀 STEP 3: Running migration...\n');
    console.log('   This may take 10-30 seconds...\n');

    const startTime = Date.now();
    await client.query(migrationSQL);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`   ✅ Migration completed successfully in ${duration}s\n`);

    // Step 4: Verify tables were created
    console.log('✔️  STEP 4: Verifying tables were created...\n');

    const verifyTablesResult = await client.query(`
      SELECT
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      AND table_name IN ('organization_ai_settings', 'sentiment_analysis_history', 'churn_alerts')
      ORDER BY table_name
    `);

    console.log('   Tables created:');
    verifyTablesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name} (${row.column_count} columns)`);
    });

    // Step 5: Verify indexes
    const indexResult = await client.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('organization_ai_settings', 'sentiment_analysis_history', 'churn_alerts')
      ORDER BY tablename, indexname
    `);

    console.log(`\n   Indexes created: ${indexResult.rows.length}`);

    // Step 6: Check default settings were created
    console.log('\n📋 STEP 5: Checking default AI settings for organizations...\n');

    const settingsResult = await client.query(`
      SELECT
        o.name as org_name,
        o.id as org_id,
        CASE WHEN ai.id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_ai_settings,
        ai.sentiment_enabled,
        ai.churn_threshold_critical,
        ai.churn_threshold_high,
        ai.churn_threshold_medium
      FROM organizations o
      LEFT JOIN organization_ai_settings ai ON o.id = ai.organization_id
      ORDER BY o.name
    `);

    console.log('   Organization AI Settings Status:\n');
    console.log('   ┌─────────────────────────────────────┬──────────┬──────────┬────────────┐');
    console.log('   │ Organization                        │ Settings │ Enabled  │ Thresholds │');
    console.log('   ├─────────────────────────────────────┼──────────┼──────────┼────────────┤');

    settingsResult.rows.forEach(row => {
      const orgName = (row.org_name || 'Unnamed').padEnd(35).substring(0, 35);
      const hasSettings = row.has_ai_settings === 'YES' ? '   ✓    ' : '   ✗    ';
      const enabled = row.sentiment_enabled ? '   YES  ' : '   NO   ';
      const thresholds = row.churn_threshold_critical
        ? `${row.churn_threshold_critical}/${row.churn_threshold_high}/${row.churn_threshold_medium}`.padEnd(10)
        : '   -      ';

      console.log(`   │ ${orgName} │ ${hasSettings} │ ${enabled} │ ${thresholds} │`);
    });
    console.log('   └─────────────────────────────────────┴──────────┴──────────┴────────────┘\n');

    const withSettings = settingsResult.rows.filter(r => r.has_ai_settings === 'YES').length;
    const withoutSettings = settingsResult.rows.filter(r => r.has_ai_settings === 'NO').length;

    if (withSettings === orgCount) {
      console.log(`   ✅ All ${orgCount} organizations have AI settings configured!\n`);
    } else if (withoutSettings > 0) {
      console.log(`   ⚠️  WARNING: ${withoutSettings} organizations missing AI settings`);
      console.log(`   Run the migration again or manually insert settings.\n`);
    }

    // Step 7: Show sample configuration
    if (settingsResult.rows.length > 0 && settingsResult.rows[0].has_ai_settings === 'YES') {
      console.log('📝 STEP 6: Sample AI Settings Configuration:\n');

      const sampleOrg = settingsResult.rows[0];
      const detailsResult = await client.query(`
        SELECT
          sentiment_enabled,
          churn_detection_enabled,
          auto_analyze_emails,
          auto_analyze_tickets,
          churn_threshold_critical,
          churn_threshold_high,
          churn_threshold_medium,
          alert_on_critical,
          alert_on_high,
          alert_on_medium,
          array_length(alert_emails, 1) as email_count,
          alert_slack_webhook IS NOT NULL as has_slack,
          total_analyses,
          analyses_this_month
        FROM organization_ai_settings
        WHERE organization_id = $1
      `, [sampleOrg.org_id]);

      const config = detailsResult.rows[0];

      console.log(`   Organization: ${sampleOrg.org_name}`);
      console.log(`   ┌─────────────────────────────────────┬─────────┐`);
      console.log(`   │ Feature Flags                       │ Value   │`);
      console.log(`   ├─────────────────────────────────────┼─────────┤`);
      console.log(`   │ Sentiment Analysis                  │ ${config.sentiment_enabled ? 'Enabled ' : 'Disabled'} │`);
      console.log(`   │ Churn Detection                     │ ${config.churn_detection_enabled ? 'Enabled ' : 'Disabled'} │`);
      console.log(`   │ Auto-Analyze Emails                 │ ${config.auto_analyze_emails ? 'Enabled ' : 'Disabled'} │`);
      console.log(`   │ Auto-Analyze Tickets                │ ${config.auto_analyze_tickets ? 'Enabled ' : 'Disabled'} │`);
      console.log(`   ├─────────────────────────────────────┼─────────┤`);
      console.log(`   │ Thresholds                          │         │`);
      console.log(`   ├─────────────────────────────────────┼─────────┤`);
      console.log(`   │ Critical (< X%)                     │   ${config.churn_threshold_critical}%   │`);
      console.log(`   │ High (< X%)                         │   ${config.churn_threshold_high}%   │`);
      console.log(`   │ Medium (< X%)                       │   ${config.churn_threshold_medium}%   │`);
      console.log(`   ├─────────────────────────────────────┼─────────┤`);
      console.log(`   │ Alerts                              │         │`);
      console.log(`   ├─────────────────────────────────────┼─────────┤`);
      console.log(`   │ Alert on Critical                   │ ${config.alert_on_critical ? 'Enabled ' : 'Disabled'} │`);
      console.log(`   │ Alert on High                       │ ${config.alert_on_high ? 'Enabled ' : 'Disabled'} │`);
      console.log(`   │ Alert on Medium                     │ ${config.alert_on_medium ? 'Enabled ' : 'Disabled'} │`);
      console.log(`   │ Email Recipients                    │   ${config.email_count || 0}     │`);
      console.log(`   │ Slack Webhook                       │ ${config.has_slack ? 'Set     ' : 'Not Set '} │`);
      console.log(`   ├─────────────────────────────────────┼─────────┤`);
      console.log(`   │ Usage                               │         │`);
      console.log(`   ├─────────────────────────────────────┼─────────┤`);
      console.log(`   │ Total Analyses                      │   ${config.total_analyses}     │`);
      console.log(`   │ This Month                          │   ${config.analyses_this_month}     │`);
      console.log(`   └─────────────────────────────────────┴─────────┘\n`);
    }

    // Final summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!\n');
    console.log('📊 Summary:');
    console.log(`   - Organizations: ${orgCount}`);
    console.log(`   - AI Settings Created: ${withSettings}`);
    console.log(`   - Tables Created: ${verifyTablesResult.rows.length}`);
    console.log(`   - Indexes Created: ${indexResult.rows.length}`);
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('   1. Test API endpoint: GET /api/organizations/current/ai-settings');
    console.log('   2. Test sentiment analysis: POST /api/organizations/current/ai-settings/test');
    console.log('   3. Deploy backend to Render');
    console.log('   4. Build frontend AI Settings admin page');
    console.log('');
    console.log('📚 Documentation: docs/MULTI_TENANT_AI_CONFIGURATION.md');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nFull error:', error);
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
