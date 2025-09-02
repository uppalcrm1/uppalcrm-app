const { v4: uuidv4 } = require('uuid');

// Generate unique identifiers for test data
const generateUnique = (prefix = 'test') => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

// Organization fixtures
const organizationFixtures = {
  validOrganization: () => ({
    name: `Test Organization ${generateUnique()}`,
    slug: generateUnique('org').toLowerCase(),
    industry: 'technology',
    website: 'https://testorg.example.com',
    phone: '+1-555-123-4567',
    address: {
      street: '123 Test Street',
      city: 'Test City',
      state: 'TS',
      postal_code: '12345',
      country: 'US'
    }
  }),

  adminUser: () => ({
    email: `admin+${generateUnique()}@testorg.com`,
    password: 'TestPassword123!',
    first_name: 'Admin',
    last_name: 'User'
  }),

  regularUser: () => ({
    email: `user+${generateUnique()}@testorg.com`,
    password: 'UserPassword123!',
    first_name: 'Test',
    last_name: 'User',
    role: 'user'
  })
};

// Contact fixtures
const contactFixtures = {
  basicContact: () => ({
    first_name: 'John',
    last_name: 'Doe',
    email: `john.doe+${generateUnique()}@example.com`,
    phone: '+1-555-987-6543',
    company: 'Acme Corporation',
    title: 'Software Engineer',
    notes: 'Basic contact for testing'
  }),

  premiumContact: () => ({
    first_name: 'Jane',
    last_name: 'Smith',
    email: `jane.smith+${generateUnique()}@example.com`,
    phone: '+1-555-123-9876',
    company: 'Premium Solutions Inc',
    title: 'Chief Technology Officer',
    software_edition: 'enterprise',
    notes: 'Premium enterprise contact'
  }),

  minimalContact: () => ({
    first_name: 'Min',
    last_name: 'Contact',
    email: `minimal+${generateUnique()}@example.com`
  }),

  corporateContact: () => ({
    first_name: 'Corporate',
    last_name: 'User',
    email: `corporate+${generateUnique()}@bigcorp.com`,
    phone: '+1-555-555-5555',
    company: 'Big Corporation Ltd',
    title: 'VP of Engineering',
    software_edition: 'professional',
    department: 'Engineering',
    notes: 'Corporate contact with multiple licenses'
  }),

  convertedLead: () => ({
    first_name: 'Converted',
    last_name: 'Lead',
    email: `converted+${generateUnique()}@example.com`,
    phone: '+1-555-111-2222',
    company: 'Lead Corporation',
    title: 'Product Manager',
    software_edition: 'professional',
    lead_source: 'website',
    conversion_date: new Date().toISOString(),
    notes: 'Converted from qualified lead'
  })
};

// Lead fixtures
const leadFixtures = {
  qualifiedLead: () => ({
    first_name: 'Qualified',
    last_name: 'Lead',
    email: `qualified+${generateUnique()}@example.com`,
    phone: '+1-555-444-5555',
    company: 'Lead Company Inc',
    title: 'Decision Maker',
    status: 'qualified',
    priority: 'high',
    value: 15000,
    source: 'website',
    notes: 'Ready for conversion to contact'
  }),

  newLead: () => ({
    first_name: 'New',
    last_name: 'Prospect',
    email: `prospect+${generateUnique()}@example.com`,
    phone: '+1-555-777-8888',
    company: 'Prospect Corp',
    title: 'Manager',
    status: 'new',
    priority: 'medium',
    value: 5000,
    source: 'referral',
    notes: 'Fresh lead from referral'
  }),

  convertedLead: () => ({
    first_name: 'Already',
    last_name: 'Converted',
    email: `already+${generateUnique()}@example.com`,
    phone: '+1-555-999-0000',
    company: 'Converted Co',
    title: 'Executive',
    status: 'converted',
    priority: 'high',
    value: 25000,
    source: 'trade-show',
    notes: 'Successfully converted lead'
  })
};

// Account fixtures
const accountFixtures = {
  basicAccount: () => ({
    account_name: `Account ${generateUnique()}`,
    software_edition: 'professional',
    billing_email: `billing+${generateUnique()}@example.com`,
    billing_address: {
      street: '456 Billing Street',
      city: 'Billing City',
      state: 'BS',
      postal_code: '67890',
      country: 'US'
    },
    shipping_address: {
      street: '789 Shipping Avenue',
      city: 'Shipping City', 
      state: 'SS',
      postal_code: '54321',
      country: 'US'
    },
    notes: 'Basic account for testing'
  }),

  enterpriseAccount: () => ({
    account_name: `Enterprise Account ${generateUnique()}`,
    software_edition: 'enterprise',
    billing_email: `enterprise+${generateUnique()}@bigcorp.com`,
    billing_contact: 'Enterprise Billing Department',
    billing_phone: '+1-555-enterprise',
    billing_address: {
      street: '100 Enterprise Plaza',
      suite: 'Suite 1000',
      city: 'Enterprise City',
      state: 'EC',
      postal_code: '11111',
      country: 'US'
    },
    shipping_address: {
      street: '200 Shipping Complex',
      suite: 'Building A',
      city: 'Distribution City',
      state: 'DC', 
      postal_code: '22222',
      country: 'US'
    },
    purchase_order: `PO-${generateUnique()}`,
    tax_id: `TAX-${generateUnique()}`,
    notes: 'Enterprise account with complex requirements'
  }),

  minimalAccount: () => ({
    account_name: `Minimal Account ${generateUnique()}`,
    software_edition: 'basic'
  })
};

// Device fixtures
const deviceFixtures = {
  // Valid MAC address formats
  validDevices: () => [
    {
      device_name: 'Windows Workstation 1',
      mac_address: '00:1B:44:11:3A:B7',
      hardware_info: 'Dell OptiPlex 7090, Intel i7-11700, 16GB RAM',
      os_version: 'Windows 11 Pro',
      cpu_info: 'Intel Core i7-11700 @ 2.50GHz',
      memory_info: '16GB DDR4',
      disk_info: '512GB SSD',
      notes: 'Primary development workstation'
    },
    {
      device_name: 'MacBook Pro',
      mac_address: '00-1B-44-11-3A-B8',
      hardware_info: 'MacBook Pro 16-inch, M1 Pro, 32GB RAM',
      os_version: 'macOS Ventura 13.4',
      cpu_info: 'Apple M1 Pro',
      memory_info: '32GB Unified Memory',
      disk_info: '1TB SSD',
      notes: 'Executive laptop'
    },
    {
      device_name: 'Linux Server',
      mac_address: '001B44113AB9',
      hardware_info: 'HP ProLiant DL380 Gen10',
      os_version: 'Ubuntu 22.04 LTS',
      cpu_info: 'Intel Xeon Gold 6248R @ 3.00GHz',
      memory_info: '64GB ECC RAM',
      disk_info: '2TB RAID 1 SSD',
      notes: 'Production server'
    },
    {
      device_name: 'Test Device',
      mac_address: '00:1b:44:11:3a:ba', // lowercase
      hardware_info: 'Generic test hardware',
      os_version: 'Test OS 1.0',
      notes: 'Device for testing MAC normalization'
    }
  ],

  // Invalid MAC addresses for validation testing
  invalidMACDevices: () => [
    {
      device_name: 'Invalid Format 1',
      mac_address: 'invalid-mac-format',
      hardware_info: 'Should fail validation'
    },
    {
      device_name: 'Too Short',
      mac_address: '00:1B:44:11:3A',
      hardware_info: 'MAC address too short'
    },
    {
      device_name: 'Too Long', 
      mac_address: '00:1B:44:11:3A:B7:FF',
      hardware_info: 'MAC address too long'
    },
    {
      device_name: 'Invalid Character',
      mac_address: '00:1G:44:11:3A:B7',
      hardware_info: 'Contains invalid hex character G'
    },
    {
      device_name: 'Invalid Hex',
      mac_address: '00:1B:44:11:3A:GG',
      hardware_info: 'Contains invalid hex characters GG'
    }
  ],

  mobileDevice: () => ({
    device_name: 'iPhone 14 Pro',
    mac_address: '02:1B:44:11:3A:C1',
    hardware_info: 'iPhone 14 Pro, 256GB',
    os_version: 'iOS 16.5',
    cpu_info: 'Apple A16 Bionic',
    memory_info: '6GB RAM',
    disk_info: '256GB',
    device_type: 'mobile',
    notes: 'Mobile device for field testing'
  }),

  iotDevice: () => ({
    device_name: 'IoT Sensor Hub',
    mac_address: '02:1B:44:11:3A:C2',
    hardware_info: 'Raspberry Pi 4, Custom IoT Board',
    os_version: 'Raspbian OS',
    cpu_info: 'ARM Cortex-A72',
    memory_info: '4GB RAM',
    disk_info: '32GB microSD',
    device_type: 'iot',
    notes: 'IoT device for sensor data collection'
  })
};

// License fixtures
const licenseFixtures = {
  basicLicense: () => ({
    software_edition: 'basic',
    license_type: 'full',
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    max_devices: 1,
    features: ['basic_features', 'email_support'],
    notes: 'Basic single-device license'
  }),

  professionalLicense: () => ({
    software_edition: 'professional',
    license_type: 'full',
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    max_devices: 5,
    features: ['advanced_analytics', 'api_access', 'priority_support', 'custom_reports'],
    metadata: {
      purchase_date: new Date().toISOString(),
      purchase_order: `PO-${generateUnique()}`,
      price_paid: 999.00
    },
    notes: 'Professional multi-device license'
  }),

  enterpriseLicense: () => ({
    software_edition: 'enterprise',
    license_type: 'full',
    expires_at: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 2 years
    max_devices: 25,
    features: ['all_features', 'premium_support', 'custom_integration', 'dedicated_manager'],
    metadata: {
      purchase_date: new Date().toISOString(),
      purchase_order: `PO-${generateUnique()}`,
      price_paid: 4999.00,
      contract_number: `CONTRACT-${generateUnique()}`
    },
    notes: 'Enterprise license with premium support'
  }),

  expiredLicense: () => ({
    software_edition: 'professional',
    license_type: 'full',
    expires_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    max_devices: 3,
    features: ['advanced_analytics', 'api_access'],
    notes: 'Expired license for testing'
  }),

  nearExpiryLicense: () => ({
    software_edition: 'basic',
    license_type: 'full',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    max_devices: 1,
    features: ['basic_features'],
    notes: 'License expiring soon for testing notifications'
  })
};

// Trial fixtures
const trialFixtures = {
  standardTrial: () => ({
    software_edition: 'professional',
    trial_days: 30,
    features: ['advanced_analytics', 'api_access'],
    max_devices: 3,
    notes: 'Standard 30-day professional trial'
  }),

  extendedTrial: () => ({
    software_edition: 'enterprise',
    trial_days: 90,
    features: ['all_features', 'premium_support'],
    max_devices: 10,
    metadata: {
      sales_rep: 'John Sales',
      lead_source: 'trade_show',
      estimated_value: 10000
    },
    notes: 'Extended 90-day enterprise trial for high-value prospect'
  }),

  basicTrial: () => ({
    software_edition: 'basic',
    trial_days: 14,
    features: ['basic_features'],
    max_devices: 1,
    notes: 'Short basic trial'
  }),

  expiredTrial: () => ({
    software_edition: 'professional',
    trial_days: -1, // Creates expired trial
    features: ['advanced_analytics'],
    max_devices: 2,
    notes: 'Expired trial for testing expiration logic'
  }),

  customTrial: () => ({
    software_edition: 'professional',
    trial_days: 45,
    features: ['advanced_analytics', 'api_access', 'custom_reports'],
    max_devices: 5,
    metadata: {
      custom_features: ['beta_feature_1', 'beta_feature_2'],
      special_pricing: true
    },
    notes: 'Custom trial with special features'
  })
};

// Activity fixtures
const activityFixtures = {
  downloadActivity: () => ({
    contact_id: null, // Will be set during test
    activity_type: 'download',
    software_edition: 'professional',
    version: '2.1.0',
    platform: 'windows',
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    metadata: {
      download_size: 156789012,
      download_time: '2.34s',
      mirror_used: 'us-east-1'
    }
  }),

  activationActivity: () => ({
    contact_id: null, // Will be set during test
    activity_type: 'activation',
    license_key: null, // Will be set during test
    device_fingerprint: generateUnique('device'),
    success: true,
    ip_address: '192.168.1.101',
    metadata: {
      activation_method: 'online',
      hardware_hash: generateUnique('hw'),
      os_version: 'Windows 11 Pro'
    }
  }),

  licenseCheckActivity: () => ({
    contact_id: null,
    activity_type: 'license_check',
    license_key: null,
    device_fingerprint: generateUnique('device'),
    success: true,
    ip_address: '192.168.1.102',
    metadata: {
      check_reason: 'periodic_validation',
      features_accessed: ['api_access', 'advanced_analytics']
    }
  })
};

// Software edition fixtures
const editionFixtures = {
  basic: () => ({
    name: 'basic',
    display_name: 'Basic Edition',
    description: 'Essential features for small teams',
    price: 99.00,
    max_devices: 1,
    features: [
      'basic_features',
      'email_support',
      'standard_reports'
    ],
    limitations: {
      api_calls_per_month: 1000,
      storage_gb: 10,
      users: 5
    }
  }),

  professional: () => ({
    name: 'professional',
    display_name: 'Professional Edition',
    description: 'Advanced features for growing businesses',
    price: 299.00,
    max_devices: 5,
    features: [
      'advanced_analytics',
      'api_access',
      'priority_support',
      'custom_reports',
      'integrations'
    ],
    limitations: {
      api_calls_per_month: 10000,
      storage_gb: 100,
      users: 25
    }
  }),

  enterprise: () => ({
    name: 'enterprise',
    display_name: 'Enterprise Edition',
    description: 'Full-featured solution for large organizations',
    price: 999.00,
    max_devices: 50,
    features: [
      'all_features',
      'premium_support',
      'custom_integration',
      'dedicated_manager',
      'sla_guarantee',
      'advanced_security'
    ],
    limitations: {
      api_calls_per_month: 100000,
      storage_gb: 1000,
      users: 500
    }
  })
};

// Test data collections
const collections = {
  // Generate a complete test dataset for an organization
  generateFullTestData: () => ({
    organization: organizationFixtures.validOrganization(),
    adminUser: organizationFixtures.adminUser(),
    contacts: [
      contactFixtures.basicContact(),
      contactFixtures.premiumContact(),
      contactFixtures.corporateContact()
    ],
    leads: [
      leadFixtures.qualifiedLead(),
      leadFixtures.newLead()
    ],
    accounts: [
      accountFixtures.basicAccount(),
      accountFixtures.enterpriseAccount()
    ],
    devices: deviceFixtures.validDevices().slice(0, 3),
    licenses: [
      licenseFixtures.professionalLicense(),
      licenseFixtures.enterpriseLicense()
    ],
    trials: [
      trialFixtures.standardTrial(),
      trialFixtures.extendedTrial()
    ]
  }),

  // Generate minimal test dataset
  generateMinimalTestData: () => ({
    organization: organizationFixtures.validOrganization(),
    adminUser: organizationFixtures.adminUser(),
    contacts: [contactFixtures.minimalContact()],
    licenses: [licenseFixtures.basicLicense()],
    trials: [trialFixtures.basicTrial()]
  }),

  // Generate test data for multi-tenant testing
  generateMultiTenantTestData: () => ([
    {
      organization: organizationFixtures.validOrganization(),
      adminUser: organizationFixtures.adminUser(),
      contacts: [contactFixtures.basicContact()],
      licenses: [licenseFixtures.professionalLicense()]
    },
    {
      organization: organizationFixtures.validOrganization(),
      adminUser: organizationFixtures.adminUser(),
      contacts: [contactFixtures.premiumContact()],
      licenses: [licenseFixtures.enterpriseLicense()]
    }
  ])
};

module.exports = {
  generateUnique,
  organizationFixtures,
  contactFixtures,
  leadFixtures,
  accountFixtures,
  deviceFixtures,
  licenseFixtures,
  trialFixtures,
  activityFixtures,
  editionFixtures,
  collections
};