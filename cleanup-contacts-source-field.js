require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function cleanupContactsSourceField() {
  try {
    console.log('🔍 Checking for duplicate source fields in contacts...\n');
    
    // Check custom_field_definitions for source field
    const customFieldsResult = await pool.query(`
      SELECT id, field_name, is_system_field, organization_id, created_at
      FROM custom_field_definitions
      WHERE entity_type = 'contacts' AND field_name = 'source'
      ORDER BY is_system_field DESC, created_at ASC
    `);
    
    console.log(`📋 Found ${customFieldsResult.rows.length} source field(s) in custom_field_definitions:`);
    customFieldsResult.rows.forEach((row, idx) => {
      console.log(`  [${idx + 1}] ID: ${row.id}`);
      console.log(`      System Field: ${row.is_system_field}`);
      console.log(`      Organization: ${row.organization_id}`);
      console.log(`      Created: ${row.created_at}`);
    });
    
    if (customFieldsResult.rows.length === 0) {
      console.log('\n✅ No source fields found in custom_field_definitions');
    } else if (customFieldsResult.rows.length === 1) {
      const field = customFieldsResult.rows[0];
      if (field.is_system_field) {
        console.log('\n✅ Only one source field exists and it is a system field');
      } else {
        console.log('\n⚠️  Only one source field exists but it is NOT a system field');
        console.log('   Converting to system field...');
        
        await pool.query(`
          UPDATE custom_field_definitions
          SET is_system_field = true
          WHERE id = $1
        `, [field.id]);
        
        console.log('✅ Converted to system field');
      }
    } else {
      // Multiple source fields exist
      console.log('\n⚠️  Multiple source fields found. Keeping only the system field...');
      
      const systemField = customFieldsResult.rows.find(f => f.is_system_field);
      const nonSystemFields = customFieldsResult.rows.filter(f => !f.is_system_field);
      
      if (systemField) {
        console.log(`\n✅ Keeping system field: ${systemField.id}`);
        
        // Delete non-system source fields
        for (const field of nonSystemFields) {
          console.log(`   🗑️  Deleting custom field: ${field.id}`);
          await pool.query(`
            DELETE FROM custom_field_definitions
            WHERE id = $1
          `, [field.id]);
        }
        
        console.log(`✅ Deleted ${nonSystemFields.length} duplicate custom field(s)`);
      } else {
        // No system field exists, convert the first one to system field
        console.log('\n⚠️  No system field found. Converting oldest field to system field...');
        const oldestField = customFieldsResult.rows[0];
        
        await pool.query(`
          UPDATE custom_field_definitions
          SET is_system_field = true
          WHERE id = $1
        `, [oldestField.id]);
        
        console.log(`✅ Converted field ${oldestField.id} to system field`);
        
        // Delete the rest
        const otherFields = customFieldsResult.rows.slice(1);
        for (const field of otherFields) {
          console.log(`   🗑️  Deleting duplicate: ${field.id}`);
          await pool.query(`
            DELETE FROM custom_field_definitions
            WHERE id = $1
          `, [field.id]);
        }
        
        console.log(`✅ Deleted ${otherFields.length} duplicate field(s)`);
      }
    }
    
    // Check default_field_configurations
    console.log('\n📋 Checking default_field_configurations...');
    const defaultConfigResult = await pool.query(`
      SELECT id, field_name, field_options, organization_id
      FROM default_field_configurations
      WHERE entity_type = 'contacts' AND field_name = 'source'
    `);
    
    console.log(`   Found ${defaultConfigResult.rows.length} entry(ies)`);
    if (defaultConfigResult.rows.length > 0) {
      defaultConfigResult.rows.forEach((row, idx) => {
        console.log(`   [${idx + 1}] Options: ${row.field_options ? row.field_options.length : 0} items`);
      });
    }
    
    // Final verification
    console.log('\n🔍 Final verification:');
    const finalCheck = await pool.query(`
      SELECT id, field_name, is_system_field
      FROM custom_field_definitions
      WHERE entity_type = 'contacts' AND field_name = 'source'
    `);
    
    if (finalCheck.rows.length === 1 && finalCheck.rows[0].is_system_field) {
      console.log('✅ SUCCESS: Only one source field exists and it is a system field');
    } else if (finalCheck.rows.length === 0) {
      console.log('⚠️  No source field found in custom_field_definitions');
    } else {
      console.log('❌ ERROR: Multiple or non-system source fields still exist');
      console.log('   Fields found:', finalCheck.rows);
    }
    
    await pool.end();
    console.log('\n✅ Cleanup complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

cleanupContactsSourceField();
