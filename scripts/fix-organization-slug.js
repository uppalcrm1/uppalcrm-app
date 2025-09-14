/**
 * Fix organization slug to match frontend expectations
 * This updates the organization slug from 'uppal' to 'uppalsolutionsltd'
 * to resolve the license info API 500 errors
 */

const { query } = require('../database/connection');

async function fixOrganizationSlug() {
  try {
    console.log('🔧 Starting organization slug fix...');
    
    // First check if the old slug exists
    const checkOld = await query(
      'SELECT id, name, slug FROM organizations WHERE slug = $1', 
      ['uppal']
    );
    
    if (checkOld.rows.length === 0) {
      console.log('ℹ️  No organization found with slug "uppal" - may already be updated');
      
      // Check if the new slug already exists
      const checkNew = await query(
        'SELECT id, name, slug FROM organizations WHERE slug = $1', 
        ['uppalsolutionsltd']
      );
      
      if (checkNew.rows.length > 0) {
        console.log('✅ Organization already has correct slug:');
        console.log('  Organization:', checkNew.rows[0].name);
        console.log('  Slug:', checkNew.rows[0].slug);
        console.log('  ID:', checkNew.rows[0].id);
        return;
      }
      
      console.log('❌ No organization found with either slug');
      return;
    }
    
    // Check if the new slug is already taken by another organization
    const checkConflict = await query(
      'SELECT id, name FROM organizations WHERE slug = $1', 
      ['uppalsolutionsltd']
    );
    
    if (checkConflict.rows.length > 0) {
      console.log('❌ Slug "uppalsolutionsltd" already exists for another organization');
      console.log('  Conflicting organization:', checkConflict.rows[0].name);
      return;
    }
    
    // Update the slug
    const result = await query(
      'UPDATE organizations SET slug = $1, updated_at = NOW() WHERE slug = $2 RETURNING id, name, slug', 
      ['uppalsolutionsltd', 'uppal']
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Successfully updated organization slug:');
      console.log('  Organization:', result.rows[0].name);
      console.log('  Old slug: uppal');
      console.log('  New slug:', result.rows[0].slug);
      console.log('  ID:', result.rows[0].id);
      console.log('🎉 Fix completed successfully!');
    } else {
      console.log('❌ Update failed - no rows affected');
    }
    
  } catch (error) {
    console.error('❌ Error fixing organization slug:', error.message);
    throw error;
  }
}

// Run the fix if this file is executed directly
if (require.main === module) {
  fixOrganizationSlug()
    .then(() => {
      console.log('📋 Organization slug fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Organization slug fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixOrganizationSlug };