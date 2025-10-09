const { query } = require('../database/connection');

async function applySmartFix() {
  console.log('🔧 APPLYING OPTION D: Smart Fix\n');
  console.log('='.repeat(80));
  console.log('\n');

  try {
    await query('BEGIN');

    // Get all organizations
    const orgs = await query(`
      SELECT
        o.id,
        o.name,
        o.slug,
        o.is_trial,
        o.trial_status,
        o.subscription_plan,
        o.created_at,
        o.max_users,
        (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true) as active_users
      FROM organizations o
      ORDER BY o.created_at DESC
    `);

    console.log(`Found ${orgs.rows.length} organization(s)\n`);

    // Analyze and fix each org
    for (const org of orgs.rows) {
      const activeUsers = parseInt(org.active_users);
      const shouldBeTrial = activeUsers <= 1; // If 1 or fewer users, make it a trial

      console.log(`📋 Analyzing: ${org.name}`);
      console.log(`   ID: ${org.id}`);
      console.log(`   Active users: ${activeUsers}/${org.max_users}`);
      console.log(`   Current: is_trial=${org.is_trial}, plan=${org.subscription_plan}`);

      if (shouldBeTrial && !org.is_trial) {
        console.log(`   → Decision: CONVERT TO TRIAL (low usage: ${activeUsers} user(s))`);
        await query(`
          UPDATE organizations
          SET
            is_trial = true,
            trial_status = 'active',
            subscription_plan = 'trial',
            trial_start_date = COALESCE(trial_start_date, created_at),
            trial_expires_at = COALESCE(trial_expires_at, created_at + INTERVAL '30 days')
          WHERE id = $1
        `, [org.id]);
        console.log(`   ✅ Converted to TRIAL`);

      } else if (!shouldBeTrial && org.is_trial) {
        console.log(`   → Decision: CONVERT TO PAID (active usage: ${activeUsers} users)`);
        await query(`
          UPDATE organizations
          SET
            is_trial = false,
            trial_status = NULL,
            subscription_plan = 'per_user',
            trial_start_date = NULL,
            trial_expires_at = NULL
          WHERE id = $1
        `, [org.id]);
        console.log(`   ✅ Converted to PAID`);

      } else {
        console.log(`   → Decision: KEEP AS ${org.is_trial ? 'TRIAL' : 'PAID'} (status is correct)`);

        // Fix any inconsistent flags
        if (org.is_trial) {
          console.log(`   → Fixing inconsistent trial flags...`);
          await query(`
            UPDATE organizations
            SET
              subscription_plan = 'trial',
              trial_start_date = COALESCE(trial_start_date, created_at),
              trial_expires_at = COALESCE(trial_expires_at, created_at + INTERVAL '30 days'),
              trial_status = COALESCE(trial_status, 'active')
            WHERE id = $1
          `, [org.id]);
          console.log(`   ✅ Fixed trial flags`);
        } else {
          console.log(`   → Ensuring paid org has correct flags...`);
          await query(`
            UPDATE organizations
            SET
              subscription_plan = COALESCE(subscription_plan, 'per_user'),
              trial_status = NULL,
              trial_start_date = NULL,
              trial_expires_at = NULL
            WHERE id = $1
          `, [org.id]);
          console.log(`   ✅ Fixed paid org flags`);
        }
      }
      console.log('');
    }

    // Create missing trial signups for trial orgs
    console.log('🔄 Creating missing trial_signup records for trial organizations...\n');

    // Check if trial_signups table exists
    let tableExists = false;
    try {
      await query('SELECT 1 FROM trial_signups LIMIT 1');
      tableExists = true;
    } catch (error) {
      console.log('⚠️  trial_signups table doesn\'t exist, skipping signup creation\n');
    }

    if (tableExists) {
      const signups = await query('SELECT converted_organization_id FROM trial_signups WHERE converted_organization_id IS NOT NULL');
      const linkedOrgIds = signups.rows.map(s => s.converted_organization_id);

      // Refresh org data to get updated is_trial values
      const updatedOrgs = await query('SELECT * FROM organizations WHERE is_trial = true');

      let signupsCreated = 0;
      for (const org of updatedOrgs.rows) {
        if (!linkedOrgIds.includes(org.id)) {
          console.log(`   Creating trial signup for: ${org.name}`);

          const adminResult = await query(
            'SELECT email, first_name, last_name FROM users WHERE organization_id = $1 AND role = \'admin\' AND is_active = true LIMIT 1',
            [org.id]
          );

          if (adminResult.rows.length > 0) {
            const admin = adminResult.rows[0];
            await query(`
              INSERT INTO trial_signups (
                first_name, last_name, email, company, status,
                converted_organization_id, created_at
              ) VALUES ($1, $2, $3, $4, 'converted', $5, $6)
            `, [
              admin.first_name || 'Admin',
              admin.last_name || 'User',
              admin.email,
              org.name,
              org.id,
              org.created_at
            ]);
            console.log(`   ✅ Created trial signup: ${admin.email}`);
            signupsCreated++;
          } else {
            console.log(`   ⚠️  No admin user found for ${org.name}, skipping signup creation`);
          }
        }
      }

      if (signupsCreated === 0) {
        console.log('   ℹ️  All trial orgs already have trial signup records');
      }
    }

    await query('COMMIT');
    console.log('\n✅ SMART FIX COMPLETED SUCCESSFULLY!\n');

    // Show final state
    console.log('='.repeat(80));
    console.log('📊 FINAL STATE:\n');

    const finalOrgs = await query(`
      SELECT
        name, slug, is_trial, trial_status, subscription_plan,
        (SELECT COUNT(*) FROM users WHERE organization_id = organizations.id AND is_active = true) as active_users,
        max_users,
        trial_expires_at
      FROM organizations
      ORDER BY name
    `);

    console.log('Organizations:');
    finalOrgs.rows.forEach(org => {
      const status = org.is_trial ? 'TRIAL' : 'PAID';
      const expiry = org.trial_expires_at ? ` (expires: ${new Date(org.trial_expires_at).toLocaleDateString()})` : '';
      console.log(`  - ${org.name}: ${status} (${org.active_users}/${org.max_users} users, plan: ${org.subscription_plan})${expiry}`);
    });

    if (tableExists) {
      const finalSignups = await query(`
        SELECT company, status, converted_organization_id
        FROM trial_signups
        ORDER BY company
      `);

      console.log('\nTrial Signups:');
      if (finalSignups.rows.length === 0) {
        console.log('  (none)');
      } else {
        finalSignups.rows.forEach(s => {
          const linked = s.converted_organization_id ? ' ✅ linked to org' : ' ⚠️  not linked';
          console.log(`  - ${s.company}: ${s.status}${linked}`);
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ All done! Your Super Admin panel should now show consistent data.\n');

    process.exit(0);

  } catch (error) {
    await query('ROLLBACK');
    console.error('\n❌ Error applying smart fix:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

applySmartFix();
