require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function simulateBackendLogic() {
  try {
    const entity_type = 'contacts';
    const orgId = '06048209-8ab4-4816-b23c-6f6362fea521';
    
    console.log('🔍 Simulating backend logic for contacts source field...\n');
    
    // This is what the backend systemFieldDefaults should have now
    const systemFieldDefaults = {
      firstName: { label: 'First Name', type: 'text', required: false, editable: true },
      lastName: { label: 'Last Name', type: 'text', required: false, editable: true },
      email: { label: 'Email', type: 'email', required: false, editable: true },
      phone: { label: 'Phone', type: 'tel', required: false, editable: true },
      company: { label: 'Company', type: 'text', required: false, editable: true },
      title: { label: 'Job Title', type: 'text', required: false, editable: true },
      department: { label: 'Department', type: 'text', required: false, editable: true },
      linkedIn: { label: 'LinkedIn Profile', type: 'url', required: false, editable: true },
      source: {
        label: 'Source',
        type: 'select',
        required: false,
        editable: true,
        options: []
      },
      assignedTo: { label: 'Assign To', type: 'user_select', required: false, editable: true },
      lastContactDate: { label: 'Last Contact Date', type: 'date', required: false, editable: true },
      notes: { label: 'Notes', type: 'textarea', required: false, editable: true }
    };
    
    const systemFieldNames = Object.keys(systemFieldDefaults);
    console.log('System field names:', systemFieldNames);
    console.log('source is included?', systemFieldNames.includes('source'), '\n');
    
    // Step 1: Query custom_field_definitions
    const cfdQuery = `
      SELECT 
        field_name,
        field_label,
        field_type,
        field_options,
        is_system_field
      FROM custom_field_definitions
      WHERE entity_type = $1 
        AND organization_id = $2
        AND field_name = ANY($3)
    `;
    
    const cfdResult = await pool.query(cfdQuery, [entity_type, orgId, systemFieldNames]);
    console.log('📋 custom_field_definitions results:');
    console.log('Total rows:', cfdResult.rowCount);
    const sourceFromCfd = cfdResult.rows.find(r => r.field_name === 'source');
    if (sourceFromCfd) {
      console.log('source field found:');
      console.log('  field_options:', sourceFromCfd.field_options);
      console.log('  is_system_field:', sourceFromCfd.is_system_field);
    } else {
      console.log('source field NOT found in custom_field_definitions');
    }
    
    // Step 2: Query default_field_configurations
    const dfcQuery = `
      SELECT 
        field_name,
        field_options,
        is_enabled,
        is_required
      FROM default_field_configurations
      WHERE entity_type = $1
        AND organization_id = $2
        AND field_name = ANY($3)
    `;
    
    const dfcResult = await pool.query(dfcQuery, [entity_type, orgId, systemFieldNames]);
    console.log('\n📋 default_field_configurations results:');
    console.log('Total rows:', dfcResult.rowCount);
    const sourceFromDfc = dfcResult.rows.find(r => r.field_name === 'source');
    if (sourceFromDfc) {
      console.log('source field found:');
      console.log('  field_options length:', sourceFromDfc.field_options?.length);
      console.log('  field_options:', JSON.stringify(sourceFromDfc.field_options, null, 2));
    } else {
      console.log('source field NOT found in default_field_configurations');
    }
    
    // Step 3: Merge logic
    console.log('\n🔀 Merge logic:');
    if (sourceFromCfd && sourceFromDfc) {
      if (sourceFromCfd.field_options === null || sourceFromCfd.field_options === undefined) {
        console.log('✅ source has null field_options in custom_field_definitions');
        console.log('   Will use field_options from default_field_configurations');
        console.log('   Final options:', sourceFromDfc.field_options?.length, 'items');
      } else {
        console.log('❌ source has NON-NULL field_options in custom_field_definitions');
        console.log('   Will use those instead of default_field_configurations');
        console.log('   Using:', sourceFromCfd.field_options?.length, 'items');
      }
    } else if (sourceFromCfd) {
      console.log('Only found in custom_field_definitions, using those options');
    } else if (sourceFromDfc) {
      console.log('Only found in default_field_configurations, using those options');
    } else {
      console.log('❌ NOT FOUND in either table!');
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

simulateBackendLogic();
