#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

// Test credentials - using demo user from database
const TEST_EMAIL = 'admin@testcompany.com';
const TEST_PASSWORD = 'SecurePassword123!';

async function testSimplifiedLogin() {
  console.log('🧪 Testing Simplified Login Flow\n');

  try {
    console.log('1️⃣ Testing login with email and password only...');
    
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (loginResponse.status === 200) {
      console.log('✅ Login successful!');
      console.log('📋 Response data:');
      console.log('  - User:', loginResponse.data.user.email);
      console.log('  - Organization:', loginResponse.data.organization.name);
      console.log('  - Token received:', !!loginResponse.data.token);
      
      const token = loginResponse.data.token;
      
      console.log('\n2️⃣ Testing authenticated request...');
      const meResponse = await axios.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Organization-Slug': loginResponse.data.organization.slug
        }
      });

      if (meResponse.status === 200) {
        console.log('✅ Authenticated request successful!');
        console.log('  - Current user:', meResponse.data.user.email);
        console.log('  - Organization:', meResponse.data.organization.name);
      } else {
        console.log('❌ Authenticated request failed');
      }

      console.log('\n3️⃣ Testing logout...');
      const logoutResponse = await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Organization-Slug': loginResponse.data.organization.slug
        }
      });

      if (logoutResponse.status === 200) {
        console.log('✅ Logout successful!');
      } else {
        console.log('❌ Logout failed');
      }

    } else {
      console.log('❌ Login failed with status:', loginResponse.status);
    }

  } catch (error) {
    console.log('❌ Test failed:');
    if (error.response) {
      console.log('  - Status:', error.response.status);
      console.log('  - Message:', error.response.data?.message || 'No message');
      console.log('  - Error:', error.response.data?.error || 'No error details');
    } else {
      console.log('  - Network error:', error.message);
    }
  }

  console.log('\n4️⃣ Testing invalid credentials...');
  try {
    await axios.post(`${API_BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: 'wrongpassword'
    });
    console.log('❌ Invalid credentials test failed - should have been rejected');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Invalid credentials correctly rejected!');
    } else {
      console.log('❌ Unexpected error for invalid credentials:', error.response?.status);
    }
  }

  console.log('\n5️⃣ Testing nonexistent user...');
  try {
    await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'nonexistent@example.com',
      password: 'somepassword'
    });
    console.log('❌ Nonexistent user test failed - should have been rejected');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Nonexistent user correctly rejected!');
    } else {
      console.log('❌ Unexpected error for nonexistent user:', error.response?.status);
    }
  }

  console.log('\n🎉 Simplified login testing completed!');
}

// Run the test
testSimplifiedLogin()
  .then(() => {
    console.log('\n✅ All tests completed!');
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error);
  });