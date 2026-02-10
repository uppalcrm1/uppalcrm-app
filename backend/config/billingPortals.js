/**
 * Billing Portals Configuration
 * Configured for devtest environment
 */

module.exports = {
  portals: [
    {
      id: 'fast4k-users-1',
      name: 'Fast4K Users Portal',
      url: 'https://fast4k.cc',
      loginPath: '/login',
      usersListPath: '/dealer/users/index',
      enabled: true,
      searchType: 'table',
      tableConfig: {
        rowSelector: 'tr, [role="row"]',
        macColumn: 2,      // Column index for MAC address (correct position)
        nameColumn: 3,     // Column index for account name
        statusColumn: 4,   // Column index for status
        expiryColumn: 5,   // Column index for expiry date
      },
      timeout: 30000,
    },
  ],
}
