/**
 * Sync license fields to resolve discrepancies between Super Admin and User Management
 * Updates max_users field to match purchased_licenses for consistency
 */

const { query } = require('../database/connection');

async function syncLicenseFields() {
  try {
    console.log('🔧 Starting license field synchronization...');
    
    // First, check for organizations with field discrepancies
    const checkResult = await query(`
      SELECT 
        id, name, slug,
        max_users,
        purchased_licenses,
        (max_users != purchased_licenses) as has_discrepancy
      FROM organizations 
      WHERE max_users != purchased_licenses OR max_users IS NULL
    `);
    
    console.log(`📊 Found ${checkResult.rows.length} organizations with license field discrepancies`);
    
    if (checkResult.rows.length === 0) {
      console.log('✅ All organizations already have synchronized license fields');
      return;
    }
    
    // Show what will be updated
    console.log('\n📋 Organizations to be updated:');
    checkResult.rows.forEach(org => {
      console.log(`  ${org.name} (${org.slug}): max_users ${org.max_users} → ${org.purchased_licenses}`);
    });
    
    // Update max_users to match purchased_licenses for all discrepant organizations
    const updateResult = await query(`
      UPDATE organizations 
      SET max_users = purchased_licenses, updated_at = NOW() 
      WHERE max_users != purchased_licenses OR max_users IS NULL
      RETURNING id, name, slug, max_users, purchased_licenses
    `);
    
    console.log(`\n✅ Successfully updated ${updateResult.rows.length} organizations:`);
    updateResult.rows.forEach(org => {
      console.log(`  ✓ ${org.name}: max_users = ${org.max_users}, purchased_licenses = ${org.purchased_licenses}`);
    });
    
    // Verify the sync worked
    const verifyResult = await query(`
      SELECT COUNT(*) as discrepant_count
      FROM organizations 
      WHERE max_users != purchased_licenses
    `);
    
    const discrepantCount = parseInt(verifyResult.rows[0].discrepant_count);
    if (discrepantCount === 0) {
      console.log('\n🎉 All license fields are now synchronized!');
    } else {
      console.log(`\n⚠️  Warning: ${discrepantCount} organizations still have discrepancies`);
    }
    
    console.log('\n📝 Summary:');
    console.log('  - Super Admin "Check Status" now shows consistent max_users values');
    console.log('  - User Management license limits remain unchanged');
    console.log('  - Both interfaces now display the same license counts');
    
  } catch (error) {
    console.error('❌ Error syncing license fields:', error.message);
    throw error;
  }
}

// Run the sync if this file is executed directly
if (require.main === module) {
  syncLicenseFields()
    .then(() => {
      console.log('📋 License field synchronization completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 License field synchronization failed:', error);
      process.exit(1);
    });
}

module.exports = { syncLicenseFields };