// Simple Supabase verification
const https = require('https');
const { URL } = require('url');

// Extract project details from your connection string
const connectionString = 'postgresql://postgres:Beautifulmind611$@db.smzamnifaboqkjulrtqj.supabase.co:5432/postgres';
const url = new URL(connectionString);

console.log('🔍 Supabase Connection Verification');
console.log('=====================================');
console.log('Project Host:', url.hostname);
console.log('Project ID:', url.hostname.split('.')[1]); // Extract project ID
console.log('');

// Try to connect to Supabase API endpoint
const projectId = url.hostname.split('.')[1];
const apiUrl = `https://${projectId}.supabase.co`;

console.log(`Testing Supabase API at: ${apiUrl}`);

const req = https.get(apiUrl, { timeout: 10000 }, (res) => {
  console.log('✅ Supabase API Response Status:', res.statusCode);
  console.log('✅ Your Supabase project is active and reachable');
  
  if (res.statusCode === 200) {
    console.log('');
    console.log('🎉 Supabase project is working!');
    console.log('The issue is likely with PostgreSQL connection, not the project itself.');
    console.log('');
    console.log('Possible solutions:');
    console.log('1. Check if your IP is allowlisted in Supabase');
    console.log('2. Verify the database password is correct');
    console.log('3. Try connecting from Supabase dashboard directly');
    console.log('4. Check if connection pooling is enabled');
  }
}).on('error', (err) => {
  console.error('❌ Supabase API not reachable:', err.message);
  console.log('');
  console.log('This suggests your Supabase project might not be active or the project ID is incorrect.');
  console.log('Please check:');
  console.log('1. Your Supabase dashboard');
  console.log('2. The project reference ID in your connection string');
}).on('timeout', () => {
  console.error('❌ Connection to Supabase API timed out');
  req.destroy();
});

req.setTimeout(10000);

// Also test the database host specifically
console.log('\nTesting database host connectivity...');

const dbReq = https.get(`https://${url.hostname}`, { timeout: 5000 }, (res) => {
  console.log('✅ Database host is reachable');
}).on('error', (err) => {
  if (err.code === 'ENOTFOUND') {
    console.error('❌ Database hostname not found');
    console.log('The hostname in your connection string appears to be incorrect.');
    console.log('Please verify the exact connection string from your Supabase dashboard.');
  } else {
    console.error('❌ Database host error:', err.message);
  }
}).on('timeout', () => {
  console.error('❌ Database host connection timed out');
  dbReq.destroy();
});

dbReq.setTimeout(5000);