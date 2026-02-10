# MAC Address Multi-Portal Search Implementation Guide

## Overview

This system allows organizations to search for MAC addresses across multiple billing portals (currently supporting Ditto billing and similar platforms) with org-level configuration control.

## Architecture

```
┌─────────────┐
│  Frontend   │ MacAddressSearch.jsx (React component)
│  Dashboard  │ MacSearchSettings.jsx (Admin settings)
└──────┬──────┘
       │
       │ REST API
       ▼
┌─────────────────────┐
│  Backend API        │
│  /api/mac-search/*  │
└──────┬──────────────┘
       │
       ▼
┌──────────────────────────────┐
│  MacAddressSearchService     │
│  (Playwright automation)     │
└──────┬───────────────────────┘
       │
       ├─► Portal 1 (Ditto)
       ├─► Portal 2 (Other)
       └─► Portal N
```

## Files Created

### Backend Files

1. **`backend/config/billingPortals.example.js`**
   - Portal configuration template
   - Define portal URLs, paths, and table selectors
   - Copy to `billingPortals.js` and customize

2. **`backend/services/macAddressSearchService.js`**
   - Core service for searching across portals
   - Uses Playwright for browser automation
   - Handles login, navigation, and data extraction

3. **`backend/routes/macSearch.js`**
   - REST API endpoints
   - Search endpoints, history, portal management
   - Authentication and authorization

4. **`backend/migrations/mac-search-tables.sql`**
   - Database schema for credentials and history
   - Encryption support for credentials
   - Row-level security policies

### Frontend Files

1. **`frontend/src/pages/MacAddressSearch.jsx`**
   - Main search UI dashboard
   - Search form, results display, history tab
   - CSV export functionality

2. **`frontend/src/components/admin/MacSearchSettings.jsx`**
   - Admin settings panel
   - Enable/disable feature per org
   - Credential management

## Setup Instructions

### Step 1: Database Setup

Run the migration to create necessary tables:

```bash
psql -U postgres -d your_database -f backend/migrations/mac-search-tables.sql
```

Or if using Supabase:
1. Go to SQL Editor
2. Create new query
3. Copy contents of `mac-search-tables.sql`
4. Run query

### Step 2: Backend Configuration

1. Copy portal configuration:
```bash
cp backend/config/billingPortals.example.js backend/config/billingPortals.js
```

2. Edit `backend/config/billingPortals.js`:
```javascript
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
        macColumn: 1,      // Column index for MAC
        nameColumn: 2,     // Column index for name
        statusColumn: 4,   // Column index for status
        expiryColumn: 5,   // Column index for expiry date
      },
      timeout: 30000,
    },
    // Add more portals as needed
  ],
}
```

3. Set encryption key in `.env`:
```
ENCRYPTION_KEY=your-secure-random-key-here
```

### Step 3: API Route Integration

Add to `backend/server.js`:

```javascript
const macSearchRoutes = require('./routes/macSearch')

// Add before other routes
app.use('/api/mac-search', macSearchRoutes)
```

### Step 4: Frontend Integration

Add page to your routing:

```javascript
// In your router configuration
import MacAddressSearch from './pages/MacAddressSearch'
import MacSearchSettings from './components/admin/MacSearchSettings'

// Add route
{
  path: '/mac-search',
  element: <MacAddressSearch />,
  requiredRole: 'user' // or higher
},
{
  path: '/admin/mac-search-settings',
  element: <MacSearchSettings />,
  requiredRole: 'admin'
}
```

Add navigation links in your app:

```jsx
// In navigation menu
<li>
  <Link to="/mac-search">
    <Search size={18} />
    MAC Address Search
  </Link>
</li>

// In admin menu (for admins only)
<li>
  <Link to="/admin/mac-search-settings">
    <Settings size={18} />
    MAC Search Settings
  </Link>
</li>
```

### Step 5: Install Dependencies

Ensure Playwright is installed:

```bash
npm install playwright
npx playwright install chromium
```

### Step 6: Enable Feature for Organizations

For each organization that should have MAC search:

```sql
UPDATE organizations
SET mac_search_enabled = true
WHERE id = 'your-org-id';
```

Or through the admin UI after deploying.

## Usage

### For End Users

1. Navigate to **MAC Address Search**
2. Enter a MAC address (format: `00:1A:79:B2:5A:58`)
3. Click **Search**
4. Results show:
   - Portal Name
   - Account Name
   - MAC Address
   - Status (Active/Disabled)
   - Expiry Date
5. Click **Export CSV** to download results

### For Administrators

1. Go to **Settings** > **MAC Search Settings**
2. Toggle **Enable MAC Search Feature** for the organization
3. Configure credentials for each portal:
   - Enter portal username
   - Enter portal password (encrypted)
   - Click **Save Credentials**
4. Credentials are securely stored and encrypted in the database

## API Endpoints

### Search Endpoints

#### POST `/api/mac-search/search`
Search for a MAC address across all configured portals (blocking)

**Request:**
```json
{
  "macAddress": "00:1A:79:B2:5A:58"
}
```

**Response:**
```json
{
  "macAddress": "00:1A:79:B2:5A:58",
  "searchStarted": "2026-02-06T12:00:00Z",
  "searchCompleted": "2026-02-06T12:00:30Z",
  "status": "completed",
  "totalFound": 1,
  "portalResults": [
    {
      "portalId": "ditto-billing-1",
      "portalName": "Ditto Billing Portal",
      "found": true,
      "results": [
        {
          "macAddress": "00:1A:79:B2:5A:58",
          "accountName": "manjit",
          "status": "Active",
          "expiryDate": "2026-03-06"
        }
      ]
    }
  ]
}
```

#### POST `/api/mac-search/quick`
Start background search (returns search ID for polling)

#### GET `/api/mac-search/results/:searchId`
Get results of a background search

#### GET `/api/mac-search/history`
Get search history for organization

**Query Parameters:**
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

#### GET `/api/mac-search/portals`
Get list of available portals and their configuration status

#### POST `/api/mac-search/portal-credentials`
Save/update portal credentials

**Request:**
```json
{
  "portalId": "ditto-billing-1",
  "username": "sky711",
  "password": "Toronto2025@"
}
```

## Configuration Examples

### Example 1: Ditto Billing Portal

```javascript
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
    macColumn: 1,
    nameColumn: 2,
    statusColumn: 4,
    expiryColumn: 5,
  },
  timeout: 30000,
}
```

### Example 2: Custom Portal with Different Table Structure

```javascript
{
  id: 'custom-portal-1',
  name: 'Custom Billing System',
  url: 'https://billing.custom.com',
  loginPath: '/admin/login',
  usersListPath: '/admin/accounts',
  enabled: true,
  searchType: 'table',
  tableConfig: {
    rowSelector: 'table tbody tr',
    macColumn: 0,      // First column
    nameColumn: 1,     // Second column
    statusColumn: 3,   // Fourth column
    expiryColumn: 4,   // Fifth column
  },
  timeout: 20000,
}
```

## Troubleshooting

### Search Times Out
- Increase `timeout` in portal config
- Check portal URL is accessible
- Verify credentials are correct

### MAC Address Not Found
- Check MAC address format (use colons: `00:1A:79:B2:5A:58`)
- Verify credentials are configured for the portal
- Check portal table structure matches configuration

### Credentials Not Saved
- Verify encryption key is set in `.env`
- Check database connection and permissions
- Ensure user has admin role

### Password Decryption Fails
- Verify `ENCRYPTION_KEY` matches the one used for encryption
- Check database password field is not corrupted
- Try re-entering credentials

## Security Considerations

1. **Credentials Encryption**
   - Passwords are encrypted using AES-256-CBC
   - Encryption key stored in `.env` (never in code)
   - Only admins can manage credentials

2. **Row-Level Security**
   - Users can only search within their organization
   - Search history is organization-specific
   - Credentials are isolated per organization

3. **Audit Trail**
   - All searches logged in `mac_search_history`
   - Includes MAC address, results, timestamp
   - No password exposure in logs

4. **Best Practices**
   - Use strong, unique passwords for portal accounts
   - Regularly rotate portal credentials
   - Monitor search history for suspicious activity
   - Limit admin access to settings

## Performance Optimization

1. **Parallel Portal Searching**
   - Searches across portals run in parallel
   - Overall time = longest individual portal search
   - Typical search time: 5-30 seconds

2. **Caching**
   - Consider implementing Redis for frequently searched MACs
   - Cache portal credentials to avoid DB queries

3. **Timeout Configuration**
   - Set timeouts per portal based on responsiveness
   - Default: 30 seconds
   - Can adjust in `billingPortals.js`

## Future Enhancements

- [ ] Add webhook support for real-time search notifications
- [ ] Implement scheduled searches (daily/weekly reports)
- [ ] Add more portal types (API-based, form-based)
- [ ] Bulk MAC address search (CSV upload)
- [ ] Search result notifications via email/Slack
- [ ] Advanced filtering and reporting
- [ ] Two-factor authentication support for portals

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review test results in `frontend/tests/ditto-mac-users.spec.js`
3. Check server logs for detailed error messages
4. Contact system administrator

## License

Same as main project license.
