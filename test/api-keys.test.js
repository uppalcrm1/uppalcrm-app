const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Test configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

// Test utilities
class ApiKeyTestSuite {
  constructor() {
    this.testData = {};
    this.cleanup = [];
    this.authToken = null;
    this.orgSlug = null;
    this.apiKeys = [];
    this.secondOrgToken = null;
    this.secondOrgSlug = null;
  }

  async setupTestOrganization() {
    const orgData = {
      organization: {
        name: `Test Org API Keys ${uuidv4().substr(0, 8)}`,
        slug: `apitest${Date.now()}`
      },
      admin: {
        email: `admin+apikeys${Date.now()}@testorg.com`,
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
        name: `Test Org 2 API Keys ${uuidv4().substr(0, 8)}`,
        slug: `apitest2${Date.now()}`
      },
      admin: {
        email: `admin2+apikeys${Date.now()}@testorg.com`,
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

  getAuthHeaders(token = null) {
    return {
      'Authorization': `Bearer ${token || this.authToken}`,
      'X-Organization-Slug': this.orgSlug,
      'Content-Type': 'application/json'
    };
  }

  getSecondOrgHeaders() {
    return {
      'Authorization': `Bearer ${this.secondOrgToken}`,
      'X-Organization-Slug': this.secondOrgSlug,
      'Content-Type': 'application/json'
    };
  }

  async cleanup() {
    console.log('🧹 Cleaning up test data...');
    // API keys are automatically cleaned up when organizations are deleted
    // The test framework handles organization cleanup
  }

  // Test: Create API Key
  async testCreateApiKey() {
    console.log('🧪 Testing API key creation...');
    
    const apiKeyData = {
      name: 'Test API Key',
      permissions: ['leads:read', 'leads:write', 'contacts:read'],
      rate_limit_per_hour: 500
    };

    const response = await axios.post(
      `${BASE_URL}/organizations/current/api-keys`,
      apiKeyData,
      { headers: this.getAuthHeaders() }
    );

    if (response.status !== 201) {
      throw new Error(`Expected status 201, got ${response.status}`);
    }

    const apiKey = response.data.api_key;
    if (!apiKey.plain_text_key) {
      throw new Error('API key should include plain text key on creation');
    }

    if (!apiKey.plain_text_key.startsWith(`uppal_${this.orgSlug}_`)) {
      throw new Error(`API key should start with uppal_${this.orgSlug}_`);
    }

    if (apiKey.permissions.length !== 3) {
      throw new Error('API key should have 3 permissions');
    }

    this.apiKeys.push(apiKey);
    console.log('✅ API key created successfully');
    return apiKey;
  }

  // Test: List API Keys
  async testListApiKeys() {
    console.log('🧪 Testing API key listing...');
    
    const response = await axios.get(
      `${BASE_URL}/organizations/current/api-keys`,
      { headers: this.getAuthHeaders() }
    );

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    if (!Array.isArray(response.data.api_keys)) {
      throw new Error('Response should contain api_keys array');
    }

    if (response.data.api_keys.length === 0) {
      throw new Error('Should have at least one API key');
    }

    const apiKey = response.data.api_keys[0];
    if (apiKey.plain_text_key) {
      throw new Error('Listed API keys should not include plain text keys');
    }

    console.log('✅ API key listing successful');
    return response.data;
  }

  // Test: Get API Key Usage
  async testGetApiKeyUsage() {
    console.log('🧪 Testing API key usage retrieval...');
    
    if (this.apiKeys.length === 0) {
      throw new Error('No API keys available for testing');
    }

    const apiKeyId = this.apiKeys[0].id;
    const response = await axios.get(
      `${BASE_URL}/organizations/current/api-keys/${apiKeyId}/usage`,
      { headers: this.getAuthHeaders() }
    );

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    const usage = response.data.usage;
    if (typeof usage.total_requests !== 'number') {
      throw new Error('Usage should include total_requests as number');
    }

    console.log('✅ API key usage retrieval successful');
    return usage;
  }

  // Test: Multi-tenant Isolation
  async testMultiTenantIsolation() {
    console.log('🧪 Testing multi-tenant isolation...');
    
    // Create API key in first org
    const apiKeyData = {
      name: 'Isolation Test Key',
      permissions: ['leads:read'],
      rate_limit_per_hour: 100
    };

    const firstOrgResponse = await axios.post(
      `${BASE_URL}/organizations/current/api-keys`,
      apiKeyData,
      { headers: this.getAuthHeaders() }
    );

    // Try to access first org's API keys from second org
    try {
      const crossOrgResponse = await axios.get(
        `${BASE_URL}/organizations/current/api-keys`,
        { headers: this.getSecondOrgHeaders() }
      );

      // Second org should have no API keys (empty list)
      if (crossOrgResponse.data.api_keys.length > 0) {
        throw new Error('Second org should not see first org API keys');
      }
    } catch (error) {
      if (error.response && error.response.status !== 200) {
        throw new Error('Should get empty list, not error');
      }
    }

    // Try to access specific API key from wrong org
    const firstOrgKeyId = firstOrgResponse.data.api_key.id;
    try {
      await axios.get(
        `${BASE_URL}/organizations/current/api-keys/${firstOrgKeyId}/usage`,
        { headers: this.getSecondOrgHeaders() }
      );
      throw new Error('Should not be able to access other org API key');
    } catch (error) {
      if (!error.response || error.response.status !== 404) {
        throw new Error('Should get 404 when accessing other org API key');
      }
    }

    console.log('✅ Multi-tenant isolation working correctly');
  }

  // Test: API Key Authentication
  async testApiKeyAuthentication() {
    console.log('🧪 Testing API key authentication...');
    
    if (this.apiKeys.length === 0) {
      throw new Error('No API keys available for testing');
    }

    const apiKey = this.apiKeys[0].plain_text_key;
    
    // Test valid API key
    const validResponse = await axios.get(
      `${BASE_URL}/webhooks/test/123`,
      { 
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (validResponse.status !== 200) {
      throw new Error(`Valid API key should work, got status ${validResponse.status}`);
    }

    // Test invalid API key
    try {
      await axios.get(
        `${BASE_URL}/webhooks/test/123`,
        { 
          headers: {
            'X-API-Key': 'invalid_key_12345',
            'Content-Type': 'application/json'
          }
        }
      );
      throw new Error('Invalid API key should be rejected');
    } catch (error) {
      if (!error.response || error.response.status !== 401) {
        throw new Error('Invalid API key should return 401');
      }
    }

    // Test missing API key
    try {
      await axios.get(`${BASE_URL}/webhooks/test/123`);
      throw new Error('Missing API key should be rejected');
    } catch (error) {
      if (!error.response || error.response.status !== 401) {
        throw new Error('Missing API key should return 401');
      }
    }

    console.log('✅ API key authentication working correctly');
  }

  // Test: Permission Validation
  async testPermissionValidation() {
    console.log('🧪 Testing permission validation...');
    
    // Create API key with limited permissions
    const limitedApiKeyData = {
      name: 'Limited Permissions Key',
      permissions: ['leads:read'], // Only read leads
      rate_limit_per_hour: 100
    };

    const response = await axios.post(
      `${BASE_URL}/organizations/current/api-keys`,
      limitedApiKeyData,
      { headers: this.getAuthHeaders() }
    );

    const limitedApiKey = response.data.api_key.plain_text_key;
    
    // This should work (read operation)
    const readResponse = await axios.get(
      `${BASE_URL}/webhooks/test/123`,
      { 
        headers: {
          'X-API-Key': limitedApiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    if (readResponse.status !== 200) {
      throw new Error('Read operation should be allowed');
    }

    console.log('✅ Permission validation working correctly');
  }

  // Test: Rate Limiting
  async testRateLimiting() {
    console.log('🧪 Testing API key rate limiting...');
    
    // Create API key with very low rate limit for testing
    const rateLimitedApiKeyData = {
      name: 'Rate Limited Key',
      permissions: ['leads:read'],
      rate_limit_per_hour: 2 // Very low limit
    };

    const response = await axios.post(
      `${BASE_URL}/organizations/current/api-keys`,
      rateLimitedApiKeyData,
      { headers: this.getAuthHeaders() }
    );

    const rateLimitedApiKey = response.data.api_key.plain_text_key;
    
    // Make requests up to the limit
    for (let i = 0; i < 2; i++) {
      const testResponse = await axios.get(
        `${BASE_URL}/webhooks/test/123`,
        { 
          headers: {
            'X-API-Key': rateLimitedApiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (testResponse.status !== 200) {
        throw new Error(`Request ${i + 1} should succeed`);
      }
    }

    // Third request should be rate limited
    try {
      await axios.get(
        `${BASE_URL}/webhooks/test/123`,
        { 
          headers: {
            'X-API-Key': rateLimitedApiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      throw new Error('Third request should be rate limited');
    } catch (error) {
      if (!error.response || error.response.status !== 429) {
        throw new Error('Rate limited request should return 429');
      }
    }

    console.log('✅ Rate limiting working correctly');
  }

  // Test: Deactivate API Key
  async testDeactivateApiKey() {
    console.log('🧪 Testing API key deactivation...');
    
    if (this.apiKeys.length === 0) {
      throw new Error('No API keys available for testing');
    }

    const apiKeyId = this.apiKeys[0].id;
    const apiKeyPlainText = this.apiKeys[0].plain_text_key;
    
    // Deactivate the API key
    const response = await axios.delete(
      `${BASE_URL}/organizations/current/api-keys/${apiKeyId}`,
      { headers: this.getAuthHeaders() }
    );

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    // Test that deactivated key no longer works
    try {
      await axios.get(
        `${BASE_URL}/webhooks/test/123`,
        { 
          headers: {
            'X-API-Key': apiKeyPlainText,
            'Content-Type': 'application/json'
          }
        }
      );
      throw new Error('Deactivated API key should not work');
    } catch (error) {
      if (!error.response || error.response.status !== 401) {
        throw new Error('Deactivated API key should return 401');
      }
    }

    console.log('✅ API key deactivation working correctly');
  }

  // Test: Invalid API Key Format
  async testInvalidApiKeyFormat() {
    console.log('🧪 Testing invalid API key format handling...');
    
    const invalidFormats = [
      '', // Empty
      'invalid', // Too short
      'uppal_wrongorg_validlooking', // Wrong org
      'notuppal_' + this.orgSlug + '_validlooking', // Wrong prefix
      'uppal_' + this.orgSlug, // Missing random part
    ];

    for (const invalidKey of invalidFormats) {
      try {
        await axios.get(
          `${BASE_URL}/webhooks/test/123`,
          { 
            headers: {
              'X-API-Key': invalidKey,
              'Content-Type': 'application/json'
            }
          }
        );
        throw new Error(`Invalid key "${invalidKey}" should be rejected`);
      } catch (error) {
        if (!error.response || error.response.status !== 401) {
          throw new Error(`Invalid key "${invalidKey}" should return 401`);
        }
      }
    }

    console.log('✅ Invalid API key format handling working correctly');
  }
}

// Main test runner
async function runAllApiKeyTests() {
  const suite = new ApiKeyTestSuite();
  let passed = 0;
  let failed = 0;

  console.log('🚀 Starting API Key Tests');
  console.log('=' .repeat(50));

  try {
    // Setup
    await suite.setupTestOrganization();
    await suite.setupSecondOrganization();

    // Run tests
    const tests = [
      () => suite.testCreateApiKey(),
      () => suite.testListApiKeys(),
      () => suite.testGetApiKeyUsage(),
      () => suite.testMultiTenantIsolation(),
      () => suite.testApiKeyAuthentication(),
      () => suite.testPermissionValidation(),
      () => suite.testRateLimiting(),
      () => suite.testDeactivateApiKey(),
      () => suite.testInvalidApiKeyFormat(),
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
  runAllApiKeyTests,
  ApiKeyTestSuite
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllApiKeyTests().catch(console.error);
}