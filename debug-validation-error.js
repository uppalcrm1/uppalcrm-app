#!/usr/bin/env node

/**
 * Debug script to identify validation errors in registration API
 */

const axios = require('axios');

async function testValidationScenarios() {
  console.log('🔍 Testing Registration API Validation Scenarios...\n');
  
  const testCases = [
    {
      name: 'Valid Complete Data',
      data: {
        organization: {
          name: 'Test Company',
          slug: 'testcompany',
          domain: 'test.com'
        },
        admin: {
          email: 'test@example.com',
          password: 'TestPass123!',
          first_name: 'Test',
          last_name: 'User'
        }
      }
    },
    {
      name: 'Missing Organization Slug',
      data: {
        organization: {
          name: 'Test Company',
          domain: 'test.com'
        },
        admin: {
          email: 'test@example.com',
          password: 'TestPass123!',
          first_name: 'Test',
          last_name: 'User'
        }
      }
    },
    {
      name: 'Missing Domain (Optional)',
      data: {
        organization: {
          name: 'Test Company',
          slug: 'testcompany'
        },
        admin: {
          email: 'test@example.com',
          password: 'TestPass123!',
          first_name: 'Test',
          last_name: 'User'
        }
      }
    },
    {
      name: 'Null Domain',
      data: {
        organization: {
          name: 'Test Company',
          slug: 'testcompany',
          domain: null
        },
        admin: {
          email: 'test@example.com',
          password: 'TestPass123!',
          first_name: 'Test',
          last_name: 'User'
        }
      }
    },
    {
      name: 'Empty Domain String',
      data: {
        organization: {
          name: 'Test Company',
          slug: 'testcompany',
          domain: ''
        },
        admin: {
          email: 'test@example.com',
          password: 'TestPass123!',
          first_name: 'Test',
          last_name: 'User'
        }
      }
    },
    {
      name: 'Invalid Domain Format',
      data: {
        organization: {
          name: 'Test Company',
          slug: 'testcompany',
          domain: 'not-a-valid-domain'
        },
        admin: {
          email: 'test@example.com',
          password: 'TestPass123!',
          first_name: 'Test',
          last_name: 'User'
        }
      }
    },
    {
      name: 'Slug with Special Characters',
      data: {
        organization: {
          name: 'Test Company',
          slug: 'test-company-123',
          domain: 'test.com'
        },
        admin: {
          email: 'test@example.com',
          password: 'TestPass123!',
          first_name: 'Test',
          last_name: 'User'
        }
      }
    },
    {
      name: 'Missing Required Fields',
      data: {
        organization: {
          name: 'Test Company'
        },
        admin: {
          email: 'test@example.com'
        }
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log('📋 Data:', JSON.stringify(testCase.data, null, 2));
    
    try {
      const response = await axios.post(
        'https://uppalcrm-api.onrender.com/api/auth/register',
        testCase.data,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': 'https://uppalcrmapp.netlify.app'
          },
          timeout: 30000
        }
      );
      
      console.log('✅ SUCCESS:', response.status);
      
    } catch (error) {
      if (error.response) {
        console.log('❌ VALIDATION ERROR:', error.response.status);
        console.log('📝 Error Details:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.log('❌ NETWORK ERROR:', error.message);
      }
    }
    
    console.log('─'.repeat(60));
  }
}

// Run debug
if (require.main === module) {
  testValidationScenarios().then(() => {
    console.log('\n✨ Validation debug completed!');
    process.exit(0);
  }).catch(err => {
    console.error('\n💥 Debug failed:', err.message);
    process.exit(1);
  });
}

module.exports = { testValidationScenarios };