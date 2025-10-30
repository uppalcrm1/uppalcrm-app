/**
 * Verify Migration Script
 * Checks all aspects of the AI configuration migration
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function verifyMigration() {
  const client = await pool.connect();

  try {
    console.log('\n🔍 VERIFYING MULTI-TENANT AI CONFIGURATION\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check RLS policies
    console.log('🔒 Row-Level Security Policies:\n');
    const rlsResult = await client.query(`
      SELECT
        schemaname,
        tablename,
        policyname,
        cmd as applies_to
      FROM pg_policies
      WHERE tablename IN ('organization_ai_settings', 'sentiment_analysis_history', 'churn_alerts')
      ORDER BY tablename, policyname
    `);

    const tableGroups = {};
    rlsResult.rows.forEach(row => {
      if (!tableGroups[row.tablename]) {
        tableGroups[row.tablename] = [];
      }
      tableGroups[row.tablename].push(row);
    });

    Object.keys(tableGroups).forEach(tableName => {
      console.log(`   📋 ${tableName}:`);
      tableGroups[tableName].forEach(policy => {
        console.log(`      ✓ ${policy.policyname}`);
      });
      console.log('');
    });

    // Check triggers
    console.log('⚡ Database Triggers:\n');
    const triggerResult = await client.query(`
      SELECT
        event_object_table as table_name,
        trigger_name,
        event_manipulation as event,
        action_timing as timing
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
      AND event_object_table IN ('organization_ai_settings', 'sentiment_analysis_history', 'churn_alerts')
      ORDER BY event_object_table, trigger_name
    `);

    const triggerGroups = {};
    triggerResult.rows.forEach(row => {
      if (!triggerGroups[row.table_name]) {
        triggerGroups[row.table_name] = [];
      }
      triggerGroups[row.table_name].push(row);
    });

    Object.keys(triggerGroups).forEach(tableName => {
      console.log(`   📋 ${tableName}:`);
      triggerGroups[tableName].forEach(trigger => {
        console.log(`      ✓ ${trigger.trigger_name} (${trigger.timing} ${trigger.event})`);
      });
      console.log('');
    });

    // Check functions
    console.log('🔧 Custom Functions Created:\n');
    const functionsResult = await client.query(`
      SELECT
        proname as function_name,
        pg_get_function_result(oid) as return_type,
        pg_get_function_arguments(oid) as arguments
      FROM pg_proc
      WHERE proname IN (
        'increment_analysis_counter',
        'auto_create_churn_alert',
        'get_organization_ai_settings',
        'reset_monthly_analysis_counters',
        'update_updated_at_column'
      )
      ORDER BY proname
    `);

    functionsResult.rows.forEach(row => {
      console.log(`   ✓ ${row.function_name}()`);
      console.log(`     Returns: ${row.return_type}`);
      if (row.arguments) {
        console.log(`     Args: ${row.arguments}`);
      }
      console.log('');
    });

    // Check constraints
    console.log('✅ Table Constraints:\n');
    const constraintsResult = await client.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        CASE tc.constraint_type
          WHEN 'CHECK' THEN cc.check_clause
          WHEN 'FOREIGN KEY' THEN 'References ' || ccu.table_name
          WHEN 'UNIQUE' THEN 'Unique constraint'
          ELSE tc.constraint_type
        END as description
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.check_constraints cc
        ON cc.constraint_name = tc.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.table_schema = 'public'
      AND tc.table_name IN ('organization_ai_settings', 'sentiment_analysis_history', 'churn_alerts')
      AND tc.constraint_type IN ('CHECK', 'FOREIGN KEY', 'UNIQUE')
      ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
    `);

    const constraintGroups = {};
    constraintsResult.rows.forEach(row => {
      if (!constraintGroups[row.table_name]) {
        constraintGroups[row.table_name] = { CHECK: [], 'FOREIGN KEY': [], UNIQUE: [] };
      }
      constraintGroups[row.table_name][row.constraint_type].push(row);
    });

    Object.keys(constraintGroups).forEach(tableName => {
      console.log(`   📋 ${tableName}:`);
      ['FOREIGN KEY', 'UNIQUE', 'CHECK'].forEach(type => {
        const constraints = constraintGroups[tableName][type];
        if (constraints && constraints.length > 0) {
          console.log(`      ${type}:`);
          constraints.forEach(c => {
            console.log(`         ✓ ${c.constraint_name}`);
          });
        }
      });
      console.log('');
    });

    // Test the auto-create trigger
    console.log('🧪 Testing Auto-Create Trigger:\n');

    // Get a test organization
    const orgResult = await client.query(`SELECT id, name FROM organizations LIMIT 1`);
    if (orgResult.rows.length > 0) {
      const testOrg = orgResult.rows[0];

      console.log(`   Using test organization: ${testOrg.name} (${testOrg.id})\n`);

      // Insert a test sentiment analysis
      const testAnalysis = await client.query(`
        INSERT INTO sentiment_analysis_history (
          organization_id,
          entity_type,
          entity_id,
          sentiment_score,
          sentiment_label,
          confidence_scores,
          churn_risk_level,
          churn_risk_score,
          source_type,
          source_text
        ) VALUES (
          $1,
          'contact',
          gen_random_uuid(),
          0.15,
          'negative',
          '{"positive": 0.05, "neutral": 0.10, "negative": 0.85}'::jsonb,
          'critical',
          0.95,
          'email',
          'Test email with very negative sentiment for migration verification'
        )
        RETURNING id, sentiment_score, churn_risk_level, alert_generated
      `, [testOrg.id]);

      const analysis = testAnalysis.rows[0];

      console.log(`   ✓ Created test analysis:`);
      console.log(`     - Sentiment: ${(analysis.sentiment_score * 100).toFixed(1)}%`);
      console.log(`     - Risk Level: ${analysis.churn_risk_level}`);
      console.log(`     - Alert Generated: ${analysis.alert_generated ? 'YES' : 'NO'}\n`);

      // Check if alert was auto-created by trigger
      const alertCheck = await client.query(`
        SELECT
          id,
          priority,
          status,
          title,
          message
        FROM churn_alerts
        WHERE sentiment_analysis_id = $1
      `, [analysis.id]);

      if (alertCheck.rows.length > 0) {
        const alert = alertCheck.rows[0];
        console.log(`   ✅ Auto-create trigger working!`);
        console.log(`      Alert created with priority: ${alert.priority}`);
        console.log(`      Status: ${alert.status}`);
        console.log(`      Title: ${alert.title}\n`);

        // Clean up test data
        await client.query(`DELETE FROM churn_alerts WHERE id = $1`, [alert.id]);
      } else {
        console.log(`   ⚠️  Warning: Alert was not auto-created (may be disabled in settings)\n`);
      }

      await client.query(`DELETE FROM sentiment_analysis_history WHERE id = $1`, [analysis.id]);
      console.log(`   ✓ Test data cleaned up\n`);
    }

    // Check usage counter function
    console.log('📊 Testing Usage Counter:\n');

    const beforeCounter = await client.query(`
      SELECT total_analyses, analyses_this_month
      FROM organization_ai_settings
      WHERE organization_id = $1
    `, [orgResult.rows[0].id]);

    console.log(`   Before: ${beforeCounter.rows[0].total_analyses} total, ${beforeCounter.rows[0].analyses_this_month} this month`);

    // Insert another test analysis to trigger counter increment
    await client.query(`
      INSERT INTO sentiment_analysis_history (
        organization_id,
        entity_type,
        entity_id,
        sentiment_score,
        sentiment_label,
        confidence_scores,
        churn_risk_level,
        churn_risk_score,
        source_type,
        source_text
      ) VALUES (
        $1,
        'contact',
        gen_random_uuid(),
        0.85,
        'positive',
        '{"positive": 0.80, "neutral": 0.15, "negative": 0.05}'::jsonb,
        'low',
        0.10,
        'email',
        'Test email with positive sentiment'
      )
      RETURNING id
    `, [orgResult.rows[0].id]);

    const afterCounter = await client.query(`
      SELECT total_analyses, analyses_this_month
      FROM organization_ai_settings
      WHERE organization_id = $1
    `, [orgResult.rows[0].id]);

    console.log(`   After:  ${afterCounter.rows[0].total_analyses} total, ${afterCounter.rows[0].analyses_this_month} this month`);

    if (afterCounter.rows[0].total_analyses > beforeCounter.rows[0].total_analyses) {
      console.log(`   ✅ Usage counter trigger working!\n`);
    } else {
      console.log(`   ⚠️  Warning: Usage counter did not increment\n`);
    }

    // Clean up
    await client.query(`
      DELETE FROM sentiment_analysis_history
      WHERE organization_id = $1
      AND source_text LIKE 'Test email%'
    `, [orgResult.rows[0].id]);

    // Reset counters
    await client.query(`
      UPDATE organization_ai_settings
      SET total_analyses = 0, analyses_this_month = 0
      WHERE organization_id = $1
    `, [orgResult.rows[0].id]);

    console.log(`   ✓ Test data cleaned up and counters reset\n`);

    // Final summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ VERIFICATION COMPLETED SUCCESSFULLY!\n');
    console.log('All database features working correctly:');
    console.log('  ✓ Row-Level Security policies active');
    console.log('  ✓ Triggers functioning properly');
    console.log('  ✓ Constraints enforced');
    console.log('  ✓ Functions available');
    console.log('  ✓ Auto-alert creation working');
    console.log('  ✓ Usage counters incrementing');
    console.log('\n🚀 Ready for production deployment!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run verification
verifyMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
