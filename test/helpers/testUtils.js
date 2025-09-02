const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Test configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

// Utility class for test authentication and setup
class TestAuthHelper {
  constructor() {
    this.tokens = new Map();
    this.organizations = new Map();
    this.cleanupQueue = [];
  }

  // Create a test organization and return authentication details
  async createTestOrganization(orgName = null) {
    const orgId = orgName || `test_org_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    const orgData = {
      organization: {
        name: `Test Org ${orgId}`,
        slug: orgId.toLowerCase()
      },
      admin: {
        email: `admin+${orgId}@testorg.com`,
        password: 'TestPassword123!',
        first_name: 'Test',
        last_name: 'Admin'
      }
    };

    try {
      const response = await axios.post(`${BASE_URL}/auth/register`, orgData);
      
      const authDetails = {
        token: response.data.token,
        organization: response.data.organization,
        user: response.data.user,
        orgSlug: response.data.organization.slug
      };

      this.tokens.set(orgId, authDetails);
      this.organizations.set(orgId, authDetails);
      this.cleanupQueue.push(orgId);

      return authDetails;
    } catch (error) {
      console.error(`Failed to create test organization ${orgId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  // Get authentication headers for a test organization
  getHeaders(orgId) {
    const auth = this.tokens.get(orgId);
    if (!auth) {
      throw new Error(`No authentication found for organization: ${orgId}`);
    }

    return {
      'Authorization': `Bearer ${auth.token}`,
      'X-Organization-Slug': auth.orgSlug,
      'Content-Type': 'application/json'
    };
  }

  // Get organization details
  getOrganization(orgId) {
    return this.organizations.get(orgId);
  }

  // Clean up all test organizations
  async cleanup() {
    // In a real test environment, this would clean up test data
    // For now, we just clear our local references
    this.tokens.clear();
    this.organizations.clear();
    this.cleanupQueue = [];
  }

  // List all active test organizations
  listOrganizations() {
    return Array.from(this.organizations.keys());
  }
}

// Utility functions for common test operations
class TestDataHelper {
  constructor(authHelper) {
    this.authHelper = authHelper;
  }

  // Create a test contact
  async createContact(orgId, contactData) {
    const response = await axios.post(
      `${BASE_URL}/contacts`,
      contactData,
      { headers: this.authHelper.getHeaders(orgId) }
    );
    return response.data.contact;
  }

  // Create a test lead
  async createLead(orgId, leadData) {
    const response = await axios.post(
      `${BASE_URL}/leads`,
      leadData,
      { headers: this.authHelper.getHeaders(orgId) }
    );
    return response.data.lead;
  }

  // Create a test account
  async createAccount(orgId, contactId, accountData) {
    const response = await axios.post(
      `${BASE_URL}/contacts/${contactId}/accounts`,
      accountData,
      { headers: this.authHelper.getHeaders(orgId) }
    );
    return response.data.account;
  }

  // Register a test device
  async registerDevice(orgId, contactId, deviceData) {
    const response = await axios.post(
      `${BASE_URL}/contacts/${contactId}/devices`,
      deviceData,
      { headers: this.authHelper.getHeaders(orgId) }
    );
    return response.data.device;
  }

  // Generate a test license
  async generateLicense(orgId, contactId, licenseData) {
    const response = await axios.post(
      `${BASE_URL}/contacts/${contactId}/licenses`,
      licenseData,
      { headers: this.authHelper.getHeaders(orgId) }
    );
    return response.data.license;
  }

  // Create a test trial
  async createTrial(orgId, contactId, trialData) {
    const response = await axios.post(
      `${BASE_URL}/contacts/${contactId}/trials`,
      trialData,
      { headers: this.authHelper.getHeaders(orgId) }
    );
    return response.data.trial;
  }

  // Convert lead to contact
  async convertLead(orgId, leadId, conversionData = {}) {
    const response = await axios.post(
      `${BASE_URL}/contacts/convert-from-lead/${leadId}`,
      conversionData,
      { headers: this.authHelper.getHeaders(orgId) }
    );
    return response.data.contact;
  }
}

// Test assertion utilities
class TestAssertions {
  static assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: expected ${expected}, got ${actual}`);
    }
  }

  static assertTrue(condition, message = '') {
    if (!condition) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: expected true`);
    }
  }

  static assertFalse(condition, message = '') {
    if (condition) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: expected false`);
    }
  }

  static assertNotNull(value, message = '') {
    if (value === null || value === undefined) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: expected non-null value`);
    }
  }

  static assertNull(value, message = '') {
    if (value !== null && value !== undefined) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: expected null value`);
    }
  }

  static assertContains(array, item, message = '') {
    if (!Array.isArray(array) || !array.includes(item)) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: array does not contain ${item}`);
    }
  }

  static assertNotContains(array, item, message = '') {
    if (Array.isArray(array) && array.includes(item)) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: array should not contain ${item}`);
    }
  }

  static assertArrayLength(array, expectedLength, message = '') {
    if (!Array.isArray(array) || array.length !== expectedLength) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: expected array length ${expectedLength}, got ${array ? array.length : 'not an array'}`);
    }
  }

  static assertObjectHasProperty(obj, property, message = '') {
    if (!obj || typeof obj !== 'object' || !(property in obj)) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: object does not have property ${property}`);
    }
  }

  static assertValidEmail(email, message = '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: invalid email format ${email}`);
    }
  }

  static assertValidMAC(macAddress, message = '') {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$|^([0-9A-Fa-f]{12})$/;
    if (!macRegex.test(macAddress)) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: invalid MAC address format ${macAddress}`);
    }
  }

  static assertValidLicenseKey(licenseKey, message = '') {
    // License keys should be 32+ characters and alphanumeric
    if (!licenseKey || typeof licenseKey !== 'string' || licenseKey.length < 32 || !/^[A-Za-z0-9]+$/.test(licenseKey)) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: invalid license key format`);
    }
  }

  static assertDateInFuture(date, message = '') {
    const dateObj = new Date(date);
    const now = new Date();
    if (dateObj <= now) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: date ${date} is not in the future`);
    }
  }

  static assertDateInPast(date, message = '') {
    const dateObj = new Date(date);
    const now = new Date();
    if (dateObj >= now) {
      throw new Error(`Assertion failed${message ? ': ' + message : ''}: date ${date} is not in the past`);
    }
  }
}

// MAC address validation utilities
class MACAddressValidator {
  static normalize(macAddress) {
    // Remove all separators and convert to uppercase
    return macAddress.replace(/[:-]/g, '').toUpperCase();
  }

  static isValid(macAddress) {
    // Valid formats: XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX, XXXXXXXXXXXX
    const patterns = [
      /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, // XX:XX:XX:XX:XX:XX
      /^([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}$/, // XX-XX-XX-XX-XX-XX
      /^[0-9A-Fa-f]{12}$/                       // XXXXXXXXXXXX
    ];
    
    return patterns.some(pattern => pattern.test(macAddress));
  }

  static format(macAddress) {
    const normalized = this.normalize(macAddress);
    if (normalized.length !== 12) return null;
    
    // Format as XX:XX:XX:XX:XX:XX
    return normalized.match(/.{2}/g).join(':');
  }

  static generateRandom() {
    const hex = '0123456789ABCDEF';
    let mac = '';
    for (let i = 0; i < 12; i++) {
      mac += hex[Math.floor(Math.random() * 16)];
    }
    return this.format(mac);
  }
}

// License key utilities
class LicenseKeyUtils {
  static isValidFormat(licenseKey) {
    // Basic validation - should be alphanumeric and long enough
    return licenseKey && 
           typeof licenseKey === 'string' && 
           licenseKey.length >= 32 && 
           /^[A-Za-z0-9]+$/.test(licenseKey);
  }

  static extractInfo(licenseKey) {
    // In a real system, this would decode embedded information
    return {
      isValid: this.isValidFormat(licenseKey),
      length: licenseKey ? licenseKey.length : 0,
      type: licenseKey ? (licenseKey.startsWith('TRIAL') ? 'trial' : 'full') : null
    };
  }
}

// Test performance measurement
class TestTimer {
  constructor() {
    this.startTime = null;
    this.endTime = null;
  }

  start() {
    this.startTime = Date.now();
  }

  stop() {
    this.endTime = Date.now();
    return this.getDuration();
  }

  getDuration() {
    if (!this.startTime || !this.endTime) {
      return null;
    }
    return this.endTime - this.startTime;
  }

  static measure(fn) {
    const timer = new TestTimer();
    timer.start();
    const result = fn();
    timer.stop();
    return {
      result,
      duration: timer.getDuration()
    };
  }

  static async measureAsync(fn) {
    const timer = new TestTimer();
    timer.start();
    const result = await fn();
    timer.stop();
    return {
      result,
      duration: timer.getDuration()
    };
  }
}

// Test result collector
class TestResults {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  addResult(testName, status, details = {}) {
    this.results.push({
      testName,
      status, // 'PASSED', 'FAILED', 'SKIPPED'
      details,
      timestamp: Date.now()
    });
  }

  addPassed(testName, details = {}) {
    this.addResult(testName, 'PASSED', details);
  }

  addFailed(testName, error, details = {}) {
    this.addResult(testName, 'FAILED', { ...details, error: error.message || error });
  }

  addSkipped(testName, reason, details = {}) {
    this.addResult(testName, 'SKIPPED', { ...details, reason });
  }

  getSummary() {
    const passed = this.results.filter(r => r.status === 'PASSED').length;
    const failed = this.results.filter(r => r.status === 'FAILED').length;
    const skipped = this.results.filter(r => r.status === 'SKIPPED').length;
    const total = this.results.length;
    const duration = Date.now() - this.startTime;

    return {
      total,
      passed,
      failed,
      skipped,
      duration,
      success: failed === 0
    };
  }

  printSummary() {
    const summary = this.getSummary();
    
    console.log('\n📊 Test Results Summary');
    console.log('═══════════════════════');
    console.log(`✅ Passed:  ${summary.passed}`);
    console.log(`❌ Failed:  ${summary.failed}`);
    console.log(`⏭️  Skipped: ${summary.skipped}`);
    console.log(`📈 Total:   ${summary.total}`);
    console.log(`⏱️  Duration: ${summary.duration}ms`);
    
    if (summary.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'FAILED')
        .forEach(result => {
          console.log(`   • ${result.testName}: ${result.details.error}`);
        });
    }
    
    return summary;
  }
}

module.exports = {
  TestAuthHelper,
  TestDataHelper,
  TestAssertions,
  MACAddressValidator,
  LicenseKeyUtils,
  TestTimer,
  TestResults,
  BASE_URL
};