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
    // Add more portals as needed
  ],
}
