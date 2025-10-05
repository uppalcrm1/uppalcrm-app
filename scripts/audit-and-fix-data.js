const { query } = require('../database/connection');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function auditData() {
  console.log('🔍 DATA AUDIT - Super Admin Inconsistencies\n');
  console.log('='.repeat(80));
  console.log('\n');

  // 1. AUDIT ORGANIZATIONS
  console.log('📊 ORGANIZATIONS TABLE:');
  console.log('-'.repeat(80));
  const orgs = await query(`
    SELECT
      id,
      name,
      slug,
      is_trial,
      trial_status,
      subscription_plan,
      max_users,
      trial_start_date,
      trial_expires_at,
      created_at,
      (SELECT COUNT(*) FROM users WHERE organization_id = organizations.id AND is_active = true) as active_users
    FROM organizations
    ORDER BY created_at DESC
  `);

  orgs.rows.forEach((org, i) => {
    console.log(`\n${i + 1}. ${org.name} (${org.slug})`);
    console.log(`   ID: ${org.id}`);
    console.log(`   is_trial: ${org.is_trial}`);
    console.log(`   trial_status: ${org.trial_status || 'NULL'}`);
    console.log(`   subscription_plan: ${org.subscription_plan || 'NULL'}`);
    console.log(`   Users: ${org.active_users}/${org.max_users}`);
    console.log(`   Trial Start: ${org.trial_start_date || 'NULL'}`);
    console.log(`   Trial Expires: ${org.trial_expires_at || 'NULL'}`);
    console.log(`   Created: ${org.created_at}`);
  });

  console.log('\n\n');

  // 2. AUDIT TRIAL SIGNUPS
  console.log('📋 TRIAL_SIGNUPS TABLE:');
  console.log('-'.repeat(80));

  let signups = { rows: [] };
  try {
    signups = await query(`
      SELECT
        id,
        first_name,
        last_name,
        email,
        company,
        status,
        converted_organization_id,
        created_at
      FROM trial_signups
      ORDER BY created_at DESC
    `);
  } catch (error) {
    console.log('⚠️  trial_signups table may not exist:', error.message);
  }

  if (signups.rows.length === 0) {
    console.log('   No trial signups found (or table doesn\'t exist)\n');
  } else {
    signups.rows.forEach((signup, i) => {
      console.log(`\n${i + 1}. ${signup.company} - ${signup.email}`);
      console.log(`   ID: ${signup.id}`);
      console.log(`   Name: ${signup.first_name} ${signup.last_name}`);
      console.log(`   Status: ${signup.status}`);
      console.log(`   Linked to Org: ${signup.converted_organization_id || 'NOT LINKED'}`);
      console.log(`   Created: ${signup.created_at}`);
    });
  }

  console.log('\n\n');

  // 3. IDENTIFY PROBLEMS
  console.log('🚨 PROBLEMS IDENTIFIED:');
  console.log('-'.repeat(80));

  const problems = [];

  // Check for orphaned orgs (no trial signup)
  const orphanedOrgs = orgs.rows.filter(org => {
    const hasSignup = signups.rows.some(s => s.converted_organization_id === org.id);
    return !hasSignup;
  });

  if (orphanedOrgs.length > 0) {
    problems.push(`❌ ${orphanedOrgs.length} organization(s) have NO trial signup record:`);
    orphanedOrgs.forEach(org => {
      problems.push(`   - ${org.name} (${org.slug}) - created ${org.created_at}`);
    });
  }

  // Check for orphaned signups (no org)
  const orphanedSignups = signups.rows.filter(s =>
    s.status === 'converted' && !s.converted_organization_id
  );

  if (orphanedSignups.length > 0) {
    problems.push(`❌ ${orphanedSignups.length} trial signup(s) marked 'converted' but NOT linked to org:`);
    orphanedSignups.forEach(s => {
      problems.push(`   - ${s.company} (${s.email})`);
    });
  }

  // Check for inconsistent trial flags
  const inconsistentOrgs = orgs.rows.filter(org => {
    // If is_trial = false but has trial_expires_at
    if (org.is_trial === false && org.trial_expires_at) {
      return true;
    }
    // If is_trial = true but subscription_plan is not 'trial'
    if (org.is_trial === true && org.subscription_plan !== 'trial') {
      return true;
    }
    // If is_trial = false but subscription_plan is 'trial'
    if (org.is_trial === false && org.subscription_plan === 'trial') {
      return true;
    }
    return false;
  });

  if (inconsistentOrgs.length > 0) {
    problems.push(`❌ ${inconsistentOrgs.length} organization(s) have INCONSISTENT trial flags:`);
    inconsistentOrgs.forEach(org => {
      problems.push(`   - ${org.name}: is_trial=${org.is_trial}, subscription_plan=${org.subscription_plan}, trial_expires_at=${org.trial_expires_at ? 'SET' : 'NULL'}`);
    });
  }

  // Check for orgs that look like trials but are marked as paid
  const suspiciousPaidOrgs = orgs.rows.filter(org =>
    org.is_trial === false &&
    (org.subscription_plan === 'trial' || org.subscription_plan === 'STARTER' || org.subscription_plan === 'free')
  );

  if (suspiciousPaidOrgs.length > 0) {
    problems.push(`⚠️  ${suspiciousPaidOrgs.length} organization(s) marked PAID but have trial/starter/free plan:`);
    suspiciousPaidOrgs.forEach(org => {
      problems.push(`   - ${org.name}: is_trial=false, plan=${org.subscription_plan}`);
    });
  }

  if (problems.length === 0) {
    console.log('✅ No data inconsistencies found!\n');
    return { orgs, signups, problems: [], orphanedOrgs, inconsistentOrgs, suspiciousPaidOrgs };
  } else {
    problems.forEach(p => console.log(p));
    console.log('\n');
  }

  return { orgs, signups, problems, orphanedOrgs, inconsistentOrgs, suspiciousPaidOrgs };
}

async function presentFixOptions(auditResults) {
  const { orgs, signups, orphanedOrgs, inconsistentOrgs, suspiciousPaidOrgs } = auditResults;

  console.log('🔧 FIX OPTIONS:');
  console.log('-'.repeat(80));
  console.log('\nA. Mark ALL organizations as active trials');
  console.log('   - Set is_trial=true, trial_status=\'active\' for all orgs');
  console.log('   - Set trial_expires_at = created_at + 30 days');
  console.log('   - Create missing trial_signup records for orphaned orgs');
  console.log('   - Result: All orgs appear in Trial Signups tab, Organizations tab empty\n');

  console.log('B. Keep current paid orgs, fix trial orgs');
  console.log('   - Orgs with is_trial=false stay as paid (appear in Organizations tab)');
  console.log('   - Orgs with is_trial=true stay as trials (appear in Trial Signups)');
  console.log('   - Fix inconsistent flags');
  console.log('   - Create missing trial_signup records for trial orgs only\n');

  console.log('C. Delete ALL test data and start fresh');
  console.log('   - Delete all organizations (CASCADE deletes users, contacts, leads)');
  console.log('   - Delete all trial signups');
  console.log('   - Clean slate for production use');
  console.log('   - ⚠️  WARNING: This is DESTRUCTIVE and cannot be undone!\n');

  console.log('D. Smart fix - analyze each org individually');
  console.log('   - For "Uppal 2" (if it exists): Keep as paid if it has >1 active user, else make trial');
  console.log('   - For other orgs: Make them trials with proper trial_signup records');
  console.log('   - Fix all inconsistent flags');
  console.log('   - Most intelligent option\n');

  console.log('E. Manual inspection - show me details and I\'ll decide');
  console.log('   - Don\'t fix anything yet');
  console.log('   - Show detailed breakdown of each org');
  console.log('   - Exit script so I can manually fix in database\n');

  console.log('Q. Quit without making any changes\n');

  const choice = await question('Choose an option (A/B/C/D/E/Q): ');
  return choice.toUpperCase();
}

async function applyFixA(orgs) {
  console.log('\n🔧 Applying Fix A: Mark all orgs as active trials...\n');

  await query('BEGIN');

  try {
    // Update all orgs to be trials
    const updateResult = await query(`
      UPDATE organizations
      SET
        is_trial = true,
        trial_status = 'active',
        subscription_plan = 'trial',
        trial_start_date = COALESCE(trial_start_date, created_at),
        trial_expires_at = COALESCE(trial_expires_at, created_at + INTERVAL '30 days')
      RETURNING id, name, trial_expires_at
    `);

    console.log(`✅ Updated ${updateResult.rows.length} organizations to trial status`);
    updateResult.rows.forEach(org => {
      console.log(`   - ${org.name}: expires ${org.trial_expires_at}`);
    });

    // Create trial signups for orgs that don't have one
    console.log('\n🔄 Creating missing trial_signup records...\n');

    // First check if trial_signups table exists
    let tableExists = false;
    try {
      await query('SELECT 1 FROM trial_signups LIMIT 1');
      tableExists = true;
    } catch (error) {
      console.log('⚠️  trial_signups table doesn\'t exist, skipping trial signup creation');
    }

    if (tableExists) {
      const signups = await query('SELECT converted_organization_id FROM trial_signups WHERE converted_organization_id IS NOT NULL');
      const linkedOrgIds = signups.rows.map(s => s.converted_organization_id);

      for (const org of orgs.rows) {
        if (!linkedOrgIds.includes(org.id)) {
          // Get admin user for this org
          const adminResult = await query(
            'SELECT email, first_name, last_name FROM users WHERE organization_id = $1 AND role = \'admin\' LIMIT 1',
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
            console.log(`   ✅ Created trial signup for: ${org.name}`);
          }
        }
      }
    }

    await query('COMMIT');
    console.log('\n✅ Fix A applied successfully!\n');

  } catch (error) {
    await query('ROLLBACK');
    console.error('❌ Error applying fix:', error.message);
    throw error;
  }
}

async function applyFixB(orgs) {
  console.log('\n🔧 Applying Fix B: Keep paid orgs, fix trials...\n');

  await query('BEGIN');

  try {
    // Fix inconsistent trial flags
    await query(`
      UPDATE organizations
      SET subscription_plan = 'trial'
      WHERE is_trial = true AND subscription_plan != 'trial'
    `);

    await query(`
      UPDATE organizations
      SET
        trial_start_date = COALESCE(trial_start_date, created_at),
        trial_expires_at = COALESCE(trial_expires_at, created_at + INTERVAL '30 days'),
        trial_status = COALESCE(trial_status, 'active')
      WHERE is_trial = true
    `);

    console.log('✅ Fixed inconsistent trial flags');

    // Create trial signups for trial orgs only
    let tableExists = false;
    try {
      await query('SELECT 1 FROM trial_signups LIMIT 1');
      tableExists = true;
    } catch (error) {
      console.log('⚠️  trial_signups table doesn\'t exist');
    }

    if (tableExists) {
      const signups = await query('SELECT converted_organization_id FROM trial_signups WHERE converted_organization_id IS NOT NULL');
      const linkedOrgIds = signups.rows.map(s => s.converted_organization_id);

      for (const org of orgs.rows.filter(o => o.is_trial)) {
        if (!linkedOrgIds.includes(org.id)) {
          const adminResult = await query(
            'SELECT email, first_name, last_name FROM users WHERE organization_id = $1 AND role = \'admin\' LIMIT 1',
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
            console.log(`   ✅ Created trial signup for: ${org.name}`);
          }
        }
      }
    }

    await query('COMMIT');
    console.log('\n✅ Fix B applied successfully!\n');

  } catch (error) {
    await query('ROLLBACK');
    console.error('❌ Error applying fix:', error.message);
    throw error;
  }
}

async function applyFixC() {
  console.log('\n⚠️  WARNING: This will DELETE ALL DATA!\n');
  const confirm = await question('Type "DELETE ALL DATA" to confirm: ');

  if (confirm !== 'DELETE ALL DATA') {
    console.log('❌ Cancelled. No data was deleted.\n');
    return;
  }

  console.log('\n🗑️  Deleting all data...\n');

  await query('BEGIN');

  try {
    // Delete trial signups
    let deleted = 0;
    try {
      const result = await query('DELETE FROM trial_signups');
      deleted = result.rowCount;
      console.log(`   ✅ Deleted ${deleted} trial signups`);
    } catch (error) {
      console.log('   ⚠️  trial_signups table doesn\'t exist or already empty');
    }

    // Delete organizations (CASCADE will delete users, contacts, leads, etc.)
    const orgResult = await query('DELETE FROM organizations');
    console.log(`   ✅ Deleted ${orgResult.rowCount} organizations (and all related data via CASCADE)`);

    await query('COMMIT');
    console.log('\n✅ All data deleted. Database is now clean.\n');

  } catch (error) {
    await query('ROLLBACK');
    console.error('❌ Error deleting data:', error.message);
    throw error;
  }
}

async function applyFixD(orgs) {
  console.log('\n🔧 Applying Fix D: Smart fix based on usage...\n');

  await query('BEGIN');

  try {
    for (const org of orgs.rows) {
      const activeUsers = parseInt(org.active_users);
      const shouldBeTrial = activeUsers <= 1; // If 1 or fewer users, make it a trial

      console.log(`\nAnalyzing: ${org.name}`);
      console.log(`  Active users: ${activeUsers}/${org.max_users}`);
      console.log(`  Current status: is_trial=${org.is_trial}`);

      if (shouldBeTrial && !org.is_trial) {
        console.log(`  → Converting to TRIAL (low usage)`);
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
      } else if (!shouldBeTrial && org.is_trial) {
        console.log(`  → Converting to PAID (active usage)`);
        await query(`
          UPDATE organizations
          SET
            is_trial = false,
            trial_status = NULL,
            subscription_plan = 'per_user'
          WHERE id = $1
        `, [org.id]);
      } else {
        console.log(`  → Keeping as ${org.is_trial ? 'TRIAL' : 'PAID'} (correct)`);
        // Fix any inconsistent flags
        if (org.is_trial) {
          await query(`
            UPDATE organizations
            SET
              subscription_plan = 'trial',
              trial_start_date = COALESCE(trial_start_date, created_at),
              trial_expires_at = COALESCE(trial_expires_at, created_at + INTERVAL '30 days'),
              trial_status = COALESCE(trial_status, 'active')
            WHERE id = $1
          `, [org.id]);
        }
      }
    }

    // Create missing trial signups for trial orgs
    console.log('\n🔄 Creating missing trial_signup records...\n');

    let tableExists = false;
    try {
      await query('SELECT 1 FROM trial_signups LIMIT 1');
      tableExists = true;
    } catch (error) {
      console.log('⚠️  trial_signups table doesn\'t exist');
    }

    if (tableExists) {
      const signups = await query('SELECT converted_organization_id FROM trial_signups WHERE converted_organization_id IS NOT NULL');
      const linkedOrgIds = signups.rows.map(s => s.converted_organization_id);

      // Refresh org data
      const updatedOrgs = await query('SELECT * FROM organizations WHERE is_trial = true');

      for (const org of updatedOrgs.rows) {
        if (!linkedOrgIds.includes(org.id)) {
          const adminResult = await query(
            'SELECT email, first_name, last_name FROM users WHERE organization_id = $1 AND role = \'admin\' LIMIT 1',
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
            console.log(`   ✅ Created trial signup for: ${org.name}`);
          }
        }
      }
    }

    await query('COMMIT');
    console.log('\n✅ Smart fix applied successfully!\n');

  } catch (error) {
    await query('ROLLBACK');
    console.error('❌ Error applying fix:', error.message);
    throw error;
  }
}

async function showFinalState() {
  console.log('\n📊 FINAL STATE AFTER FIX:');
  console.log('='.repeat(80));

  const orgs = await query(`
    SELECT
      name, slug, is_trial, trial_status, subscription_plan,
      (SELECT COUNT(*) FROM users WHERE organization_id = organizations.id AND is_active = true) as active_users,
      max_users
    FROM organizations
    ORDER BY name
  `);

  console.log('\nOrganizations:');
  orgs.rows.forEach(org => {
    console.log(`  - ${org.name}: ${org.is_trial ? 'TRIAL' : 'PAID'} (${org.active_users}/${org.max_users} users, plan: ${org.subscription_plan})`);
  });

  let signups = { rows: [] };
  try {
    signups = await query('SELECT company, status, converted_organization_id FROM trial_signups ORDER BY company');
    console.log('\nTrial Signups:');
    if (signups.rows.length === 0) {
      console.log('  (none)');
    } else {
      signups.rows.forEach(s => {
        console.log(`  - ${s.company}: ${s.status}${s.converted_organization_id ? ' (linked to org)' : ''}`);
      });
    }
  } catch (error) {
    console.log('\nTrial Signups: (table doesn\'t exist)');
  }

  console.log('\n✅ Audit complete!\n');
}

async function main() {
  try {
    const auditResults = await auditData();

    if (auditResults.problems.length === 0) {
      console.log('No fixes needed. Exiting.\n');
      process.exit(0);
    }

    const choice = await presentFixOptions(auditResults);

    switch (choice) {
      case 'A':
        await applyFixA(auditResults.orgs);
        await showFinalState();
        break;
      case 'B':
        await applyFixB(auditResults.orgs);
        await showFinalState();
        break;
      case 'C':
        await applyFixC();
        await showFinalState();
        break;
      case 'D':
        await applyFixD(auditResults.orgs);
        await showFinalState();
        break;
      case 'E':
        console.log('\n📋 Exiting for manual inspection. No changes made.\n');
        break;
      case 'Q':
        console.log('\n👋 Exiting without changes.\n');
        break;
      default:
        console.log('\n❌ Invalid choice. Exiting without changes.\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
