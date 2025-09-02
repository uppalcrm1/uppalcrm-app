# Contact Management System - Test Suite

This directory contains comprehensive tests for the Contact Management System, ensuring all features work correctly with proper multi-tenant isolation and data validation.

## 📁 Test Structure

```
test/
├── contacts.test.js          # Main contact system tests
├── fixtures/
│   └── index.js             # Test data fixtures and generators
├── helpers/
│   └── testUtils.js         # Test utilities and helper functions
├── runTests.js              # Test runner with reporting
└── README.md                # This documentation
```

## 🧪 Test Coverage

### Core Features Tested

#### 1. Contact CRUD Operations (`testContactCRUD`)
- ✅ Create contacts with validation
- ✅ Retrieve individual contacts
- ✅ Update contact information
- ✅ List contacts with pagination
- ✅ Contact statistics and reporting

#### 2. Lead-to-Contact Conversion (`testLeadToContactConversion`)
- ✅ Convert qualified leads to contacts
- ✅ Preserve lead data during conversion
- ✅ Update lead status after conversion
- ✅ Handle conversion workflow end-to-end

#### 3. MAC Address Validation (`testMACAddressValidation`)
- ✅ Valid MAC address formats (XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX, XXXXXXXXXXXX)
- ✅ MAC address normalization (uppercase, formatted)
- ✅ Invalid MAC address rejection
- ✅ Duplicate MAC address detection
- ✅ Device registration with MAC validation

#### 4. License Generation (`testLicenseGeneration`)
- ✅ Generate unique license keys
- ✅ License key format validation
- ✅ Multiple license generation (uniqueness check)
- ✅ License transfer between contacts
- ✅ License expiration handling

#### 5. Trial Management (`testTrialManagement`)
- ✅ Create standard trials (30, 90 days)
- ✅ Trial expiration logic
- ✅ Active vs expired trial filtering
- ✅ Trial license key generation
- ✅ Trial feature limitations

#### 6. Multi-Tenant Isolation (`testMultiTenantIsolation`)
- ✅ Contact data isolation between organizations
- ✅ Cross-organization access prevention
- ✅ Isolated contact lists
- ✅ License key uniqueness across tenants
- ✅ Statistics isolation

## 🚀 Running Tests

### Prerequisites
1. Ensure the server is running:
   ```bash
   npm run dev
   # or
   npm start
   ```

2. Database should be migrated and accessible

### Test Commands

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:contacts

# Run with verbose output
npm run test:verbose

# Run in test environment
npm run test:dev

# Run contacts tests directly (bypass runner)
npm run test:contacts-only
```

### Command Line Options

```bash
# Show help
npm test -- --help

# Run with verbose logging
npm test -- --verbose

# Run specific test suite
npm test contacts
```

## 📊 Test Results

The test suite provides comprehensive reporting:

### Success Output
```
🎉 All tests passed! Contact management system is working perfectly!

✨ Key Features Verified:
• Complete CRUD operations for contacts
• Seamless lead-to-contact conversion workflow  
• Robust MAC address validation and device registration
• Secure license generation with unique keys
• Flexible trial creation and expiration management
• Perfect multi-tenant data isolation
```

### Failure Output
```
💥 2 test(s) failed across 1 test suite(s).

🔧 Next Steps:
1. Review the failed test details above
2. Check server logs for any errors
3. Verify database schema and migrations
4. Run individual test suites for debugging
```

## 🏗️ Test Architecture

### Test Organization
- Each major feature has its own test function
- Tests are organized by functionality, not by endpoint
- Multi-tenant isolation is tested across all features
- Real API calls are made (integration testing approach)

### Data Management
- Each test creates its own isolated organization
- Unique test data generated for each run
- No shared state between tests
- Cleanup handled automatically

### Assertion Patterns
```javascript
// Using custom assertions
TestAssertions.assertEqual(actual, expected, 'Custom error message');
TestAssertions.assertValidEmail(email);
TestAssertions.assertValidMAC(macAddress);
TestAssertions.assertValidLicenseKey(licenseKey);
```

## 🔧 Test Utilities

### TestAuthHelper
Manages test organization creation and authentication:
```javascript
const authHelper = new TestAuthHelper();
const auth = await authHelper.createTestOrganization();
const headers = authHelper.getHeaders(orgId);
```

### TestDataHelper  
Provides convenient methods for creating test data:
```javascript
const dataHelper = new TestDataHelper(authHelper);
const contact = await dataHelper.createContact(orgId, contactData);
const license = await dataHelper.generateLicense(orgId, contactId, licenseData);
```

### MACAddressValidator
Validates and normalizes MAC addresses:
```javascript
MACAddressValidator.isValid('00:1B:44:11:3A:B7'); // true
MACAddressValidator.normalize('00-1B-44-11-3A-B7'); // '001B44113AB7'
MACAddressValidator.format('001B44113AB7'); // '00:1B:44:11:3A:B7'
```

## 📋 Test Fixtures

Pre-built test data available in `fixtures/index.js`:

### Organizations
- `organizationFixtures.validOrganization()`
- `organizationFixtures.adminUser()`

### Contacts
- `contactFixtures.basicContact()`
- `contactFixtures.premiumContact()`
- `contactFixtures.corporateContact()`

### Devices
- `deviceFixtures.validDevices()` - Array of valid MAC addresses
- `deviceFixtures.invalidMACDevices()` - Array for validation testing

### Licenses  
- `licenseFixtures.basicLicense()`
- `licenseFixtures.professionalLicense()`
- `licenseFixtures.enterpriseLicense()`
- `licenseFixtures.expiredLicense()`

### Trials
- `trialFixtures.standardTrial()` (30 days)
- `trialFixtures.extendedTrial()` (90 days)
- `trialFixtures.expiredTrial()` (for testing expiration)

## 🔒 Security Testing

### Multi-Tenant Isolation
- Verifies contacts from Org A cannot be accessed by Org B
- Tests license key uniqueness across organizations
- Validates statistics are properly isolated
- Confirms no data leakage between tenants

### Input Validation
- MAC address format validation
- Email format validation
- Required field validation
- Data type validation

### Authentication
- JWT token validation
- Organization slug verification
- Unauthorized access prevention

## 🐛 Debugging Tests

### Common Issues

1. **Server Not Running**
   ```
   ❌ Server not available at http://localhost:3000/api
   ```
   **Solution:** Start the server with `npm run dev`

2. **Database Connection Issues**
   ```
   ❌ Database connectivity check failed
   ```
   **Solution:** Check database connection and run migrations

3. **Port Conflicts**
   **Solution:** Set `API_URL` environment variable to correct port

### Verbose Logging
Run tests with verbose logging to see detailed output:
```bash
npm run test:verbose
```

### Individual Test Functions
You can import and run individual test functions for debugging:
```javascript
const { testContactCRUD } = require('./test/contacts.test.js');
testContactCRUD().then(console.log).catch(console.error);
```

## 📈 Performance Considerations

### Test Execution Time
- Each test suite creates fresh organizations (isolation)
- Database operations may be slower in test environment  
- Network latency affects API call duration
- Typical run time: 30-60 seconds for full suite

### Optimization
- Tests run sequentially to avoid database conflicts
- Shared utilities reduce code duplication
- Fixtures provide consistent test data
- Cleanup is automatic (no manual intervention needed)

## 🔮 Future Enhancements

### Planned Additions
- [ ] Performance/load testing for high-volume scenarios
- [ ] Browser automation tests for frontend components  
- [ ] API response time benchmarking
- [ ] Database schema validation tests
- [ ] Email notification testing (mock SMTP)
- [ ] File upload/download testing
- [ ] Webhook testing for integrations

### Test Data Improvements
- [ ] Realistic data generators (faker.js integration)
- [ ] Edge case generators (boundary testing)
- [ ] Historical test data for migration testing
- [ ] Batch operation testing

## 📞 Support

For test-related issues:
1. Check server logs for errors
2. Verify database schema is up to date
3. Run individual test functions for isolation
4. Check environment variable configuration
5. Ensure all dependencies are installed

The test suite is designed to be comprehensive, reliable, and maintainable. It serves both as validation for the contact management system and as documentation for expected system behavior.