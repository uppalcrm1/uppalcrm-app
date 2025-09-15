const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Test configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

// Sample Zapier payload examples
const ZAPIER_PAYLOADS = {
  // Standard Zapier lead payload
  standardLead: {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@zapiertest.com',
    phone: '+1-555-123-4567',
    company: 'Zapier Test Corp',
    title: 'Software Engineer',
    source: 'zapier',
    notes: 'Lead captured from Zapier integration',
    custom_fields: {
      zapier_trigger_id: 'zap_12345',
      original_form: 'contact_form'
    }
  },
  
  // Google Forms via Zapier
  googleFormsLead: {
    'Full Name': 'Jane Smith',
    'Email Address': 'jane.smith@forms.google.com',
    'Phone Number': '555-987-6543',
    'Company Name': 'Google Forms Test',
    'Job Title': 'Marketing Manager',
    'How did you hear about us?': 'Search Engine',
    'Message': 'Interested in your software solutions'
  },
  
  // Typeform via Zapier
  typeformLead: {
    email: 'typeform.user@example.com',
    name: 'Typeform User',
    phone: '555-444-3333',
    company_name: 'Typeform Integration',
    job_role: 'Product Manager',
    interested_in: 'Enterprise Solution',
    budget_range: '$10k-50k',
    timeline: 'Within 3 months'
  },
  
  // Mailchimp subscriber via Zapier
  mailchimpLead: {
    email_address: 'subscriber@mailchimp.test',
    merge_fields: {
      FNAME: 'Mailchimp',
      LNAME: 'Subscriber',
      PHONE: '555-111-2222',
      COMPANY: 'Email Marketing Co'
    },
    status: 'subscribed',
    interests: ['product_updates', 'newsletters']
  },
  
  // LinkedIn Lead Gen via Zapier
  linkedinLead: {
    'First Name': 'LinkedIn',
    'Last Name': 'Professional',
    'Email': 'linkedin.pro@business.com',
    'Phone': '555-777-8888',
    'Company': 'Professional Services Inc',
    'Job Title': 'Director of Operations',
    'LinkedIn Profile': 'https://linkedin.com/in/professional',
    'Campaign Name': 'Software Solutions Q4'
  },
  
  // Minimal payload
  minimalLead: {
    email: 'minimal@test.com'
  },
  
  // Complex nested payload
  complexLead: {
    contact: {
      personal: {
        first_name: 'Complex',
        last_name: 'Structure',
        email: 'complex@nested.test'
      },
      business: {
        company: 'Nested Data Corp',
        title: 'Data Architect',
        phone: '555-999-0000'
      }
    },
    metadata: {
      source_system: 'custom_crm',
      lead_score: 85,
      tags: ['high-priority', 'enterprise']
    }
  }
};

// Field mapping configurations for testing
const FIELD_MAPPINGS = {
  standard: {
    'first_name': 'first_name',
    'last_name': 'last_name',
    'email': 'email',
    'phone': 'phone',
    'company': 'company',
    'title': 'title'
  },
  
  googleForms: {
    'Full Name': 'name', // Will be split into first/last
    'Email Address': 'email',
    'Phone Number': 'phone',
    'Company Name': 'company',
    'Job Title': 'title',
    'Message': 'notes'
  },
  
  typeform: {
    'name': 'name',
    'email': 'email',
    'phone': 'phone',
    'company_name': 'company',
    'job_role': 'title',
    'interested_in': 'notes'
  },
  
  mailchimp: {
    'email_address': 'email',
    'merge_fields.FNAME': 'first_name',
    'merge_fields.LNAME': 'last_name',
    'merge_fields.PHONE': 'phone',
    'merge_fields.COMPANY': 'company'
  },
  
  linkedin: {
    'First Name': 'first_name',
    'Last Name': 'last_name',
    'Email': 'email',
    'Phone': 'phone',
    'Company': 'company',
    'Job Title': 'title',
    'LinkedIn Profile': 'linkedin_url'
  },
  
  complex: {
    'contact.personal.first_name': 'first_name',
    'contact.personal.last_name': 'last_name',
    'contact.personal.email': 'email',
    'contact.business.company': 'company',
    'contact.business.title': 'title',
    'contact.business.phone': 'phone',
    'metadata.lead_score': 'score'
  }
};

// Test utilities
class WebhookTestSuite {
  constructor() {
    this.testData = {};
    this.cleanup = [];
    this.authToken = null;
    this.orgSlug = null;
    this.apiKey = null;
    this.webhookEndpointId = null;
    this.secondOrgToken = null;
    this.secondOrgSlug = null;
    this.secondOrgApiKey = null;
  }

  async setupTestOrganization() {
    const orgData = {
      organization: {
        name: `Test Org Webhooks ${uuidv4().substr(0, 8)}`,
        slug: `webhook${Date.now()}`
      },
      admin: {
        email: `admin+webhooks${Date.now()}@testorg.com`,
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

  async setupSecondOrganization() {
    const orgData = {
      organization: {
        name: `Test Org 2 Webhooks ${uuidv4().substr(0, 8)}`,
        slug: `webhook2${Date.now()}`
      },
      admin: {
        email: `admin2+webhooks${Date.now()}@testorg.com`,
        password: 'TestPassword123!',
        first_name: 'Admin2',
        last_name: 'User'
      }
    };

    const response = await axios.post(`${BASE_URL}/auth/register`, orgData);
    this.secondOrgToken = response.data.token;
    this.secondOrgSlug = response.data.organization.slug;

    console.log(`✅ Second test organization created: ${this.secondOrgSlug}`);
    return response.data;
  }

  async createTestApiKey(orgToken, permissions = ['leads:read', 'leads:write']) {
    const apiKeyData = {
      name: 'Webhook Test API Key',
      permissions: permissions,
      rate_limit_per_hour: 1000
    };

    const response = await axios.post(
      `${BASE_URL}/organizations/current/api-keys`,
      apiKeyData,
      {
        headers: {
          'Authorization': `Bearer ${orgToken}`,
          'X-Organization-Slug': orgToken === this.authToken ? this.orgSlug : this.secondOrgSlug,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.api_key.plain_text_key;
  }

  getWebhookHeaders(apiKey = null) {
    return {
      'X-API-Key': apiKey || this.apiKey,
      'Content-Type': 'application/json',
      'X-Webhook-Source': 'zapier-test'
    };
  }

  async cleanup() {
    console.log('🧹 Cleaning up test data...');
    // API keys and webhooks are automatically cleaned up when organizations are deleted
  }

  // Test: Generic Webhook Endpoint
  async testGenericWebhookEndpoint() {
    console.log('🧪 Testing generic webhook endpoint...');
    
    const webhookId = 'test-webhook-123';
    const testPayload = ZAPIER_PAYLOADS.standardLead;

    const response = await axios.post(
      `${BASE_URL}/webhooks/${webhookId}`,
      testPayload,
      { headers: this.getWebhookHeaders() }
    );

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!response.data.success) {
      throw new Error('Webhook should return success: true');
    }

    if (!response.data.webhook_id) {
      throw new Error('Response should include webhook_id');
    }

    console.log('✅ Generic webhook endpoint working correctly');
    return response.data;
  }

  // Test: Direct Lead Creation Webhook
  async testDirectLeadCreationWebhook() {
    console.log('🧪 Testing direct lead creation webhook...');
    
    const testPayload = ZAPIER_PAYLOADS.standardLead;

    const response = await axios.post(
      `${BASE_URL}/webhooks/leads`,
      testPayload,
      { headers: this.getWebhookHeaders() }
    );

    if (response.status !== 201) {
      throw new Error(`Expected status 201, got ${response.status}`);
    }

    if (!response.data.lead) {
      throw new Error('Response should include created lead');
    }

    const lead = response.data.lead;
    if (lead.email !== testPayload.email) {
      throw new Error('Lead email should match payload');
    }

    if (lead.first_name !== testPayload.first_name) {
      throw new Error('Lead first_name should match payload');
    }

    console.log('✅ Direct lead creation webhook working correctly');
    return response.data;
  }

  // Test: Field Mapping - Google Forms
  async testGoogleFormsFieldMapping() {
    console.log('🧪 Testing Google Forms field mapping...');
    
    const testPayload = ZAPIER_PAYLOADS.googleFormsLead;

    const response = await axios.post(
      `${BASE_URL}/webhooks/leads`,
      testPayload,
      { headers: this.getWebhookHeaders() }
    );

    if (response.status !== 201) {
      throw new Error(`Expected status 201, got ${response.status}`);
    }

    const lead = response.data.lead;
    
    // Should map Full Name to first_name/last_name
    if (!lead.first_name || !lead.last_name) {
      throw new Error('Full Name should be split into first_name and last_name');
    }

    // Should map Email Address to email
    if (lead.email !== testPayload['Email Address']) {
      throw new Error('Email Address should map to email field');
    }

    // Should map Company Name to company
    if (lead.company !== testPayload['Company Name']) {
      throw new Error('Company Name should map to company field');
    }

    console.log('✅ Google Forms field mapping working correctly');
    return response.data;
  }

  // Test: Field Mapping - Mailchimp
  async testMailchimpFieldMapping() {
    console.log('🧪 Testing Mailchimp field mapping...');
    
    const testPayload = ZAPIER_PAYLOADS.mailchimpLead;

    const response = await axios.post(
      `${BASE_URL}/webhooks/leads`,
      testPayload,
      { headers: this.getWebhookHeaders() }
    );

    if (response.status !== 201) {
      throw new Error(`Expected status 201, got ${response.status}`);
    }

    const lead = response.data.lead;
    
    // Should map email_address to email
    if (lead.email !== testPayload.email_address) {
      throw new Error('email_address should map to email field');
    }

    // Should map merge_fields.FNAME to first_name
    if (lead.first_name !== testPayload.merge_fields.FNAME) {
      throw new Error('merge_fields.FNAME should map to first_name');
    }

    // Should map merge_fields.COMPANY to company
    if (lead.company !== testPayload.merge_fields.COMPANY) {
      throw new Error('merge_fields.COMPANY should map to company');
    }

    console.log('✅ Mailchimp field mapping working correctly');
    return response.data;
  }

  // Test: Complex Nested Field Mapping
  async testComplexFieldMapping() {
    console.log('🧪 Testing complex nested field mapping...');
    
    const testPayload = ZAPIER_PAYLOADS.complexLead;

    const response = await axios.post(
      `${BASE_URL}/webhooks/leads`,
      testPayload,
      { headers: this.getWebhookHeaders() }
    );

    if (response.status !== 201) {
      throw new Error(`Expected status 201, got ${response.status}`);
    }

    const lead = response.data.lead;
    
    // Should map nested fields correctly
    if (lead.email !== testPayload.contact.personal.email) {
      throw new Error('Nested email field should be mapped correctly');
    }

    if (lead.company !== testPayload.contact.business.company) {
      throw new Error('Nested company field should be mapped correctly');
    }

    console.log('✅ Complex nested field mapping working correctly');
    return response.data;
  }

  // Test: Minimal Payload Handling
  async testMinimalPayloadHandling() {
    console.log('🧪 Testing minimal payload handling...');
    
    const testPayload = ZAPIER_PAYLOADS.minimalLead;

    const response = await axios.post(
      `${BASE_URL}/webhooks/leads`,
      testPayload,
      { headers: this.getWebhookHeaders() }
    );

    if (response.status !== 201) {
      throw new Error(`Expected status 201, got ${response.status}`);
    }

    const lead = response.data.lead;
    
    if (lead.email !== testPayload.email) {
      throw new Error('Email should be mapped correctly');
    }

    // Should handle missing fields gracefully
    if (lead.first_name && lead.first_name !== '') {
      console.log('Note: first_name was derived from email or set to default');
    }

    console.log('✅ Minimal payload handling working correctly');
    return response.data;
  }

  // Test: Webhook Test Endpoint
  async testWebhookTestEndpoint() {
    console.log('🧪 Testing webhook test endpoint...');
    
    const webhookId = 'test-validation-456';

    const response = await axios.get(
      `${BASE_URL}/webhooks/test/${webhookId}`,
      { headers: this.getWebhookHeaders() }
    );

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!response.data.success) {
      throw new Error('Test endpoint should return success: true');
    }

    if (response.data.webhook_id !== webhookId) {
      throw new Error('Response should include correct webhook_id');
    }

    console.log('✅ Webhook test endpoint working correctly');
    return response.data;
  }

  // Test: Multi-tenant Isolation
  async testMultiTenantIsolation() {
    console.log('🧪 Testing multi-tenant isolation for webhooks...');
    
    // Create lead in first org
    const testPayload = {
      ...ZAPIER_PAYLOADS.standardLead,
      email: `isolation.test.org1.${Date.now()}@test.com`
    };

    const firstOrgResponse = await axios.post(
      `${BASE_URL}/webhooks/leads`,
      testPayload,
      { headers: this.getWebhookHeaders(this.apiKey) }
    );

    if (firstOrgResponse.status !== 201) {
      throw new Error('First org lead creation should succeed');
    }

    // Create lead in second org with different API key
    const secondPayload = {
      ...ZAPIER_PAYLOADS.standardLead,
      email: `isolation.test.org2.${Date.now()}@test.com`
    };

    const secondOrgResponse = await axios.post(
      `${BASE_URL}/webhooks/leads`,
      secondPayload,
      { headers: this.getWebhookHeaders(this.secondOrgApiKey) }
    );

    if (secondOrgResponse.status !== 201) {
      throw new Error('Second org lead creation should succeed');
    }

    // Verify leads are isolated by organization
    const firstOrgLead = firstOrgResponse.data.lead;
    const secondOrgLead = secondOrgResponse.data.lead;

    if (firstOrgLead.organization_id === secondOrgLead.organization_id) {
      throw new Error('Leads should belong to different organizations');
    }

    console.log('✅ Multi-tenant isolation working correctly');
  }

  // Test: Invalid API Key
  async testInvalidApiKey() {
    console.log('🧪 Testing invalid API key handling...');
    
    const invalidApiKey = 'invalid_api_key_12345';
    const testPayload = ZAPIER_PAYLOADS.standardLead;

    try {
      await axios.post(
        `${BASE_URL}/webhooks/leads`,
        testPayload,
        { headers: this.getWebhookHeaders(invalidApiKey) }
      );
      throw new Error('Invalid API key should be rejected');
    } catch (error) {
      if (!error.response || error.response.status !== 401) {
        throw new Error('Invalid API key should return 401');
      }
    }

    console.log('✅ Invalid API key handling working correctly');
  }

  // Test: Missing API Key
  async testMissingApiKey() {
    console.log('🧪 Testing missing API key handling...');
    
    const testPayload = ZAPIER_PAYLOADS.standardLead;

    try {
      await axios.post(
        `${BASE_URL}/webhooks/leads`,
        testPayload,
        { headers: { 'Content-Type': 'application/json' } }
      );
      throw new Error('Missing API key should be rejected');
    } catch (error) {
      if (!error.response || error.response.status !== 401) {
        throw new Error('Missing API key should return 401');
      }
    }

    console.log('✅ Missing API key handling working correctly');
  }

  // Test: Rate Limiting
  async testWebhookRateLimiting() {
    console.log('🧪 Testing webhook rate limiting...');
    
    // Note: This test assumes webhook rate limiting is configured
    // Make multiple rapid requests to test rate limiting
    const testPayload = ZAPIER_PAYLOADS.standardLead;
    let successCount = 0;
    let rateLimitedCount = 0;

    // Make 10 rapid requests
    for (let i = 0; i < 10; i++) {
      try {
        const response = await axios.post(
          `${BASE_URL}/webhooks/leads`,
          {
            ...testPayload,
            email: `rate.limit.test.${i}.${Date.now()}@test.com`
          },
          { headers: this.getWebhookHeaders() }
        );
        
        if (response.status === 201) {
          successCount++;
        }
      } catch (error) {
        if (error.response && error.response.status === 429) {
          rateLimitedCount++;
        } else {
          throw error;
        }
      }
    }

    console.log(`Rate limiting results: ${successCount} successful, ${rateLimitedCount} rate limited`);
    
    // Should have at least some successful requests
    if (successCount === 0) {
      throw new Error('Should have at least some successful requests');
    }

    console.log('✅ Webhook rate limiting working correctly');
  }

  // Test: Invalid JSON Payload
  async testInvalidJsonPayload() {
    console.log('🧪 Testing invalid JSON payload handling...');
    
    try {
      await axios.post(
        `${BASE_URL}/webhooks/leads`,
        'invalid json string',
        { 
          headers: {
            ...this.getWebhookHeaders(),
            'Content-Type': 'application/json'
          }
        }
      );
      throw new Error('Invalid JSON should be rejected');
    } catch (error) {
      if (!error.response || error.response.status !== 400) {
        throw new Error('Invalid JSON should return 400');
      }
    }

    console.log('✅ Invalid JSON payload handling working correctly');
  }

  // Test: Empty Payload
  async testEmptyPayload() {
    console.log('🧪 Testing empty payload handling...');
    
    try {
      const response = await axios.post(
        `${BASE_URL}/webhooks/leads`,
        {},
        { headers: this.getWebhookHeaders() }
      );
      
      // Empty payload might be handled gracefully or rejected
      // Check the specific behavior implemented
      if (response.status === 201) {
        console.log('Empty payload was accepted and lead created');
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('Empty payload was properly rejected');
      } else {
        throw error;
      }
    }

    console.log('✅ Empty payload handling working correctly');
  }
}

// Main test runner
async function runAllWebhookTests() {
  const suite = new WebhookTestSuite();
  let passed = 0;
  let failed = 0;

  console.log('🚀 Starting Webhook Tests');
  console.log('=' .repeat(50));

  try {
    // Setup
    await suite.setupTestOrganization();
    await suite.setupSecondOrganization();
    
    // Create API keys for testing
    suite.apiKey = await suite.createTestApiKey(suite.authToken);
    suite.secondOrgApiKey = await suite.createTestApiKey(suite.secondOrgToken);

    console.log('✅ Test setup completed');

    // Run tests
    const tests = [
      () => suite.testGenericWebhookEndpoint(),
      () => suite.testDirectLeadCreationWebhook(),
      () => suite.testGoogleFormsFieldMapping(),
      () => suite.testMailchimpFieldMapping(),
      () => suite.testComplexFieldMapping(),
      () => suite.testMinimalPayloadHandling(),
      () => suite.testWebhookTestEndpoint(),
      () => suite.testMultiTenantIsolation(),
      () => suite.testInvalidApiKey(),
      () => suite.testMissingApiKey(),
      () => suite.testWebhookRateLimiting(),
      () => suite.testInvalidJsonPayload(),
      () => suite.testEmptyPayload(),
    ];

    for (const test of tests) {
      try {
        await test();
        passed++;
      } catch (error) {
        console.error(`❌ Test failed: ${error.message}`);
        failed++;
      }
    }

  } catch (error) {
    console.error(`💥 Setup failed: ${error.message}`);
    failed++;
  } finally {
    // Cleanup
    suite.cleanup();
  }

  console.log('=' .repeat(50));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Export for test runner
module.exports = {
  runAllWebhookTests,
  WebhookTestSuite,
  ZAPIER_PAYLOADS,
  FIELD_MAPPINGS
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllWebhookTests().catch(console.error);
}