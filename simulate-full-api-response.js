require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function simulateFullAPIResponse() {
  try {
    const entity_type = 'contacts';
    const orgId = '06048209-8ab4-4816-b23c-6f6362fea521';
    
    console.log('🔍 Simulating FULL API response for contacts...\n');
    
    // Simulate the systemFieldDefaults from deployed code
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
      status: {
        label: 'Status',
        type: 'select',
        required: false,
        editable: true,
        options: ['active', 'inactive', 'prospect']
      },
      assignedTo: { label: 'Assign To', type: 'user_select', required: false, editable: true },
      lastContactDate: { label: 'Last Contact Date', type: 'date', required: false, editable: true },
      notes: { label: 'Notes', type: 'textarea', required: false, editable: true }
    };
    
    const systemFieldNames = Object.keys(systemFieldDefaults);
    
    // Step 1: Query custom_field_definitions
    const cfDefs = await pool.query(`
      SELECT 
        field_name,
        field_options,
        is_enabled,
        is_required,
        sort_order
      FROM custom_field_definitions
      WHERE entity_type = $1 
        AND organization_id = $2
        AND field_name = ANY($3)
    `, [entity_type, orgId, systemFieldNames]);
    
    const cfDefsMap = new Map(cfDefs.rows.map(r => [r.field_name, r]));
    
    // Step 2: Query default_field_configurations
    const dfConfigs = await pool.query(`
      SELECT 
        field_name,
        field_options,
        is_enabled,
        is_required
      FROM default_field_configurations
      WHERE entity_type = $1
        AND organization_id = $2
        AND field_name = ANY($3)
    `, [entity_type, orgId, systemFieldNames]);
    
    const dfConfigsMap = new Map(dfConfigs.rows.map(r => [r.field_name, r]));
    
    // Step 3: Build systemFields array (simulating backend logic)
    const systemFields = [];
    
    for (const [fieldName, fieldDef] of Object.entries(systemFieldDefaults)) {
      const storedConfig = {
        ...(cfDefsMap.get(fieldName) || {}),
        ...(dfConfigsMap.get(fieldName) || {})
      };
      
      // Merge logic: Use field_options from storedConfig if present AND non-null
      // Otherwise fallback to fieldDef.options
      let fieldOptions = fieldDef.options || null;
      
      // Check custom_field_definitions first
      const cfdEntry = cfDefsMap.get(fieldName);
      const dfcEntry = dfConfigsMap.get(fieldName);
      
      if (cfdEntry && (cfdEntry.field_options !== null && cfdEntry.field_options !== undefined)) {
        // Use custom_field_definitions if it has options
        fieldOptions = cfdEntry.field_options;
      } else if (dfcEntry && (dfcEntry.field_options !== null && dfcEntry.field_options !== undefined)) {
        // Otherwise use default_field_configurations
        fieldOptions = dfcEntry.field_options;
      }
      
      systemFields.push({
        field_name: fieldName,
        field_label: fieldDef.label,
        field_type: fieldDef.type,
        field_options: fieldOptions,
        is_enabled: storedConfig.is_enabled !== undefined ? storedConfig.is_enabled : true,
        is_required: storedConfig.is_required !== undefined ? storedConfig.is_required : fieldDef.required,
        editable: fieldDef.editable
      });
    }
    
    // Find source field
    const sourceField = systemFields.find(f => f.field_name === 'source');
    
    console.log('📋 Source field in systemFields array:');
    console.log(JSON.stringify(sourceField, null, 2));
    
    console.log('\n📋 Full response structure:');
    console.log('{');
    console.log('  customFields: [...], // custom fields array');
    console.log(`  systemFields: [${systemFields.length} fields],`);
    console.log('  defaultFields: [...],');
    console.log('  usage: {...}');
    console.log('}');
    
    console.log('\n✅ Frontend should find source field with:');
    console.log(`   - field_name: ${sourceField.field_name}`);
    console.log(`   - field_type: ${sourceField.field_type}`);
    console.log(`   - field_options: ${sourceField.field_options ? sourceField.field_options.length + ' items' : 'null/undefined'}`);
    
    if (sourceField.field_options && sourceField.field_options.length > 0) {
      console.log(`\n   First 3 options:`);
      sourceField.field_options.slice(0, 3).forEach(opt => {
        console.log(`     - ${opt.label} (${opt.value})`);
      });
    } else {
      console.log('\n   ⚠️ NO OPTIONS! This is the problem!');
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

simulateFullAPIResponse();
