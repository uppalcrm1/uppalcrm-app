#!/usr/bin/env node

/**
 * Setup script for the subscription management system
 * This script helps verify and initialize the subscription system
 */

const fs = require('fs');
const path = require('path');
const { query } = require('./database/connection');

async function setupSubscriptionSystem() {
  console.log('🚀 Setting up Subscription Management System...\n');

  try {
    // Step 1: Check if subscription tables exist
    console.log('📋 Step 1: Checking database tables...');
    const tableCheck = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'subscription%'
      OR table_name LIKE 'plan%'
      ORDER BY table_name
    `);

    console.log(`Found ${tableCheck.rows.length} subscription-related tables:`);
    tableCheck.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    if (tableCheck.rows.length === 0) {
      console.log('\n❌ No subscription tables found!');
      console.log('📝 Please run the database schema file:');
      console.log('   psql -d uppal_crm -f database/subscription_management_schema.sql');
      console.log('\n   Or copy and paste the contents of database/subscription_management_schema.sql into your PostgreSQL client');
      return;
    }

    // Step 2: Check subscription plans
    console.log('\n📋 Step 2: Checking subscription plans...');
    const plansCheck = await query('SELECT name, display_name, monthly_price FROM subscription_plans WHERE is_active = true ORDER BY sort_order');

    if (plansCheck.rows.length === 0) {
      console.log('❌ No subscription plans found!');
      console.log('📝 The seed data might not have been inserted. Check your schema file.');
    } else {
      console.log(`Found ${plansCheck.rows.length} active subscription plans:`);
      plansCheck.rows.forEach(plan => {
        console.log(`  ✓ ${plan.display_name} - $${(plan.monthly_price / 100).toFixed(2)}/month`);
      });
    }

    // Step 3: Check helper functions
    console.log('\n📋 Step 3: Checking helper functions...');
    const functionsCheck = await query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_type = 'FUNCTION'
      AND (routine_name LIKE '%subscription%' OR routine_name LIKE '%usage%' OR routine_name LIKE '%feature%')
      ORDER BY routine_name
    `);

    console.log(`Found ${functionsCheck.rows.length} subscription helper functions:`);
    functionsCheck.rows.forEach(func => {
      console.log(`  ✓ ${func.routine_name}`);
    });

    // Step 4: Test helper functions
    console.log('\n📋 Step 4: Testing helper functions...');

    try {
      // Test plan features query
      const featuresTest = await query('SELECT * FROM plan_features LIMIT 1');
      console.log('  ✓ plan_features table accessible');
    } catch (error) {
      console.log('  ❌ plan_features table test failed:', error.message);
    }

    try {
      // Test a simple function call
      const functionTest = await query("SELECT generate_invoice_number() as invoice_num");
      console.log(`  ✓ generate_invoice_number() works: ${functionTest.rows[0].invoice_num}`);
    } catch (error) {
      console.log('  ❌ generate_invoice_number() test failed:', error.message);
    }

    // Step 5: Check for existing organization
    console.log('\n📋 Step 5: Checking for test organization...');
    const orgCheck = await query('SELECT id, name FROM organizations LIMIT 1');

    if (orgCheck.rows.length === 0) {
      console.log('❌ No organizations found. Create an organization first to test subscriptions.');
    } else {
      const testOrg = orgCheck.rows[0];
      console.log(`✓ Found test organization: ${testOrg.name} (${testOrg.id})`);

      // Check if this organization has a subscription
      const subCheck = await query('SELECT status, subscription_plan_id FROM organization_subscriptions WHERE organization_id = $1', [testOrg.id]);

      if (subCheck.rows.length === 0) {
        console.log('  ℹ️  No subscription found for this organization');
        console.log('  💡 You can create a trial subscription using the Organization.initializeTrialSubscription() method');
      } else {
        console.log(`  ✓ Found subscription with status: ${subCheck.rows[0].status}`);
      }
    }

    // Step 6: File verification
    console.log('\n📋 Step 6: Verifying subscription system files...');

    const requiredFiles = [
      'controllers/subscriptionController.js',
      'middleware/subscriptionMiddleware.js',
      'routes/subscription.js',
      'frontend/src/pages/SubscriptionManagement.jsx'
    ];

    requiredFiles.forEach(file => {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        console.log(`  ✓ ${file}`);
      } else {
        console.log(`  ❌ ${file} - Missing!`);
      }
    });

    // Step 7: Summary and next steps
    console.log('\n🎉 Subscription System Setup Summary:');
    console.log('================================');

    if (tableCheck.rows.length >= 7) {
      console.log('✅ Database schema: Complete');
    } else {
      console.log('❌ Database schema: Incomplete - run the schema file');
    }

    if (plansCheck.rows.length >= 4) {
      console.log('✅ Subscription plans: Available');
    } else {
      console.log('❌ Subscription plans: Missing seed data');
    }

    if (functionsCheck.rows.length >= 3) {
      console.log('✅ Helper functions: Available');
    } else {
      console.log('❌ Helper functions: Missing');
    }

    console.log('\n📋 Next Steps:');
    console.log('1. 🌐 Open your CRM at http://localhost:3003');
    console.log('2. 🔑 Login with your credentials');
    console.log('3. 📊 Navigate to "Subscription" in the sidebar');
    console.log('4. 🧪 Test the subscription management interface');
    console.log('5. 📖 See SUBSCRIPTION_TESTING_GUIDE.md for detailed testing instructions');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure your database connection is working');
    console.log('2. Check that you have run the schema file');
    console.log('3. Verify your PostgreSQL user has the necessary permissions');
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupSubscriptionSystem()
    .then(() => {
      console.log('\n✨ Setup verification complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup verification failed:', error);
      process.exit(1);
    });
}

module.exports = setupSubscriptionSystem;