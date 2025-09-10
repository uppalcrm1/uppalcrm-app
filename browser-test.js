// BROWSER TEST - Copy and paste this into the browser console on your marketing site
// Go to https://uppalcrmapp.netlify.app/, press F12, paste this into Console tab, press Enter

console.log('🧪 Testing form submission directly from browser...');

// Test the exact same API calls the form should make
async function testBrowserFormSubmission() {
  try {
    console.log('1️⃣ Testing account creation...');
    
    // Step 1: Account creation
    const registrationResponse = await fetch('https://uppalcrm-api.onrender.com/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        organization: {
          name: 'Browser Test Company',
          slug: 'browsertestco'
        },
        admin: {
          email: 'browsertest@example.com',
          password: 'TestPass123!',
          first_name: 'Browser',
          last_name: 'Test'
        }
      })
    });
    
    if (registrationResponse.ok) {
      const regResult = await registrationResponse.json();
      console.log('✅ Account creation successful');
      
      // Step 2: Email notification  
      console.log('2️⃣ Testing email notification...');
      const emailResponse = await fetch('https://uppalcrm-api.onrender.com/api/admin/send-lead-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          leadName: 'Browser Test',
          leadEmail: 'browsertest@example.com',
          leadCompany: 'Browser Test Company',
          leadPhone: '+1-555-999-8888',
          leadMessage: '🌐 BROWSER TEST - Form submission test from browser console!',
          organizationName: 'Browser Test Company',
          utmSource: 'browser-test'
        })
      });
      
      if (emailResponse.ok) {
        const emailResult = await emailResponse.json();
        console.log('✅ Email sent successfully:', emailResult.messageId);
        console.log('📧 Check uppalcrm1@gmail.com for "Browser Test" email');
        console.log('🎉 BROWSER TEST SUCCESSFUL - Form should work!');
      } else {
        console.error('❌ Email failed:', emailResponse.status);
        const errorText = await emailResponse.text();
        console.error('Error:', errorText);
      }
      
    } else {
      console.error('❌ Registration failed:', registrationResponse.status);
      const errorText = await registrationResponse.text();
      console.error('Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Browser test failed:', error);
  }
}

// Run the test
testBrowserFormSubmission();