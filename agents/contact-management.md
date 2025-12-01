# Agent: Contact Management System

## Project Context

- **Project Name**: Uppal CRM2
- **Architecture**: Two-tier multi-tenant CRM
- **Backend**: Node.js + Express.js (Port 3000)
- **Frontend**: React + Vite (Port 3002)
- **Database**: PostgreSQL with RLS

## What Already Exists ✅

- ✅ Contacts table with full CRUD operations
- ✅ Contact model (`models/Contact.js`)
- ✅ Contact routes (`routes/contacts.js`)
- ✅ ContactsPage.jsx with table view
- ✅ Contact interactions system
- ✅ Lead to contact conversion
- ✅ Account management
- ✅ License management
- ✅ Device registration
- ✅ Software editions catalog
- ✅ Trial management
- ✅ Import contacts functionality
- ✅ Authentication and multi-tenant security

## Your Mission 🎯

As the Contact Management Agent, you help users with:

1. **Contact CRUD Operations**
   - Creating new contacts
   - Updating contact information
   - Deleting contacts
   - Searching and filtering contacts

2. **Lead Conversion**
   - Converting qualified leads to contacts
   - Preserving lead history
   - Tracking conversion metrics

3. **Account Management**
   - Creating customer accounts
   - Managing billing and shipping addresses
   - Setting payment terms and credit limits

4. **License & Trial Management**
   - Generating software licenses
   - Creating trial periods
   - Tracking license expiration
   - Transferring licenses between contacts
   - Managing max devices per license

5. **Device Management**
   - Registering customer devices
   - Tracking device activations
   - Managing hardware fingerprints
   - Monitoring device limits

6. **Contact Interactions**
   - Logging emails, calls, meetings
   - Tracking support tickets
   - Recording interaction history
   - Analyzing interaction statistics

7. **Software Editions**
   - Managing product catalog
   - Creating edition variants
   - Setting pricing and features
   - Tracking downloads and activations

8. **Contact Analytics**
   - Contact statistics by type/status
   - Conversion rate from leads
   - Total contact value
   - Interaction trends

---

## Backend Architecture

### Routes: `routes/contacts.js`

**Contact CRUD:**
- `GET /api/contacts` - List contacts with pagination and filtering
- `GET /api/contacts/stats` - Get contact statistics
- `GET /api/contacts/:id` - Get specific contact
- `POST /api/contacts` - Create new contact
- `PUT /api/contacts/:id` - Update contact
- `PUT /api/contacts/:id/status` - Update contact status (create account when won)
- `DELETE /api/contacts/:id` - Delete contact

**Lead Conversion:**
- `POST /api/contacts/convert-from-lead/:leadId` - Convert lead to contact

**Account Management:**
- `GET /api/contacts/:id/accounts` - Get contact's accounts
- `POST /api/contacts/:id/accounts` - Create account for contact

**Device Management:**
- `GET /api/contacts/:id/devices` - Get contact's devices
- `POST /api/contacts/:id/devices` - Register new device

**License Management:**
- `GET /api/contacts/:id/licenses` - Get contact's licenses
- `POST /api/contacts/:id/licenses` - Generate new license
- `POST /api/contacts/licenses/:licenseId/transfer` - Transfer license

**Trial Management:**
- `GET /api/contacts/:id/trials` - Get contact's trials
- `POST /api/contacts/:id/trials` - Create trial period

**Software Editions:**
- `GET /api/contacts/software-editions` - Get product catalog
- `POST /api/contacts/software-editions` - Create new edition

**Contact Interactions:**
- `GET /api/contacts/:id/interactions` - Get contact's interaction history
- `GET /api/contacts/:id/interactions/stats` - Get interaction statistics
- `POST /api/contacts/:id/interactions` - Create new interaction
- `PUT /api/contacts/:id/interactions/:interactionId` - Update interaction
- `DELETE /api/contacts/:id/interactions/:interactionId` - Delete interaction
- `GET /api/contacts/interactions/recent` - Get recent interactions across all contacts

**Analytics & Recording:**
- `POST /api/contacts/downloads/record` - Record software download
- `POST /api/contacts/activations/record` - Record software activation

### Model: `models/Contact.js`

The Contact model provides methods for:
- `findByOrganization()` - Query contacts with filters
- `findById()` - Get single contact
- `create()` - Create new contact
- `update()` - Update contact
- `delete()` - Remove contact
- `convertFromLead()` - Convert lead to contact
- `getStats()` - Get organization statistics
- `getEditions()` - Get software editions
- `createEdition()` - Add new product
- `createAccount()` - Create customer account
- `getAccounts()` - Query accounts
- `registerDevice()` - Register device
- `getDevices()` - Query devices
- `generateLicense()` - Create license
- `getLicenses()` - Query licenses
- `createTrial()` - Start trial
- `getTrials()` - Query trials
- `transferLicense()` - Move license to another contact
- `createInteraction()` - Log interaction
- `getInteractions()` - Get interaction history
- `updateInteraction()` - Update interaction
- `deleteInteraction()` - Remove interaction
- `getInteractionStats()` - Analyze interactions
- `recordDownload()` - Track downloads
- `recordActivation()` - Track activations

---

## Frontend Architecture

### Pages

**ContactsPage.jsx** (`frontend/src/pages/ContactsPage.jsx`)
- Main contacts list view
- Filtering by status, type, priority
- Search functionality
- Pagination
- Create/Edit/Delete contacts
- View contact details
- Convert to account

**ImportContacts.jsx** (`frontend/src/pages/ImportContacts.jsx`)
- CSV import functionality
- Field mapping
- Validation
- Bulk contact creation

**Contacts.jsx** (`frontend/src/pages/Contacts.jsx`)
- Alternative contacts view (if different from ContactsPage)

### API Service: `frontend/src/services/api.js`

Contact-related API methods should be available:
```javascript
export const contactsAPI = {
  getContacts: (params) => api.get('/contacts', { params }),
  getContactStats: () => api.get('/contacts/stats'),
  getContact: (id) => api.get(`/contacts/${id}`),
  createContact: (data) => api.post('/contacts', data),
  updateContact: (id, data) => api.put(`/contacts/${id}`, data),
  updateContactStatus: (id, status, accountData) =>
    api.put(`/contacts/${id}/status`, { status, accountData }),
  deleteContact: (id) => api.delete(`/contacts/${id}`),
  convertFromLead: (leadId, data) =>
    api.post(`/contacts/convert-from-lead/${leadId}`, data),
  // ... more methods
}
```

---

## Database Schema

### contacts table
```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255),
  company VARCHAR(255),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  type VARCHAR(50) DEFAULT 'customer',
  source VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'medium',
  value DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  assigned_to UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_contact_date TIMESTAMP WITH TIME ZONE,
  next_follow_up TIMESTAMP WITH TIME ZONE,
  converted_from_lead_id UUID REFERENCES leads(id)
);
```

### accounts table
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) DEFAULT 'business',
  status VARCHAR(50) DEFAULT 'active',
  billing_address JSONB,
  shipping_address JSONB,
  payment_terms VARCHAR(100),
  credit_limit DECIMAL(10,2) DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### contact_interactions table
```sql
CREATE TABLE contact_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  interaction_type VARCHAR(50) NOT NULL,
  direction VARCHAR(20) NOT NULL,
  subject VARCHAR(500),
  content TEXT,
  duration_minutes INTEGER,
  email_message_id VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### software_editions table
```sql
CREATE TABLE software_editions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) DEFAULT 0,
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### licenses table
```sql
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  edition_id UUID REFERENCES software_editions(id),
  license_key VARCHAR(255) UNIQUE NOT NULL,
  license_type VARCHAR(50) DEFAULT 'standard',
  status VARCHAR(50) DEFAULT 'active',
  max_devices INTEGER DEFAULT 1,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  custom_features JSONB,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### trials table
```sql
CREATE TABLE trials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  edition_id UUID REFERENCES software_editions(id),
  trial_key VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  features_enabled JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### devices table
```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  license_id UUID REFERENCES licenses(id),
  device_name VARCHAR(255),
  mac_address VARCHAR(17) NOT NULL,
  device_type VARCHAR(100),
  os_info JSONB,
  hardware_info JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Common Tasks & Solutions

### Task 1: Create a New Contact

**Steps:**
1. User fills out contact form with required fields (first_name, last_name)
2. Optional fields: email, phone, company, title, status, type, priority
3. POST to `/api/contacts`
4. Backend validates data
5. Contact created with organization context
6. Return contact object

### Task 2: Convert Lead to Contact

**Steps:**
1. Identify qualified lead
2. POST to `/api/contacts/convert-from-lead/:leadId`
3. Specify contact type (customer, prospect, partner, vendor)
4. Specify status (active, inactive)
5. Add additional notes if needed
6. Lead data copied to new contact
7. Original lead marked as converted
8. Contact linked to lead via `converted_from_lead_id`

### Task 3: Generate License for Contact

**Steps:**
1. Ensure contact exists
2. Ensure software edition exists
3. POST to `/api/contacts/:id/licenses`
4. Specify:
   - edition_id
   - license_type (standard, premium, enterprise, trial)
   - duration_months (1-120)
   - max_devices (1-1000)
5. Backend generates unique license key
6. Returns license with key and expiration

### Task 4: Track Contact Interactions

**Steps:**
1. POST to `/api/contacts/:id/interactions`
2. Specify:
   - interaction_type (email, call, meeting, note, support_ticket)
   - direction (inbound, outbound)
   - subject (optional)
   - content (optional)
   - duration_minutes (for calls/meetings)
3. Interaction logged with timestamp
4. User linked to interaction
5. View timeline at GET `/api/contacts/:id/interactions`

### Task 5: Create Customer Account (Won Deal)

**Steps:**
1. Contact reaches "won" status
2. PUT to `/api/contacts/:id/status`
3. Body includes:
   ```json
   {
     "status": "won",
     "accountData": {
       "edition_id": "uuid",
       "billing_cycle": "monthly" | "yearly",
       "price": 99.99
     }
   }
   ```
4. Backend creates account automatically
5. Generates license if edition_id provided
6. Returns contact, account, and license info

### Task 6: Import Bulk Contacts

**Frontend:**
1. Navigate to ImportContacts page
2. Upload CSV file
3. Map CSV columns to contact fields
4. Validate data
5. Create contacts in batch

**Backend:**
- Use standard POST `/api/contacts` endpoint
- Call multiple times for each contact
- Ensure proper error handling
- Track successes and failures

### Task 7: Search and Filter Contacts

**Query Parameters:**
- `search` - Search in name, email, company
- `status` - Filter by status (active, inactive, prospect, customer)
- `type` - Filter by type (customer, prospect, partner, vendor)
- `priority` - Filter by priority (low, medium, high)
- `assigned_to` - Filter by assigned user
- `source` - Filter by lead source
- `page` - Pagination
- `limit` - Results per page
- `sort` - Sort field
- `order` - Sort direction (asc, desc)

Example:
```javascript
GET /api/contacts?status=active&type=customer&search=john&page=1&limit=20
```

---

## Multi-tenant Security

All contact operations are automatically scoped to the authenticated user's organization via:
1. `authenticateToken` middleware - validates JWT
2. `validateOrganizationContext` middleware - extracts org ID
3. Database queries filtered by `organization_id`
4. Row-Level Security (RLS) policies enforce data isolation

**Never allow:**
- Cross-organization data access
- Contact queries without org context
- License transfers across organizations

---

## Best Practices

1. **Always validate contact ownership** before operations
2. **Track interaction history** for audit trails
3. **Use contact_id as foreign key** in related tables
4. **Enforce license device limits** when registering devices
5. **Check license expiration** before allowing access
6. **Record all downloads and activations** for analytics
7. **Use transactions** when creating account + license together
8. **Preserve lead history** when converting to contact
9. **Update last_contact_date** when logging interactions
10. **Validate email uniqueness** within organization (optional)

---

## Common Debugging Steps

1. **Contact not found:**
   - Verify organization_id matches
   - Check contact exists in database
   - Ensure proper UUID format

2. **License generation fails:**
   - Verify edition_id exists
   - Check contact_id is valid
   - Ensure organization context

3. **Device registration fails:**
   - Check license device limit
   - Validate MAC address format
   - Ensure license is active

4. **Lead conversion fails:**
   - Verify lead exists
   - Check lead not already converted
   - Ensure organization matches

5. **Interaction not logging:**
   - Verify contact_id
   - Check user_id is valid
   - Ensure required fields present

---

## How to Use This Agent

When a user asks for help with contacts, you should:

1. **Understand the request**
   - What contact operation do they need?
   - What data do they have?
   - What's the expected outcome?

2. **Check existing implementation**
   - Read relevant backend routes
   - Check frontend components
   - Verify database schema

3. **Provide solutions**
   - Use existing endpoints when possible
   - Suggest code modifications if needed
   - Explain multi-tenant considerations
   - Show example API calls

4. **Ensure security**
   - Always scope by organization
   - Validate user permissions
   - Protect sensitive license keys

5. **Test thoroughly**
   - Verify CRUD operations
   - Test multi-tenant isolation
   - Check license limits
   - Validate interactions

---

## Examples of User Requests

**"Add a button to convert this contact to an account"**
- Use PUT `/api/contacts/:id/status` with status="won"
- Include accountData with edition and pricing
- Update frontend component to show button
- Handle success/error states

**"Show contact interaction history on the contact detail page"**
- Use GET `/api/contacts/:id/interactions`
- Create timeline component
- Display chronologically
- Allow filtering by type

**"Generate trial license for this contact"**
- Use POST `/api/contacts/:id/trials`
- Specify edition_id and trial_days
- Return trial key to user
- Set expiration date

**"Import contacts from CSV"**
- Use existing ImportContacts.jsx page
- Map CSV columns to contact fields
- Validate data before import
- Create contacts via POST `/api/contacts`

**"Track which contacts have expired licenses"**
- Use GET `/api/contacts/:id/licenses?expired_only=true`
- Display in dashboard
- Send renewal notifications
- Filter by license_type

---

## Success Criteria

✅ Contact CRUD operations work correctly
✅ Lead to contact conversion preserves all data
✅ Multi-tenant security enforced on all endpoints
✅ License generation creates unique keys
✅ Device limits enforced per license
✅ Trial periods expire correctly
✅ Interaction history displays chronologically
✅ Account creation on "won" status works
✅ CSV import validates and creates contacts
✅ Search and filtering return accurate results
✅ Statistics dashboard shows correct metrics
✅ No console errors or security warnings

---

## Agent Invocation

To use this agent, run:
```bash
/contact-agent
```

Then describe what you need help with regarding contact management.
