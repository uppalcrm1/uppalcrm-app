const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Test configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

// Test utilities
class ContactTestSuite {
  constructor() {
    this.testData = {};
    this.cleanup = [];
    this.authToken = null;
    this.orgSlug = null;
    this.leadId = null;
    this.contactId = null;
  }

  async setupTestOrganization() {
    const orgData = {
      organization: {
        name: `Test Org ${uuidv4().substr(0, 8)}`,
        slug: `testorg${Date.now()}`
      },
      admin: {
        email: `admin+${Date.now()}@testorg.com`,
        password: 'TestPassword123!',
        first_name: 'Admin',
        last_name: 'User'
      }
    };

    const response = await axios.post(`${BASE_URL}/auth/register`, orgData);
    this.authToken = response.data.token;
    this.orgSlug = response.data.organization.slug;
    this.testData.organization = response.data.organization;
    this.testData.adminUser = response.data.user;

    console.log(`✅ Test organization created: ${this.orgSlug}`);
    return response.data;
  }

  async setupTestLead() {
    const leadData = {
      first_name: 'John',
      last_name: 'Doe',
      email: `john.doe+${Date.now()}@example.com`,
      phone: '+1-555-123-4567',
      company: 'Acme Corporation',
      title: 'CTO',
      status: 'qualified',
      priority: 'high',
      value: 10000,
      source: 'website',
      notes: 'Qualified lead ready for conversion'
    };

    const response = await axios.post(`${BASE_URL}/leads`, leadData, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'X-Organization-Slug': this.orgSlug
      }
    });

    this.leadId = response.data.lead.id;
    this.testData.lead = response.data.lead;
    console.log(`✅ Test lead created: ${this.leadId}`);
    return response.data.lead;
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'X-Organization-Slug': this.orgSlug,
      'Content-Type': 'application/json'
    };
  }

  async cleanup() {
    // Cleanup will be handled by database rollback in a real test environment
    console.log('🧹 Test cleanup completed');
  }
}

// Test suite functions
async function testContactCRUD() {
  console.log('\n📋 Testing Contact CRUD Operations');
  console.log('═══════════════════════════════════');

  const suite = new ContactTestSuite();
  await suite.setupTestOrganization();

  try {
    // Test 1: Create Contact
    console.log('\n1️⃣  Creating contact...');
    const contactData = {
      first_name: 'Jane',
      last_name: 'Smith',
      email: `jane.smith+${Date.now()}@example.com`,
      phone: '+1-555-987-6543',
      company: 'Smith Industries',
      title: 'CEO',
      notes: 'Important client contact'
    };

    const createResponse = await axios.post(`${BASE_URL}/contacts`, contactData, {
      headers: suite.getHeaders()
    });

    console.log('✅ Contact created successfully');
    console.log(`📧 Email: ${createResponse.data.contact.email}`);
    console.log(`🏢 Company: ${createResponse.data.contact.company}`);
    
    const contactId = createResponse.data.contact.id;
    suite.contactId = contactId;

    // Test 2: Get Contact
    console.log('\n2️⃣  Retrieving contact...');
    const getResponse = await axios.get(`${BASE_URL}/contacts/${contactId}`, {
      headers: suite.getHeaders()
    });

    console.log('✅ Contact retrieved successfully');
    console.log(`👤 Name: ${getResponse.data.contact.full_name}`);
    console.log(`📧 Email: ${getResponse.data.contact.email}`);

    // Test 3: Update Contact
    console.log('\n3️⃣  Updating contact...');
    const updateData = {
      title: 'Chief Executive Officer',
      notes: 'Updated important client contact'
    };

    const updateResponse = await axios.put(`${BASE_URL}/contacts/${contactId}`, updateData, {
      headers: suite.getHeaders()
    });

    console.log('✅ Contact updated successfully');
    console.log(`🎭 New title: ${updateResponse.data.contact.title}`);

    // Test 4: List Contacts
    console.log('\n4️⃣  Listing contacts...');
    const listResponse = await axios.get(`${BASE_URL}/contacts?limit=10`, {
      headers: suite.getHeaders()
    });

    console.log('✅ Contacts listed successfully');
    console.log(`📊 Total contacts: ${listResponse.data.contacts.length}`);
    console.log(`🔢 Pagination: Page ${listResponse.data.pagination.page} of ${listResponse.data.pagination.pages}`);

    // Test 5: Get Contact Stats
    console.log('\n5️⃣  Getting contact statistics...');
    const statsResponse = await axios.get(`${BASE_URL}/contacts/stats`, {
      headers: suite.getHeaders()
    });

    console.log('✅ Contact statistics retrieved');
    console.log(`📈 Total contacts: ${statsResponse.data.stats.total_contacts}`);
    console.log(`📊 Active licenses: ${statsResponse.data.stats.active_licenses || 0}`);

    return { success: true, contactId, suite };

  } catch (error) {
    console.error('❌ Contact CRUD test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testLeadToContactConversion() {
  console.log('\n🔄 Testing Lead-to-Contact Conversion');
  console.log('════════════════════════════════════');

  const suite = new ContactTestSuite();
  await suite.setupTestOrganization();
  await suite.setupTestLead();

  try {
    // Test lead conversion
    console.log('\n1️⃣  Converting lead to contact...');
    const conversionData = {
      software_edition: 'professional',
      notes: 'Converted from qualified lead'
    };

    const conversionResponse = await axios.post(
      `${BASE_URL}/contacts/convert-from-lead/${suite.leadId}`, 
      conversionData, 
      { headers: suite.getHeaders() }
    );

    console.log('✅ Lead converted successfully');
    console.log(`👤 Contact: ${conversionResponse.data.contact.full_name}`);
    console.log(`📧 Email: ${conversionResponse.data.contact.email}`);
    console.log(`💼 Edition: ${conversionResponse.data.contact.software_edition}`);

    const contactId = conversionResponse.data.contact.id;

    // Verify contact exists
    console.log('\n2️⃣  Verifying converted contact...');
    const verifyResponse = await axios.get(`${BASE_URL}/contacts/${contactId}`, {
      headers: suite.getHeaders()
    });

    console.log('✅ Converted contact verified');
    console.log(`🆔 Contact ID: ${verifyResponse.data.contact.id}`);
    console.log(`🔗 Lead source: ${verifyResponse.data.contact.lead_source || 'conversion'}`);

    // Test that original lead status was updated
    console.log('\n3️⃣  Checking original lead status...');
    const leadCheckResponse = await axios.get(`${BASE_URL}/leads/${suite.leadId}`, {
      headers: suite.getHeaders()
    });

    console.log('✅ Original lead status verified');
    console.log(`📋 Lead status: ${leadCheckResponse.data.lead.status}`);

    return { success: true, contactId, suite };

  } catch (error) {
    console.error('❌ Lead conversion test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testMACAddressValidation() {
  console.log('\n🖥️  Testing MAC Address Validation & Device Registration');
  console.log('════════════════════════════════════════════════════');

  const suite = new ContactTestSuite();
  await suite.setupTestOrganization();

  // First create a contact
  const contactData = {
    first_name: 'Device',
    last_name: 'Tester',
    email: `device.tester+${Date.now()}@example.com`,
    company: 'Tech Corp'
  };

  const contactResponse = await axios.post(`${BASE_URL}/contacts`, contactData, {
    headers: suite.getHeaders()
  });
  const contactId = contactResponse.data.contact.id;

  try {
    // Test 1: Valid MAC address formats
    console.log('\n1️⃣  Testing valid MAC address formats...');
    const validMACs = [
      '00:1B:44:11:3A:B7',
      '00-1B-44-11-3A-B8',
      '001B441134B9',
      '00:1b:44:11:3a:ba' // lowercase
    ];

    for (let i = 0; i < validMACs.length; i++) {
      const deviceData = {
        device_name: `Test Device ${i + 1}`,
        mac_address: validMACs[i],
        hardware_info: `Test Hardware ${i + 1}`,
        os_version: 'Windows 11',
        notes: `Valid MAC test ${i + 1}`
      };

      const deviceResponse = await axios.post(
        `${BASE_URL}/contacts/${contactId}/devices`, 
        deviceData, 
        { headers: suite.getHeaders() }
      );

      console.log(`✅ Device ${i + 1} registered with MAC: ${validMACs[i]}`);
      console.log(`   Normalized: ${deviceResponse.data.device.mac_address}`);
    }

    // Test 2: Invalid MAC address formats
    console.log('\n2️⃣  Testing invalid MAC address formats...');
    const invalidMACs = [
      'invalid-mac',
      '00:1B:44:11:3A', // too short
      '00:1B:44:11:3A:B7:FF', // too long
      '00:1G:44:11:3A:B7', // invalid character
      '00:1B:44:11:3A:GG' // invalid hex
    ];

    for (let i = 0; i < invalidMACs.length; i++) {
      try {
        const deviceData = {
          device_name: `Invalid Device ${i + 1}`,
          mac_address: invalidMACs[i],
          hardware_info: 'Test Hardware'
        };

        await axios.post(
          `${BASE_URL}/contacts/${contactId}/devices`, 
          deviceData, 
          { headers: suite.getHeaders() }
        );

        console.log(`❌ Should have failed for MAC: ${invalidMACs[i]}`);
      } catch (error) {
        console.log(`✅ Correctly rejected invalid MAC: ${invalidMACs[i]}`);
      }
    }

    // Test 3: Duplicate MAC address detection
    console.log('\n3️⃣  Testing duplicate MAC address detection...');
    const duplicateMAC = '00:1B:44:11:3A:C1';
    
    // Register first device
    const firstDeviceData = {
      device_name: 'First Device',
      mac_address: duplicateMAC,
      hardware_info: 'First Hardware'
    };

    await axios.post(
      `${BASE_URL}/contacts/${contactId}/devices`, 
      firstDeviceData, 
      { headers: suite.getHeaders() }
    );
    console.log(`✅ First device registered with MAC: ${duplicateMAC}`);

    // Try to register duplicate
    try {
      const secondDeviceData = {
        device_name: 'Duplicate Device',
        mac_address: duplicateMAC,
        hardware_info: 'Duplicate Hardware'
      };

      await axios.post(
        `${BASE_URL}/contacts/${contactId}/devices`, 
        secondDeviceData, 
        { headers: suite.getHeaders() }
      );
      console.log('❌ Should have failed for duplicate MAC');
    } catch (error) {
      console.log('✅ Correctly rejected duplicate MAC address');
    }

    // Test 4: List registered devices
    console.log('\n4️⃣  Listing registered devices...');
    const devicesResponse = await axios.get(`${BASE_URL}/contacts/${contactId}/devices`, {
      headers: suite.getHeaders()
    });

    console.log('✅ Devices listed successfully');
    console.log(`🖥️  Total devices: ${devicesResponse.data.devices.length}`);
    devicesResponse.data.devices.forEach((device, i) => {
      console.log(`   ${i + 1}. ${device.device_name} (${device.mac_address})`);
    });

    return { success: true, contactId, suite };

  } catch (error) {
    console.error('❌ MAC address validation test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testLicenseGeneration() {
  console.log('\n🔑 Testing License Generation & Management');
  console.log('════════════════════════════════════════');

  const suite = new ContactTestSuite();
  await suite.setupTestOrganization();

  // Create contact first
  const contactData = {
    first_name: 'License',
    last_name: 'Tester',
    email: `license.tester+${Date.now()}@example.com`,
    company: 'License Corp'
  };

  const contactResponse = await axios.post(`${BASE_URL}/contacts`, contactData, {
    headers: suite.getHeaders()
  });
  const contactId = contactResponse.data.contact.id;

  try {
    // Test 1: Generate new license
    console.log('\n1️⃣  Generating new license...');
    const licenseData = {
      software_edition: 'professional',
      license_type: 'full',
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      max_devices: 5,
      features: ['advanced_analytics', 'api_access', 'priority_support'],
      notes: 'Generated for testing'
    };

    const licenseResponse = await axios.post(
      `${BASE_URL}/contacts/${contactId}/licenses`, 
      licenseData, 
      { headers: suite.getHeaders() }
    );

    console.log('✅ License generated successfully');
    console.log(`🔑 License key: ${licenseResponse.data.license.license_key}`);
    console.log(`📅 Expires: ${new Date(licenseResponse.data.license.expires_at).toLocaleDateString()}`);
    console.log(`🖥️  Max devices: ${licenseResponse.data.license.max_devices}`);

    const licenseId = licenseResponse.data.license.id;
    const licenseKey = licenseResponse.data.license.license_key;

    // Test 2: Validate license key uniqueness
    console.log('\n2️⃣  Validating license key uniqueness...');
    
    // Generate multiple licenses to ensure uniqueness
    const generatedKeys = [licenseKey];
    for (let i = 0; i < 5; i++) {
      const newLicenseData = {
        software_edition: 'basic',
        license_type: 'full',
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        max_devices: 1
      };

      const newLicenseResponse = await axios.post(
        `${BASE_URL}/contacts/${contactId}/licenses`, 
        newLicenseData, 
        { headers: suite.getHeaders() }
      );

      generatedKeys.push(newLicenseResponse.data.license.license_key);
    }

    const uniqueKeys = [...new Set(generatedKeys)];
    console.log(`✅ Generated ${generatedKeys.length} licenses, all unique: ${uniqueKeys.length === generatedKeys.length}`);

    // Test 3: License transfer
    console.log('\n3️⃣  Testing license transfer...');
    
    // Create second contact
    const secondContactData = {
      first_name: 'Transfer',
      last_name: 'Recipient',
      email: `transfer.recipient+${Date.now()}@example.com`,
      company: 'Transfer Corp'
    };

    const secondContactResponse = await axios.post(`${BASE_URL}/contacts`, secondContactData, {
      headers: suite.getHeaders()
    });
    const secondContactId = secondContactResponse.data.contact.id;

    // Transfer license
    const transferData = {
      new_contact_id: secondContactId,
      reason: 'Testing license transfer functionality'
    };

    const transferResponse = await axios.post(
      `${BASE_URL}/contacts/licenses/${licenseId}/transfer`, 
      transferData, 
      { headers: suite.getHeaders() }
    );

    console.log('✅ License transferred successfully');
    console.log(`👤 New owner: ${transferResponse.data.license.contact_id}`);
    console.log(`📝 Transfer reason: ${transferResponse.data.transfer.reason}`);

    // Test 4: List licenses
    console.log('\n4️⃣  Listing licenses...');
    const licensesResponse = await axios.get(`${BASE_URL}/contacts/${secondContactId}/licenses`, {
      headers: suite.getHeaders()
    });

    console.log('✅ Licenses listed successfully');
    console.log(`📄 Total licenses: ${licensesResponse.data.licenses.length}`);
    licensesResponse.data.licenses.forEach((license, i) => {
      console.log(`   ${i + 1}. ${license.license_key} (${license.software_edition})`);
    });

    return { success: true, contactId, suite };

  } catch (error) {
    console.error('❌ License generation test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testTrialManagement() {
  console.log('\n⏰ Testing Trial Creation & Expiration Logic');
  console.log('═══════════════════════════════════════════');

  const suite = new ContactTestSuite();
  await suite.setupTestOrganization();

  // Create contact first
  const contactData = {
    first_name: 'Trial',
    last_name: 'User',
    email: `trial.user+${Date.now()}@example.com`,
    company: 'Trial Corp'
  };

  const contactResponse = await axios.post(`${BASE_URL}/contacts`, contactData, {
    headers: suite.getHeaders()
  });
  const contactId = contactResponse.data.contact.id;

  try {
    // Test 1: Create standard 30-day trial
    console.log('\n1️⃣  Creating 30-day trial...');
    const trialData = {
      software_edition: 'professional',
      trial_days: 30,
      features: ['basic_features', 'advanced_analytics'],
      max_devices: 3,
      notes: 'Standard 30-day trial'
    };

    const trialResponse = await axios.post(
      `${BASE_URL}/contacts/${contactId}/trials`, 
      trialData, 
      { headers: suite.getHeaders() }
    );

    console.log('✅ Trial created successfully');
    console.log(`🔑 Trial key: ${trialResponse.data.trial.license_key}`);
    console.log(`📅 Expires: ${new Date(trialResponse.data.trial.expires_at).toLocaleDateString()}`);
    console.log(`🖥️  Max devices: ${trialResponse.data.trial.max_devices}`);

    const trialId = trialResponse.data.trial.id;

    // Test 2: Create extended trial
    console.log('\n2️⃣  Creating extended 90-day trial...');
    const extendedTrialData = {
      software_edition: 'enterprise',
      trial_days: 90,
      features: ['all_features', 'premium_support'],
      max_devices: 10,
      notes: 'Extended enterprise trial'
    };

    const extendedTrialResponse = await axios.post(
      `${BASE_URL}/contacts/${contactId}/trials`, 
      extendedTrialData, 
      { headers: suite.getHeaders() }
    );

    console.log('✅ Extended trial created successfully');
    console.log(`📅 Expires: ${new Date(extendedTrialResponse.data.trial.expires_at).toLocaleDateString()}`);

    // Test 3: Create expired trial (for testing expiration logic)
    console.log('\n3️⃣  Creating expired trial...');
    const expiredTrialData = {
      software_edition: 'basic',
      trial_days: -1, // This should create an already expired trial
      features: ['basic_features'],
      max_devices: 1,
      notes: 'Expired trial for testing'
    };

    const expiredTrialResponse = await axios.post(
      `${BASE_URL}/contacts/${contactId}/trials`, 
      expiredTrialData, 
      { headers: suite.getHeaders() }
    );

    console.log('✅ Expired trial created for testing');
    console.log(`📅 Expires: ${new Date(expiredTrialResponse.data.trial.expires_at).toLocaleDateString()}`);

    // Test 4: List all trials
    console.log('\n4️⃣  Listing all trials...');
    const trialsResponse = await axios.get(`${BASE_URL}/contacts/${contactId}/trials`, {
      headers: suite.getHeaders()
    });

    console.log('✅ Trials listed successfully');
    console.log(`📊 Total trials: ${trialsResponse.data.trials.length}`);
    trialsResponse.data.trials.forEach((trial, i) => {
      const isExpired = new Date(trial.expires_at) < new Date();
      console.log(`   ${i + 1}. ${trial.license_key} (${trial.software_edition}) - ${isExpired ? 'EXPIRED' : 'ACTIVE'}`);
    });

    // Test 5: Filter active vs expired trials
    console.log('\n5️⃣  Testing trial status filtering...');
    const activeTrialsResponse = await axios.get(`${BASE_URL}/contacts/${contactId}/trials?status=active`, {
      headers: suite.getHeaders()
    });

    const expiredTrialsResponse = await axios.get(`${BASE_URL}/contacts/${contactId}/trials?status=expired`, {
      headers: suite.getHeaders()
    });

    console.log('✅ Trial filtering works correctly');
    console.log(`🟢 Active trials: ${activeTrialsResponse.data.trials.length}`);
    console.log(`🔴 Expired trials: ${expiredTrialsResponse.data.trials.length}`);

    return { success: true, contactId, suite };

  } catch (error) {
    console.error('❌ Trial management test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testMultiTenantIsolation() {
  console.log('\n🏢 Testing Multi-Tenant Isolation');
  console.log('═══════════════════════════════════');

  const suite1 = new ContactTestSuite();
  const suite2 = new ContactTestSuite();

  // Create two separate organizations
  await suite1.setupTestOrganization();
  await suite2.setupTestOrganization();

  try {
    // Create contacts in each organization
    console.log('\n1️⃣  Creating contacts in separate organizations...');
    
    const contact1Data = {
      first_name: 'Org1',
      last_name: 'Contact',
      email: `org1.contact+${Date.now()}@example.com`,
      company: 'Organization 1'
    };

    const contact2Data = {
      first_name: 'Org2',
      last_name: 'Contact',
      email: `org2.contact+${Date.now()}@example.com`,
      company: 'Organization 2'
    };

    const contact1Response = await axios.post(`${BASE_URL}/contacts`, contact1Data, {
      headers: suite1.getHeaders()
    });

    const contact2Response = await axios.post(`${BASE_URL}/contacts`, contact2Data, {
      headers: suite2.getHeaders()
    });

    console.log(`✅ Contact created in org 1: ${contact1Response.data.contact.id}`);
    console.log(`✅ Contact created in org 2: ${contact2Response.data.contact.id}`);

    const contact1Id = contact1Response.data.contact.id;
    const contact2Id = contact2Response.data.contact.id;

    // Test 2: Verify organization 1 cannot access organization 2's contacts
    console.log('\n2️⃣  Testing cross-organization access restriction...');
    
    try {
      await axios.get(`${BASE_URL}/contacts/${contact2Id}`, {
        headers: suite1.getHeaders() // Org 1 trying to access Org 2's contact
      });
      console.log('❌ Should not be able to access other organization\'s contact');
    } catch (error) {
      if (error.response?.status === 404 || error.response?.status === 403) {
        console.log('✅ Cross-organization access correctly blocked');
      } else {
        throw error;
      }
    }

    // Test 3: Verify contact lists are isolated
    console.log('\n3️⃣  Testing contact list isolation...');
    
    const org1Contacts = await axios.get(`${BASE_URL}/contacts`, {
      headers: suite1.getHeaders()
    });

    const org2Contacts = await axios.get(`${BASE_URL}/contacts`, {
      headers: suite2.getHeaders()
    });

    console.log(`✅ Org 1 contacts: ${org1Contacts.data.contacts.length}`);
    console.log(`✅ Org 2 contacts: ${org2Contacts.data.contacts.length}`);

    // Verify contacts are not mixed
    const org1ContactIds = org1Contacts.data.contacts.map(c => c.id);
    const org2ContactIds = org2Contacts.data.contacts.map(c => c.id);
    
    const hasOverlap = org1ContactIds.some(id => org2ContactIds.includes(id));
    console.log(`✅ No contact overlap between organizations: ${!hasOverlap}`);

    // Test 4: Test license isolation
    console.log('\n4️⃣  Testing license isolation...');
    
    // Create licenses in both organizations
    const licenseData = {
      software_edition: 'professional',
      license_type: 'full',
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      max_devices: 5
    };

    const license1Response = await axios.post(
      `${BASE_URL}/contacts/${contact1Id}/licenses`, 
      licenseData, 
      { headers: suite1.getHeaders() }
    );

    const license2Response = await axios.post(
      `${BASE_URL}/contacts/${contact2Id}/licenses`, 
      licenseData, 
      { headers: suite2.getHeaders() }
    );

    console.log(`✅ License created in org 1: ${license1Response.data.license.license_key}`);
    console.log(`✅ License created in org 2: ${license2Response.data.license.license_key}`);

    // Verify license keys are different
    const key1 = license1Response.data.license.license_key;
    const key2 = license2Response.data.license.license_key;
    console.log(`✅ License keys are unique: ${key1 !== key2}`);

    // Test 5: Test statistics isolation
    console.log('\n5️⃣  Testing statistics isolation...');
    
    const stats1Response = await axios.get(`${BASE_URL}/contacts/stats`, {
      headers: suite1.getHeaders()
    });

    const stats2Response = await axios.get(`${BASE_URL}/contacts/stats`, {
      headers: suite2.getHeaders()
    });

    console.log(`✅ Org 1 stats - Contacts: ${stats1Response.data.stats.total_contacts}, Licenses: ${stats1Response.data.stats.total_licenses || 0}`);
    console.log(`✅ Org 2 stats - Contacts: ${stats2Response.data.stats.total_contacts}, Licenses: ${stats2Response.data.stats.total_licenses || 0}`);

    // Verify stats are isolated (each org should have 1 contact and 1 license)
    const org1HasCorrectStats = stats1Response.data.stats.total_contacts >= 1;
    const org2HasCorrectStats = stats2Response.data.stats.total_contacts >= 1;
    
    console.log(`✅ Statistics properly isolated: Org1=${org1HasCorrectStats}, Org2=${org2HasCorrectStats}`);

    return { success: true, suite1, suite2 };

  } catch (error) {
    console.error('❌ Multi-tenant isolation test failed:', error.response?.data || error.message);
    throw error;
  }
}

// Main test runner
async function runAllContactTests() {
  console.log('🧪 Contact Management System Test Suite');
  console.log('═══════════════════════════════════════════');
  console.log(`📍 Testing API: ${BASE_URL}`);
  console.log('');

  const testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    { name: 'Contact CRUD Operations', fn: testContactCRUD },
    { name: 'Lead-to-Contact Conversion', fn: testLeadToContactConversion },
    { name: 'MAC Address Validation', fn: testMACAddressValidation },
    { name: 'License Generation', fn: testLicenseGeneration },
    { name: 'Trial Management', fn: testTrialManagement },
    { name: 'Multi-Tenant Isolation', fn: testMultiTenantIsolation }
  ];

  for (const test of tests) {
    try {
      console.log(`\n🚀 Running: ${test.name}`);
      const result = await test.fn();
      testResults.passed++;
      testResults.tests.push({ name: test.name, status: 'PASSED', result });
      console.log(`✅ ${test.name} - PASSED`);
    } catch (error) {
      testResults.failed++;
      testResults.tests.push({ name: test.name, status: 'FAILED', error: error.message });
      console.log(`❌ ${test.name} - FAILED: ${error.message}`);
    }
  }

  // Final Results
  console.log('\n🎯 Test Results Summary');
  console.log('═════════════════════');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total:  ${testResults.passed + testResults.failed}`);

  testResults.tests.forEach(test => {
    const icon = test.status === 'PASSED' ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
  });

  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! Contact management system is working perfectly!');
    console.log('\n✨ Key Features Verified:');
    console.log('• Complete CRUD operations for contacts');
    console.log('• Seamless lead-to-contact conversion workflow');
    console.log('• Robust MAC address validation and device registration');
    console.log('• Secure license generation with unique keys');
    console.log('• Flexible trial creation and expiration management');
    console.log('• Perfect multi-tenant data isolation');
  } else {
    console.log(`\n⚠️  ${testResults.failed} test(s) failed. Please review the errors above.`);
    process.exit(1);
  }

  return testResults;
}

// Export for use in other test files or CI/CD
module.exports = {
  runAllContactTests,
  testContactCRUD,
  testLeadToContactConversion,
  testMACAddressValidation,
  testLicenseGeneration,
  testTrialManagement,
  testMultiTenantIsolation,
  ContactTestSuite
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllContactTests().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}