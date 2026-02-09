/**
 * Billing Portals Configuration
 * Configured for devtest environment
 */

module.exports = {
  portals: [
    {
      id: 'ditto-billing-1',
      name: 'Ditto Billing Portal',
      url: 'https://billing.dittotvv.cc',
      loginPath: '/login',
      usersListPath: '/dealer/users',
      enabled: true,
      searchType: 'table',
      tableConfig: {
        rowSelector: 'tr, [role="row"]',
        macColumn: 1,      // Column index for MAC address
        nameColumn: 2,     // Column index for account name
        statusColumn: 4,   // Column index for status
        expiryColumn: 5,   // Column index for expiry date
      },
      timeout: 30000,
    },

    // TEMPLATE FOR SECOND PORTAL - UNCOMMENT AND FILL IN YOUR DETAILS
    /*
    {
      id: 'second-portal-id',
      name: 'Second Portal Name',
      url: 'https://billing.secondportal.com',
      loginPath: '/login',
      usersListPath: '/devices',  // or wherever devices/MACs are listed
      enabled: true,
      searchType: 'table',
      tableConfig: {
        rowSelector: 'tr, [role="row"]',
        macColumn: 1,      // Adjust based on your table structure
        nameColumn: 2,
        statusColumn: 4,
        expiryColumn: 5,
      },
      timeout: 30000,
    },
    */

    // TEMPLATE FOR THIRD PORTAL
    /*
    {
      id: 'third-portal-id',
      name: 'Third Portal Name',
      url: 'https://billing.thirdportal.com',
      loginPath: '/signin',
      usersListPath: '/accounts',
      enabled: true,
      searchType: 'table',
      tableConfig: {
        rowSelector: 'tr, [role="row"]',
        macColumn: 0,
        nameColumn: 1,
        statusColumn: 3,
        expiryColumn: 4,
      },
      timeout: 30000,
    },
    */
  ],
}
