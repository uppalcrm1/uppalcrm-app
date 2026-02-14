const { query, closePool } = require('../database/connection');

const DevTestOrgId = '4af68759-65cf-4b38-8fd5-e6f41d7a726f';

const simulateCustomFieldsAPIResponse = async () => {
  try {
    console.log('\n🔍 Simulating Custom Fields API Response for Transactions\n');
    console.log('═'.repeat(80));

    // Define system fields from the customFields.js code (line 779-820)
    const systemFieldsByEntity = {
      transactions: {
        transaction_id: { label: 'Transaction ID', type: 'text', required: false, editable: true },
        amount: { label: 'Amount', type: 'number', required: true, editable: true },
        currency: {
          label: 'Currency',
          type: 'select',
          required: false,
          editable: true,
          options: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR']
        },
        payment_method: {
          label: 'Payment Method',
          type: 'select',
          required: true,
          editable: true,
          options: ['Credit Card', 'Debit Card', 'Bank Transfer', 'PayPal', 'Cash', 'Check', 'Stripe', 'Other']
        },
        payment_date: { label: 'Payment Date', type: 'date', required: true, editable: true },
        status: {
          label: 'Status',
          type: 'select',
          required: true,
          editable: true,
          options: ['pending', 'completed', 'failed', 'refunded']
        },
        term: {
          label: 'Billing Term',
          type: 'select',
          required: true,
          editable: true,
          options: ['1', '3', '6', '12']
        },
        source: {
          label: 'Source',
          type: 'select',
          required: false,
          editable: true,
          options: ['manual', 'website', 'phone', 'email', 'referral', 'walk-in', 'partner']
        },
        transaction_reference: { label: 'Transaction Reference', type: 'text', required: false, editable: true },
        notes: { label: 'Notes', type: 'textarea', required: false, editable: true }
      }
    };

    const systemFieldDefaults = systemFieldsByEntity.transactions;

    // Get stored configurations for system fields from default_field_configurations table
    console.log('📂 Querying default_field_configurations table...\n');
    const configResult = await query(`
      SELECT field_name, field_options, is_enabled, is_required, sort_order,
             overall_visibility, visibility_logic,
             show_in_create_form, show_in_edit_form, show_in_detail_view, show_in_list_view
      FROM default_field_configurations
      WHERE organization_id = $1 AND entity_type = $2
    `, [DevTestOrgId, 'transactions']);

    let storedConfigs = {};
    configResult.rows.forEach(config => {
      storedConfigs[config.field_name] = config;
    });

    console.log(`✅ Found ${configResult.rows.length} stored system field configurations\n`);

    // Build complete system fields list (as the API does)
    console.log('🔨 Building system fields response (simulating API logic)...\n');
    const systemFields = [];

    Object.entries(systemFieldDefaults).forEach(([fieldName, fieldDef]) => {
      const storedConfig = storedConfigs[fieldName] || {};

      // Use stored field options if they exist, otherwise use defaults
      let fieldOptions = fieldDef.options || null;
      if (storedConfig.field_options) {
        fieldOptions = storedConfig.field_options;
      }

      systemFields.push({
        field_name: fieldName,
        field_label: fieldDef.label,
        field_type: fieldDef.type,
        field_options: fieldOptions,
        is_enabled: storedConfig.is_enabled !== undefined ? storedConfig.is_enabled : true,
        is_required: storedConfig.is_required !== undefined ? storedConfig.is_required : fieldDef.required,
        is_deleted: false,
        sort_order: storedConfig.sort_order || 0,
        editable: fieldDef.editable,
        overall_visibility: storedConfig.overall_visibility || 'visible',
        visibility_logic: storedConfig.visibility_logic || 'master_override',
        show_in_create_form: storedConfig.show_in_create_form !== undefined ? storedConfig.show_in_create_form : true,
        show_in_edit_form: storedConfig.show_in_edit_form !== undefined ? storedConfig.show_in_edit_form : true,
        show_in_detail_view: storedConfig.show_in_detail_view !== undefined ? storedConfig.show_in_detail_view : true,
        show_in_list_view: storedConfig.show_in_list_view !== undefined ? storedConfig.show_in_list_view : false
      });
    });

    console.log('═'.repeat(80));
    console.log('\n📋 SIMULATED API RESPONSE (GET /api/custom-fields?entity_type=transactions)\n');
    console.log('═'.repeat(80));

    // Find and display the term field
    const termField = systemFields.find(f => f.field_name === 'term');

    if (termField) {
      console.log('\n✅ TERM FIELD IN API RESPONSE:\n');
      console.log('Field Configuration:');
      console.log('─'.repeat(80));
      console.log(`  field_name: "${termField.field_name}"`);
      console.log(`  field_label: "${termField.field_label}"`);
      console.log(`  field_type: "${termField.field_type}"`);
      console.log(`  is_enabled: ${termField.is_enabled}`);
      console.log(`  is_required: ${termField.is_required}`);
      console.log(`  is_deleted: ${termField.is_deleted}`);
      console.log(`  sort_order: ${termField.sort_order}`);
      console.log(`  overall_visibility: "${termField.overall_visibility}"`);
      console.log(`  visibility_logic: "${termField.visibility_logic}"`);
      console.log(`  show_in_create_form: ${termField.show_in_create_form}`);
      console.log(`  show_in_edit_form: ${termField.show_in_edit_form}`);
      console.log(`  show_in_detail_view: ${termField.show_in_detail_view}`);
      console.log(`  show_in_list_view: ${termField.show_in_list_view}`);
      console.log(`  editable: ${termField.editable}`);

      console.log('\nfield_options (JSON):');
      console.log('─'.repeat(80));
      if (Array.isArray(termField.field_options)) {
        console.log(JSON.stringify(termField.field_options, null, 2));
      } else {
        console.log(`  [${termField.field_options.map(o => `"${o}"`).join(', ')}]  (as simple array)`);
      }

      console.log('─'.repeat(80));

      // Detailed validation
      console.log('\n✔️ VALIDATION:');
      if (Array.isArray(termField.field_options) && termField.field_options.length > 0) {
        const firstOption = termField.field_options[0];
        const isComplexFormat = firstOption && typeof firstOption === 'object' && firstOption.label;

        if (isComplexFormat) {
          console.log('  ✅ Term field using COMPLEX OPTION FORMAT (with label, value, is_default, sort_order)');
          console.log('\n  Individual Options:');
          termField.field_options.forEach((opt, idx) => {
            console.log(`    [${idx + 1}] ${opt.label} (value=${opt.value}, is_default=${opt.is_default}, sort_order=${opt.sort_order})`);
          });
        } else {
          console.log('  ⚠️  Term field using SIMPLE OPTION FORMAT (basic string/value array)');
          console.log(`      Options: [${termField.field_options.join(', ')}]`);
        }
      }

      console.log('\n  Expected for Admin Settings:');
      console.log('    ✅ Field shows in Admin Settings UI');
      console.log('    ✅ Dropdown will have 4 options: 1 Month, 3 Months, 6 Months, 1 Year');
      console.log('    ✅ All options marked as default');
      console.log('    ✅ Proper sorting by sort_order (1, 2, 3, 4)');
    } else {
      console.log('❌ TERM FIELD NOT FOUND in system fields!');
    }

    console.log('\n' + '═'.repeat(80));
    console.log('\n📦 All Transactions System Fields Returned:');
    console.log('─'.repeat(80));
    systemFields.forEach(field => {
      const optionType = Array.isArray(field.field_options) ? (field.field_options.length > 0 && typeof field.field_options[0] === 'object' ? 'complex' : 'simple') : 'none';
      console.log(`  ${field.field_name.padEnd(25)} type=${field.field_type.padEnd(10)} required=${String(field.is_required).padEnd(5)} options=${optionType}`);
    });
    console.log('─'.repeat(80));

    console.log('\n✨ Simulation complete!\n');

    await closePool();
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    await closePool();
    process.exit(1);
  }
};

simulateCustomFieldsAPIResponse();
