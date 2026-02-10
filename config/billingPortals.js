/**
 * Billing Portals Configuration
 * Configured for devtest environment
 */

module.exports = {
  portals: [
    // ✅ FAST4K PORTAL - CONFIGURED 2026-02-09
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
        macColumn: 1,      // MAC ADDRESS column
        nameColumn: 2,     // Name column
        statusColumn: 3,   // Status column
        expiryColumn: 4,   // Expiry column
      },
      timeout: 30000,
    },

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
