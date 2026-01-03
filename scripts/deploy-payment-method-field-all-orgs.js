require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Payment method options to use
const PAYMENT_METHOD_OPTIONS = [
  { label: 'Cash', value: 'Cash' },
  { label: 'Credit Card', value: 'Credit Card' },
  { label: 'Debit Card', value: 'Debit Card' },
  { label: 'Bank Transfer', value: 'Bank Transfer' },
  { label: 'UPI', value: 'UPI' },
  { label: 'PayPal', value: 'PayPal' },
  { label: 'Cheque', value: 'Cheque' },
  { label: 'Stripe', value: 'Stripe' },
  { label: 'Zelle', value: 'Zelle' },
  { label: 'Other', value: 'Other' }
];

async function deployPaymentMethodField() {
  const client = await pool.connect();

  try {
    console.log('🚀 Deploy payment_method field configuration for all organizations\n');

    // Get all organizations
    const orgsResult = await client.query(`
      SELECT id, name FROM organizations ORDER BY created_at
    `);

    console.log(`Found ${orgsResult.rows.length} organizations\n`);

    if (orgsResult.rows.length === 0) {
      console.log('⚠️  No organizations found in database');
      return;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const org of orgsResult.rows) {
      console.log(`\n📋 Processing organization: ${org.name} (${org.id})`);

      // Check if payment_method field already exists for this org
      const checkResult = await client.query(`
        SELECT id, field_options
        FROM custom_field_definitions
        WHERE organization_id = $1
          AND entity_type = 'transactions'
          AND field_name = 'payment_method'
      `, [org.id]);

      if (checkResult.rows.length > 0) {
        console.log(`   ✅ Field already exists (ID: ${checkResult.rows[0].id})`);
        console.log(`   Current options:`, JSON.stringify(checkResult.rows[0].field_options));

        // Update the options to ensure they match the standard set
        await client.query(`
          UPDATE custom_field_definitions
          SET
            field_options = $1::jsonb,
            updated_at = NOW()
          WHERE id = $2
        `, [JSON.stringify(PAYMENT_METHOD_OPTIONS), checkResult.rows[0].id]);

        console.log(`   🔄 Updated field options`);
        updated++;
      } else {
        // Create new field for this organization
        const insertResult = await client.query(`
          INSERT INTO custom_field_definitions (
            organization_id,
            entity_type,
            field_name,
            field_label,
            field_type,
            field_options,
            is_required,
            is_active,
            show_in_create_form,
            show_in_edit_form,
            show_in_detail_view,
            show_in_list_view,
            is_searchable,
            is_filterable,
            display_order,
            created_at,
            updated_at
          ) VALUES (
            $1,
            'transactions',
            'payment_method',
            'Payment Method',
            'select',
            $2::jsonb,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            5,
            NOW(),
            NOW()
          )
          RETURNING id
        `, [org.id, JSON.stringify(PAYMENT_METHOD_OPTIONS)]);

        console.log(`   ✅ Created new field (ID: ${insertResult.rows[0].id})`);
        created++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total organizations: ${orgsResult.rows.length}`);
    console.log(`Fields created: ${created}`);
    console.log(`Fields updated: ${updated}`);
    console.log(`Fields skipped: ${skipped}`);
    console.log('\n✅ Deployment complete!\n');
    console.log('Payment method options:');
    PAYMENT_METHOD_OPTIONS.forEach(opt => console.log(`  - ${opt.label}`));
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Full error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

deployPaymentMethodField().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
