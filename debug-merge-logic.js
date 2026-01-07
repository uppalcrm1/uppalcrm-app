require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function debugMergeLogic() {
  try {
    const entity_type = 'contacts';
    const orgId = '06048209-8ab4-4816-b23c-6f6362fea521';
    
    console.log('🔍 Debugging merge logic step by step...\n');
    
    // Step 1: Get default_field_configurations
    const dfcResult = await pool.query(`
      SELECT field_name, field_options, is_enabled, is_required, sort_order
      FROM default_field_configurations
      WHERE organization_id = $1 AND entity_type = $2
    `, [orgId, entity_type]);
    
    console.log('Step 1: default_field_configurations query:');
    console.log(`  Total rows: ${dfcResult.rowCount}`);
    const dfcSource = dfcResult.rows.find(r => r.field_name === 'source');
    if (dfcSource) {
      console.log('  source found:');
      console.log(`    field_options: ${dfcSource.field_options ? dfcSource.field_options.length + ' items' : 'null'}`);
    } else {
      console.log('  source NOT FOUND in default_field_configurations');
    }
    
    // Build storedConfigs like backend does
    let storedConfigs = {};
    dfcResult.rows.forEach(config => {
      storedConfigs[config.field_name] = config;
    });
    console.log(`  storedConfigs keys: ${Object.keys(storedConfigs).join(', ')}`);
    console.log(`  storedConfigs['source']: ${storedConfigs['source'] ? 'EXISTS' : 'MISSING'}\n`);
    
    // Step 2: Get custom_field_definitions for system fields
    const systemFieldNames = ['firstName', 'lastName', 'email', 'phone', 'company', 'title', 'department', 'linkedIn', 'source', 'status', 'assignedTo', 'lastContactDate', 'notes'];
    
    const cfdResult = await pool.query(`
      SELECT field_name, field_options, is_enabled, is_required
      FROM custom_field_definitions
      WHERE organization_id = $1 
        AND entity_type = $2
        AND field_name = ANY($3)
    `, [orgId, entity_type, systemFieldNames]);
    
    console.log('Step 2: custom_field_definitions query for system fields:');
    console.log(`  Total rows: ${cfdResult.rowCount}`);
    const cfdSource = cfdResult.rows.find(r => r.field_name === 'source');
    if (cfdSource) {
      console.log('  source found:');
      console.log(`    field_options: ${cfdSource.field_options ? cfdSource.field_options.length + ' items' : 'null'}`);
      console.log(`    field_options is array: ${Array.isArray(cfdSource.field_options)}`);
      console.log(`    field_options length > 0: ${cfdSource.field_options && cfdSource.field_options.length > 0}`);
    } else {
      console.log('  source NOT FOUND in custom_field_definitions');
    }
    
    // Step 3: Apply merge logic
    console.log('\nStep 3: Applying merge logic (from lines 826-838):');
    cfdResult.rows.forEach(config => {
      const hasOptions = config.field_options && Array.isArray(config.field_options) && config.field_options.length > 0;
      console.log(`  ${config.field_name}: hasOptions=${hasOptions}`);
      
      if (hasOptions) {
        storedConfigs[config.field_name] = config;
        console.log(`    -> OVERRIDE with custom_field_definitions`);
      } else {
        if (storedConfigs[config.field_name]) {
          storedConfigs[config.field_name] = {
            ...storedConfigs[config.field_name],
            is_enabled: config.is_enabled !== undefined ? config.is_enabled : storedConfigs[config.field_name].is_enabled,
            is_required: config.is_required !== undefined ? config.is_required : storedConfigs[config.field_name].is_required
          };
          console.log(`    -> KEEP field_options from default_field_configurations`);
        } else {
          console.log(`    -> No entry in default_field_configurations, skip`);
        }
      }
    });
    
    console.log(`\nStep 4: Final storedConfigs['source']:`);
    if (storedConfigs['source']) {
      console.log(`  field_options: ${storedConfigs['source'].field_options ? storedConfigs['source'].field_options.length + ' items' : 'null'}`);
      console.log(`  is_enabled: ${storedConfigs['source'].is_enabled}`);
      console.log(`  is_required: ${storedConfigs['source'].is_required}`);
    } else {
      console.log(`  NOT FOUND in storedConfigs!`);
    }
    
    // Step 5: Check what fieldDef.options would be
    const fieldDefOptions = []; // This is what systemFieldDefaults.contacts.source.options is
    console.log(`\nStep 5: systemFieldDefaults.contacts.source.options = []`);
    console.log(`  This is the FALLBACK if storedConfigs doesn't have field_options\n`);
    
    // Step 6: Final field_options determination (line 847-850)
    let fieldOptions = fieldDefOptions || null;
    if (storedConfigs['source'] && storedConfigs['source'].field_options) {
      fieldOptions = storedConfigs['source'].field_options;
      console.log(`Step 6: Final field_options (using storedConfigs): ${fieldOptions.length} items ✅`);
    } else {
      console.log(`Step 6: Final field_options (using fieldDef): ${fieldOptions ? fieldOptions.length : 'null'} ❌`);
      console.log(`  THIS IS THE PROBLEM! storedConfigs['source'].field_options is falsy!`);
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

debugMergeLogic();
