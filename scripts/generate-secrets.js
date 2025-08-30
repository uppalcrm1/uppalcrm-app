const crypto = require('crypto');

/**
 * Generate secure secrets for JWT tokens
 * Run with: node scripts/generate-secrets.js
 */

console.log('🔐 Generating secure secrets for UppalCRM production deployment\n');

console.log('JWT_SECRET=');
console.log(crypto.randomBytes(32).toString('hex'));
console.log('\nJWT_REFRESH_SECRET=');
console.log(crypto.randomBytes(32).toString('hex'));

console.log('\n💡 Copy these values to your Render environment variables:');
console.log('- JWT_SECRET: Use the first generated value');
console.log('- JWT_REFRESH_SECRET: Use the second generated value');
console.log('\n⚠️  Keep these secrets secure and never commit them to your repository!');