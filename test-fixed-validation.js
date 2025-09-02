#!/usr/bin/env node

/**
 * Test the fixed validation handling
 */

// Load our updated functions
const fs = require('fs');
const scriptContent = fs.readFileSync('./script.js', 'utf8');

// Extract and evaluate the functions we need
eval(scriptContent.match(/function generateSecurePassword\(\)[^}]+}/)[0]);
eval(scriptContent.match(/function generateSlug\(companyName\)[^}]+}/s)[0]);

// Mock data scenarios that might cause validation issues
const testScenarios = [
  {
    name: 'No website provided',
    data: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.com',
      company: 'Test Company'
      // no website field
    }
  },
  {
    name: 'Empty website',
    data: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.com',
      company: 'Test Company',
      website: ''
    }
  },
  {
    name: 'Website with spaces',
    data: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.com',
      company: 'Test Company',
      website: '   '
    }
  },
  {
    name: 'Invalid URL format',
    data: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.com',
      company: 'Test Company',
      website: 'not-a-url'
    }
  },
  {
    name: 'Company with special chars',
    data: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.com',
      company: 'Test & Company, Inc!',
      website: 'https://test.com'
    }
  },
  {
    name: 'Very short company name',
    data: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.com',
      company: 'A',
      website: 'https://test.com'
    }
  }
];

async function testFixedValidation() {
  console.log('🔧 Testing Fixed Validation Logic...\n');
  
  for (const scenario of testScenarios) {
    console.log(`📝 Testing: ${scenario.name}`);
    console.log(`📋 Input:`, scenario.data);
    
    // Simulate the marketing site logic
    const temporaryPassword = generateSecurePassword();
    const organizationSlug = generateSlug(scenario.data.company);
    
    // Extract domain logic
    let domainOnly = null;
    if (scenario.data.website && scenario.data.website.trim() !== '') {
      try {
        const url = new URL(scenario.data.website.startsWith('http') ? scenario.data.website : 'https://' + scenario.data.website);
        domainOnly = url.hostname;
      } catch (e) {
        domainOnly = scenario.data.website.replace(/^https?:\\/\\//, '').split('/')[0];
      }
    }
    
    // Build organization data
    const organizationData = {
      name: scenario.data.company,
      slug: organizationSlug
    };
    
    // Only include domain if it's valid
    if (domainOnly && domainOnly.trim() !== '') {
      organizationData.domain = domainOnly;
    }
    
    const requestData = {
      organization: organizationData,
      admin: {
        email: scenario.data.email.toLowerCase().trim(),
        password: temporaryPassword,
        first_name: scenario.data.firstName.trim(),
        last_name: scenario.data.lastName.trim()
      }
    };
    
    console.log(`🔧 Generated:`, {
      slug: organizationSlug,
      domain: domainOnly,
      hasValidDomain: !!(domainOnly && domainOnly.trim() !== '')
    });
    console.log(`📤 Request:`, JSON.stringify(requestData, null, 2));
    console.log('─'.repeat(60));
  }
}

testFixedValidation();