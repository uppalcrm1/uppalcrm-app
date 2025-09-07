const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: { rejectUnauthorized: false }
});

async function testContactCreation() {
  try {
    console.log('🧪 Testing contact creation...');
    
    // First, get an organization ID
    const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
    if (orgResult.rows.length === 0) {
      console.log('❌ No organizations found. Creating test organization...');
      const createOrgResult = await pool.query(`
        INSERT INTO organizations (id, name, slug) 
        VALUES (gen_random_uuid(), 'Test Organization', 'test-org-' || substr(gen_random_uuid()::text, 1, 8))
        RETURNING id
      `);
      var orgId = createOrgResult.rows[0].id;
      console.log(`✅ Created test organization: ${orgId}`);
    } else {
      var orgId = orgResult.rows[0].id;
      console.log(`✅ Using existing organization: ${orgId}`);
    }
    
    // Set the organization context for RLS
    await pool.query('SELECT set_config($1, $2, false)', ['app.current_organization_id', orgId]);
    
    // Test creating a contact using the new structure
    const testContactResult = await pool.query(`
      INSERT INTO contacts (
        organization_id,
        first_name,
        last_name,
        email,
        phone,
        company,
        contact_status,
        contact_source,
        tags,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, name, tenant_id, status, source, tags, email
    `, [
      orgId,
      'John',
      'Doe',
      'john.doe.test@example.com',
      '555-0123',
      'Test Company',
      'prospect',
      'api_test',
      ['test', 'api'],
      'Test contact created during migration verification'
    ]);
    
    const contact = testContactResult.rows[0];
    console.log('✅ Contact created successfully!');
    console.log('📋 Contact details:');
    console.log(`   • ID: ${contact.id}`);
    console.log(`   • Name: ${contact.name}`);
    console.log(`   • Tenant ID: ${contact.tenant_id}`);
    console.log(`   • Status: ${contact.status}`);
    console.log(`   • Source: ${contact.source}`);
    console.log(`   • Tags: ${contact.tags}`);
    console.log(`   • Email: ${contact.email}`);
    
    // Test the API view
    const apiViewResult = await pool.query(`
      SELECT id, name, tenant_id, status, source, tags, email
      FROM contacts_api 
      WHERE email = 'john.doe.test@example.com'
    `);
    
    if (apiViewResult.rows.length > 0) {
      console.log('✅ contacts_api view working correctly!');
    } else {
      console.log('⚠️  contacts_api view not returning expected data');
    }
    
    await pool.end();
    console.log('\n🎉 CONTACT CREATION TEST SUCCESSFUL!');
    console.log('The "Unable to create contact" error should now be resolved.');
    
  } catch (error) {
    console.error('❌ Contact creation failed:', error.message);
    console.error('Details:', error.detail);
    if (error.constraint) {
      console.error('Constraint:', error.constraint);
    }
    process.exit(1);
  }
}

testContactCreation();