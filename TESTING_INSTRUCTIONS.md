# Lead Conversion Testing Instructions

## What Was Implemented

The lead conversion functionality is now complete with the following features:

### Backend (✅ Deployed)
1. **Database Tables Created**:
   - `contacts` - Stores customer contact information
   - `accounts` - Stores customer accounts/licenses
   - `lead_contact_relationships` - Tracks lead-to-contact relationships

2. **API Endpoint**: `POST /api/leads/:id/convert`
   - Converts a lead to a contact
   - Optionally creates an account during conversion
   - Supports linking to existing contacts or creating new ones

3. **Features**:
   - Transaction-based for data integrity
   - Three relationship types: `new_customer`, `existing_customer`, `additional_device`
   - MAC address validation
   - Trial period management
   - License key generation

### Frontend (✅ Deployed)
- Added `leadsAPI.convertLead()` method in API service

---

## Manual Testing Steps

### Step 1: Login to CRM Dashboard

1. Go to: https://uppalcrmapp.netlify.app
2. Login with your business account credentials
3. You should see the CRM dashboard

### Step 2: Create a Test Lead

1. Navigate to **Leads** section
2. Click **"Add New Lead"** or **"Create Lead"**
3. Fill in lead information:
   - First Name: John
   - Last Name: Doe
   - Email: john.doe@test.com
   - Phone: +1234567890
   - Company: Test Company
   - Status: qualified
4. Click **"Save"** or **"Create Lead"**

### Step 3: Convert the Lead

#### Option A: If UI has "Convert" button
1. Find the lead you just created
2. Click on the lead to view details
3. Look for a **"Convert to Contact"** or **"Convert"** button
4. Click the button
5. Fill in the conversion form (if available)
6. Submit

#### Option B: If UI doesn't have convert button yet
You'll need to use the browser console to test:

1. Open the lead details page
2. Press F12 to open Developer Console
3. Go to Console tab
4. Run this command (replace `LEAD_ID_HERE` with actual lead ID):

```javascript
// Import the API
import { leadsAPI } from './services/api'

// Convert lead to new contact without account
const result = await leadsAPI.convertLead('LEAD_ID_HERE', {
  relationshipType: 'new_customer'
})

console.log('Conversion result:', result)
```

Or to create with an account:

```javascript
// Convert lead to new contact WITH trial account
const result = await leadsAPI.convertLead('LEAD_ID_HERE', {
  relationshipType: 'new_customer',
  createAccount: true,
  accountDetails: {
    edition: 'Pro',
    isTrial: true,
    trialDays: 30,
    deviceName: 'Test Device',
    macAddress: '00:1A:2B:3C:4D:5E' // Optional MAC address
  }
})

console.log('Conversion result:', result)
```

### Step 4: Verify Conversion

1. Go to **Contacts** section
2. You should see a new contact: **John Doe** (john.doe@test.com)
3. Click on the contact to view details
4. Verify:
   - Contact information matches the lead
   - If you created an account, check that it appears in the contact's accounts
   - Lead should now show as "converted" status

### Step 5: Check Accounts (if created)

1. Go to **Accounts** section
2. You should see the new account tied to the contact
3. Verify:
   - Account name
   - License status
   - Trial dates (if created as trial)
   - Device information

---

## Testing Different Scenarios

### Scenario 1: Simple Conversion (Contact Only)
```javascript
await leadsAPI.convertLead(leadId, {
  relationshipType: 'new_customer'
})
```
**Expected Result**: New contact created, no account

### Scenario 2: Conversion with Trial Account
```javascript
await leadsAPI.convertLead(leadId, {
  relationshipType: 'new_customer',
  createAccount: true,
  accountDetails: {
    edition: 'Premium',
    isTrial: true,
    trialDays: 14,
    deviceName: 'MacBook Pro'
  }
})
```
**Expected Result**: New contact + trial account for 14 days

### Scenario 3: Link to Existing Contact
```javascript
await leadsAPI.convertLead(leadId, {
  existingContactId: 'existing-contact-uuid-here',
  relationshipType: 'additional_device',
  createAccount: true,
  accountDetails: {
    edition: 'Basic',
    deviceName: 'Windows PC',
    macAddress: 'AA:BB:CC:DD:EE:FF'
  }
})
```
**Expected Result**: Lead linked to existing contact + new device account

### Scenario 4: Existing Customer Buying Again
```javascript
await leadsAPI.convertLead(leadId, {
  existingContactId: 'existing-contact-uuid-here',
  relationshipType: 'existing_customer',
  interestType: 'renewal'
})
```
**Expected Result**: Lead linked to existing contact, marked as renewal interest

---

## Verification Checklist

- [ ] Lead was successfully converted (no errors)
- [ ] New contact appears in Contacts section
- [ ] Contact information is accurate
- [ ] Lead status changed to "converted"
- [ ] If account created: Account appears in Accounts section
- [ ] If account created: Account is linked to contact
- [ ] If trial: Trial dates are set correctly
- [ ] If MAC address provided: MAC address is stored
- [ ] No duplicate contacts created
- [ ] Transaction rolled back on error (test by using invalid data)

---

## Troubleshooting

### Error: "Lead already converted"
- The lead has already been converted
- Check `linked_contact_id` field on the lead
- Create a new lead for testing

### Error: "Email already exists"
- A contact with this email already exists
- Either use `existingContactId` to link to that contact
- Or use a different email for the new lead

### Error: "Invalid MAC address"
- MAC address format must be: `XX:XX:XX:XX:XX:XX`
- Example: `00:1A:2B:3C:4D:5E`
- It's optional - can omit if not available

### Error: "Tables not found"
- Migration may not have run on production
- Check server logs for migration status
- Contact DevOps to verify database

---

## API Endpoint Documentation

### POST /api/leads/:id/convert

**Headers**:
```
Authorization: Bearer <your-jwt-token>
X-Organization-Slug: <your-org-slug>
```

**Request Body**:
```json
{
  "existingContactId": "uuid-optional",
  "relationshipType": "new_customer|existing_customer|additional_device",
  "interestType": "renewal|upgrade|additional_license",
  "createAccount": true,
  "accountDetails": {
    "edition": "Pro",
    "deviceName": "Customer PC",
    "macAddress": "00:1A:2B:3C:4D:5E",
    "isTrial": true,
    "trialDays": 30,
    "billingCycle": "monthly",
    "price": 99.99,
    "notes": "Optional notes"
  }
}
```

**Success Response** (200):
```json
{
  "message": "Lead converted successfully",
  "contact": { /* contact object */ },
  "account": { /* account object if created */ },
  "isNewContact": true
}
```

**Error Responses**:
- `404`: Lead not found
- `400`: Lead already converted
- `400`: Missing required fields
- `409`: Email already exists (when creating new contact)

---

## Next Steps

After successful testing:

1. **UI Integration**: Add "Convert to Contact" button in Lead details page
2. **Conversion Modal**: Create a form modal for conversion options
3. **Success Notification**: Show success toast when conversion completes
4. **Lead List Update**: Update lead status in the list view
5. **Navigation**: Redirect to new contact page after conversion

---

## Questions or Issues?

If you encounter any issues during testing:

1. Check browser console for error messages
2. Check Network tab for API response details
3. Verify you're logged in with valid credentials
4. Ensure you have proper permissions for lead conversion
5. Check if the backend deployment completed successfully

The migration runs automatically on server startup, so the tables should be created if the deployment was successful.
