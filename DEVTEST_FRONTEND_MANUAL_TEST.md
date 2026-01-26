# DevTest Frontend Manual Test - Field Visibility Verification
**Date:** 2026-01-25
**Environment:** https://uppalcrm-frontend-devtest.onrender.com/dashboard
**Objective:** Verify console warnings are eliminated and new fields display correctly

---

## Test Instructions

### Step 1: Open DevTest Frontend in Browser
1. Go to: `https://uppalcrm-frontend-devtest.onrender.com/leads`
2. Log in with your devtest credentials (if not already logged in)
3. **Keep this URL open in a separate tab while testing**

### Step 2: Clear Browser Console
1. Open DevTools: Press `F12` (Windows) or `Cmd+Option+I` (Mac)
2. Go to **Console** tab
3. Click the **Clear Console** button (⊘ icon) or type: `clear()`
4. Make sure console is empty before proceeding

### Step 3: Navigate to a Lead Detail Page
1. In the Leads table, click on any lead row (e.g., "manjit test1")
2. The lead detail page should load
3. **Watch the Console tab** - look for any warnings

---

## Console Warning Check (CRITICAL)

**Look for these warning patterns that should NOW BE GONE:**

```
⚠️ Field 'address' not found in configuration - treating as hidden
⚠️ Field 'city' not found in configuration - treating as hidden
⚠️ Field 'state' not found in configuration - treating as hidden
⚠️ Field 'postal_code' not found in configuration - treating as hidden
⚠️ Field 'country' not found in configuration - treating as hidden
⚠️ Field 'created_by' not found in configuration - treating as hidden
⚠️ Field 'linked_contact_id' not found in configuration - treating as hidden
⚠️ Field 'relationship_type' not found in configuration - treating as hidden
⚠️ Field 'interest_type' not found in configuration - treating as hidden
⚠️ Field 'converted_date' not found in configuration - treating as hidden
```

### Expected Result
- ✅ **NO WARNINGS** - If console is clean, the migration worked!
- ❌ **Warnings still present** - If you see these warnings, the migration may not have deployed

---

## Step 4: Verify New Fields Display in UI

On the lead detail page, scroll down and look for these field sections:

### Address Information Section
Look for these fields in the "Lead Details" or address section:
- [ ] **Address** - Street address field
- [ ] **City** - City name
- [ ] **State/Province** - State field
- [ ] **Postal Code** - ZIP/postal code
- [ ] **Country** - Country name

**Expected:** All 5 fields should be visible

### Other Fields
Look for these additional fields:
- [ ] **Created By** - Read-only, shows who created the lead
- [ ] **Linked Contact** - Reference to linked contact
- [ ] **Relationship Type** - Type of relationship
- [ ] **Interest Type** - Type of interest
- [ ] **Converted Date** - Read-only, date of conversion if applicable

**Expected:** All fields should be visible or editable (except created_by and converted_date which are read-only)

---

## Step 5: Test Edit Functionality

1. Click the **"Edit"** button on the lead detail page
2. The edit form should open
3. **In the edit form, verify:**
   - [ ] address field is present and editable
   - [ ] city field is present and editable
   - [ ] state field is present and editable
   - [ ] postal_code field is present and editable
   - [ ] country field is present and editable
   - [ ] linked_contact_id field is present
   - [ ] relationship_type field is present
   - [ ] interest_type field is present
   - [ ] **created_by should NOT be in the edit form** (read-only)
   - [ ] **converted_date should NOT be in the edit form** (read-only)

4. Enter test data in one of the address fields (e.g., "123 Main St" in address)
5. Click **Save**
6. **Check console** - should be clean, no errors
7. Verify the field was saved and displays in the detail view

---

## Step 6: Network Tab Verification

1. Open DevTools **Network** tab
2. Reload the lead detail page (F5)
3. Filter by: type "fetch" or "xhr"
4. Look for request: `custom-fields?entity_type=leads`
5. **Click on that request**, go to **Response** tab
6. **Verify the response includes all 10 new fields:**
   ```json
   "field_name": "address"
   "field_name": "city"
   "field_name": "state"
   "field_name": "postal_code"
   "field_name": "country"
   "field_name": "created_by"
   "field_name": "linked_contact_id"
   "field_name": "relationship_type"
   "field_name": "interest_type"
   "field_name": "converted_date"
   ```

**Expected:** ✅ All 10 fields present in response with `"overall_visibility": "visible"`

---

## Test Results

**Complete this section as you test:**

```
Test Date: _______________
Tester Name: _______________
Browser: _______________

CONSOLE WARNINGS: ☐ NONE (Pass) | ☐ PRESENT (Fail)

FIELDS VISIBLE IN DETAIL VIEW:
☐ address
☐ city
☐ state
☐ postal_code
☐ country
☐ created_by (read-only)
☐ linked_contact_id
☐ relationship_type
☐ interest_type
☐ converted_date (read-only)

EDIT FORM VERIFICATION:
☐ All editable fields present
☐ Read-only fields excluded
☐ Save functionality works
☐ No console errors on save

API RESPONSE:
☐ custom-fields endpoint returns 200
☐ All 10 fields in response
☐ Field types correct (text/date)
☐ Visibility set to "visible"

OVERALL RESULT: ☐ PASS | ☐ FAIL

Issues Found (if any):
_________________________________________
_________________________________________
_________________________________________
```

---

## Troubleshooting

### If console still shows "Field not found" warnings:
1. **Hard refresh the page:** Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. **Clear browser cache:** DevTools → Application → Storage → Clear Site Data
3. **Check if backend API is updated:**
   - Test: `curl -H "Authorization: Bearer YOUR_TOKEN" https://uppalcrm-api-devtest.onrender.com/api/custom-fields?entity_type=leads`
   - Should return all 13 fields

### If fields don't appear in UI but API returns them:
1. Check browser console for React component errors
2. Verify field visibility settings in database (show_in_detail_view should be true)
3. Check if the component renders unknown field types

### If API returns 401 Unauthorized:
1. Log out and log back in
2. Check authentication token in DevTools → Application → Cookies
3. Ensure you're logged in with valid credentials

---

## Success Criteria - ALL MUST PASS

- ✅ Zero "Field not found in configuration" console warnings
- ✅ All 10 new fields visible in lead detail page
- ✅ All editable fields functional in edit form
- ✅ Read-only fields (created_by, converted_date) not editable
- ✅ API returns all 13 fields with correct configuration
- ✅ Save changes work without errors

---

## Next Steps After Testing

If all tests PASS:
1. Move to Task 5 - Apply migration to staging database
2. Move to Task 6 - Apply migration to prod database
3. Deploy and test in those environments

If any tests FAIL:
1. Document the issue in the "Issues Found" section above
2. Share the issue details for investigation
3. Do NOT proceed to staging until devtest passes
