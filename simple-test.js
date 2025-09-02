const axios = require('axios');

async function simpleContactTest() {
  console.log('🧪 Simple Contact Management Test');
  console.log('═══════════════════════════════════');
  
  const API_BASE = 'http://localhost:3003/api';
  
  try {
    // Step 1: Test API accessibility
    console.log('1️⃣ Testing API accessibility...');
    const apiResponse = await axios.get(`${API_BASE}`);
    console.log('✅ API accessible');
    
    // Step 2: Create test organization
    console.log('\n2️⃣ Creating test organization...');
    const orgData = {
      organization: {
        name: `Simple Test Org ${Date.now()}`,
        slug: `simpletest${Date.now()}`
      },
      admin: {
        email: `admin+${Date.now()}@simpletest.com`,
        password: 'SimpleTest123!',
        first_name: 'Simple',
        last_name: 'Admin'
      }
    };
    
    const regResponse = await axios.post(`${API_BASE}/auth/register`, orgData);
    console.log('✅ Organization created');
    
    const token = regResponse.data.token;
    const orgSlug = regResponse.data.organization.slug;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'X-Organization-Slug': orgSlug,
      'Content-Type': 'application/json'
    };
    
    // Step 3: Create a contact
    console.log('\n3️⃣ Creating contact...');
    const contactData = {
      first_name: 'John',
      last_name: 'Doe',
      email: `john.doe+${Date.now()}@example.com`,
      company: 'Test Company',
      title: 'Test Manager'
    };
    
    const contactResponse = await axios.post(`${API_BASE}/contacts`, contactData, { headers });
    console.log('✅ Contact created successfully');
    console.log(`👤 Contact: ${contactResponse.data.contact.full_name}`);
    console.log(`📧 Email: ${contactResponse.data.contact.email}`);
    
    const contactId = contactResponse.data.contact.id;
    
    // Step 4: Retrieve the contact
    console.log('\n4️⃣ Retrieving contact...');
    const getContactResponse = await axios.get(`${API_BASE}/contacts/${contactId}`, { headers });
    console.log('✅ Contact retrieved successfully');
    console.log(`🆔 ID: ${getContactResponse.data.contact.id}`);
    
    // Step 5: List contacts
    console.log('\n5️⃣ Listing contacts...');
    const listResponse = await axios.get(`${API_BASE}/contacts`, { headers });
    console.log('✅ Contacts listed successfully');
    console.log(`📊 Total: ${listResponse.data.contacts.length} contacts`);
    
    // Step 6: Update contact
    console.log('\n6️⃣ Updating contact...');
    const updateData = { title: 'Senior Test Manager' };
    const updateResponse = await axios.put(`${API_BASE}/contacts/${contactId}`, updateData, { headers });
    console.log('✅ Contact updated successfully');
    console.log(`🎭 New title: ${updateResponse.data.contact.title}`);
    
    console.log('\n🎉 All basic contact operations successful!');
    console.log('\n✅ Verified Features:');
    console.log('• API connectivity');
    console.log('• Organization creation'); 
    console.log('• Contact creation');
    console.log('• Contact retrieval');
    console.log('• Contact listing');
    console.log('• Contact updates');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error(`HTTP Status: ${error.response.status}`);
    }
    return false;
  }
}

// Run the test
simpleContactTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });