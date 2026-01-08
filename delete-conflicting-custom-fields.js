require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// System field names that should NOT exist as custom fields
const SYSTEM_FIELD_NAMES = [
  'source', 'first_name', 'last_name', 'email', 'phone', 'company',
  'status', 'priority', 'assigned_to', 'next_follow_up', 'last_contact_date',
  'type', 'value', 'notes', 'description', 'linkedin', 'title', 'website',
  'address', 'city', 'state', 'country', 'postal_code', 'industry',
  'employees', 'revenue', 'created_at', 'updated_at', 'created_by'
];

async function deleteConflictingFields() {
  try {
    console.log('🔍 Checking for custom fields that conflict with system fields...\n');
    
    // First, check what we'll be deleting
    const checkResult = await pool.query(`
      SELECT id, organization_id, field_name, field_label, entity_type, is_enabled
      FROM custom_field_definitions
      WHERE field_name = ANY($1)
      ORDER BY entity_type, field_name
    `, [SYSTEM_FIELD_NAMES]);

    if (checkResult.rows.length === 0) {
      console.log('✅ No conflicting custom fields found');
      await pool.end();
      return;
    }

    console.log(`⚠️ Found ${checkResult.rows.length} conflicting custom fields:\n`);
    checkResult.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. "${row.field_name}" (${row.field_label}) - ${row.entity_type} - Org: ${row.organization_id} - ID: ${row.id}`);
    });

    console.log('\n🗑️ Deleting conflicting custom fields...\n');

    // Delete them
    const deleteResult = await pool.query(`
      DELETE FROM custom_field_definitions
      WHERE field_name = ANY($1)
      RETURNING id, field_name, field_label, entity_type
    `, [SYSTEM_FIELD_NAMES]);

    console.log(`✅ Successfully deleted ${deleteResult.rows.length} conflicting custom fields:\n`);
    deleteResult.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. "${row.field_name}" (${row.field_label}) - ${row.entity_type} - ID: ${row.id}`);
    });

    // Also delete any associated custom field values
    console.log('\n🗑️ Deleting associated custom field values...\n');
    const valuesResult = await pool.query(`
      DELETE FROM custom_field_values
      WHERE field_name = ANY($1)
      RETURNING id, field_name, entity_type
    `, [SYSTEM_FIELD_NAMES]);

    console.log(`✅ Deleted ${valuesResult.rows.length} associated custom field values`);

    console.log('\n✅ Cleanup complete! System fields should now work correctly.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Only run if called directly
if (require.main === module) {
  console.log('⚠️  WARNING: This will permanently delete custom fields that have the same names as system fields.');
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
  
  setTimeout(() => {
    deleteConflictingFields();
  }, 3000);
}

module.exports = { deleteConflictingFields, SYSTEM_FIELD_NAMES };
