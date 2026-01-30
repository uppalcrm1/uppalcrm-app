# Code Changes - Detailed Side-by-Side

## 📄 File 1: `models/Contact.js`

### Change 1.1: CREATE method - INSERT statement (Line 104)

**BEFORE:**
```javascript
const result = await query(`
  INSERT INTO contacts (
    organization_id, title, company, first_name, last_name, email, phone,
    contact_status, contact_source, priority, lifetime_value, notes, assigned_to, created_by,
    next_follow_up, custom_fields
  )
```

**AFTER:**
```javascript
const result = await query(`
  INSERT INTO contacts (
    organization_id, title, company, first_name, last_name, email, phone,
    status, source, priority, lifetime_value, notes, assigned_to, created_by,
    next_follow_up, custom_fields
  )
```

**Why:** Column names are now `status` and `source`, not `contact_status` and `contact_source`

---

### Change 1.2: CREATE method - Parameter mapping (Lines 117-118)

**BEFORE:**
```javascript
status, // maps to contact_status
source, // maps to contact_source
```

**AFTER:**
```javascript
status,
source,
```

**Why:** No mapping needed anymore - parameter names match column names

---

### Change 1.3: findByOrganization - Status filter (Line 236)

**BEFORE:**
```javascript
if (status) {
  whereConditions.push(`c.contact_status = $${++paramCount}`);
  params.push(status);
}
```

**AFTER:**
```javascript
if (status) {
  whereConditions.push(`c.status = $${++paramCount}`);
  params.push(status);
}
```

**Why:** Column name changed from `contact_status` to `status`

---

### Change 1.4: findByOrganization - Source filter (Line 256)

**BEFORE:**
```javascript
if (source) {
  whereConditions.push(`c.contact_source ILIKE $${++paramCount}`);
  params.push(`%${source}%`);
}
```

**AFTER:**
```javascript
if (source) {
  whereConditions.push(`c.source ILIKE $${++paramCount}`);
  params.push(`%${source}%`);
}
```

**Why:** Column name changed from `contact_source` to `source`

---

### Change 1.5: findByOrganization - SELECT clause (Lines 293-295)

**BEFORE (COALESCE workaround for generated columns):**
```javascript
COALESCE(c.contact_status, c.status) as status,
c.type,
COALESCE(c.contact_source, c.source) as source,
```

**AFTER (simple column selection):**
```javascript
c.status,
c.type,
c.source,
```

**Why:** No longer need COALESCE workaround - columns are real and have the right names

---

### Change 1.6: findByOrganization - Aggregation query (Line 368)

**BEFORE (duplicate columns):**
```javascript
c.contact_status, c.status, c.type, c.contact_source, c.source,
```

**AFTER (clean, single reference):**
```javascript
c.status, c.type, c.source,
```

**Why:** Only need the real columns, not the generated ones

---

## 📄 File 2: `routes/contacts.js`

### Change 2.1: WHERE clause (Line 304)

**BEFORE (COALESCE workaround):**
```javascript
WHEN COALESCE(c.contact_status, c.status) = 'active'
```

**AFTER (direct column reference):**
```javascript
WHEN c.status = 'active'
```

**Why:** Simpler, cleaner syntax without workaround

---

### Change 2.2: SELECT clause (Line 528)

**BEFORE:**
```javascript
contact_status, contact_source, company, title,
```

**AFTER:**
```javascript
status, source, company, title,
```

**Why:** Column names match new schema

---

## 📄 File 3: `routes/leads.js`

### Change 3.1: Contact status mapping (Line 2484)

**BEFORE:**
```javascript
status: contact.contact_status
```

**AFTER:**
```javascript
status: contact.status
```

**Why:** Property name changed from `contact_status` to `status`

---

## 📄 File 4: `models/Contact-Safe.js`

**Action:** Search this file for any references to `contact_status` or `contact_source`

**Search command:**
```bash
grep -n "contact_status\|contact_source" models/Contact-Safe.js
```

**For each match found:**
- Replace `contact_status` with `status`
- Replace `contact_source` with `source`

---

## 📄 File 5: `services/leadConversionService.js`

**Action:** Search this file for column references

**Search command:**
```bash
grep -n "contact_status\|contact_source" services/leadConversionService.js
```

**For each match found:**
- If it's a column reference: replace `contact_status` → `status`, `contact_source` → `source`
- If it's a comment: update to reflect new column names

---

## 🔍 Verification Commands

### After making all changes, verify no old references remain:

```bash
# Check models
grep -n "contact_status\|contact_source" models/Contact.js models/Contact-Safe.js

# Check routes
grep -n "contact_status\|contact_source" routes/contacts.js routes/leads.js

# Check services
grep -n "contact_status\|contact_source" services/leadConversionService.js

# Check all JS files at once
grep -r "contact_status\|contact_source" --include="*.js" models/ routes/ services/
```

**Expected result:** No matches found (empty output)

---

## 📊 Impact Summary

| Component | Current | After Fix | Impact |
|-----------|---------|-----------|--------|
| CREATE | Maps status → contact_status | Direct use of status | Simpler |
| UPDATE | ❌ Fails (read-only col) | ✅ Works (real column) | **FIXES BUG** |
| SELECT | Uses COALESCE workaround | Direct column reference | Cleaner |
| Queries | COALESCE in WHERE | Direct column filter | Simpler |
| Triggers | Work with status/source | Still work (unchanged) | No impact |

---

## ✅ Testing Each Change

### After changing models/Contact.js:
```bash
npm test -- models/Contact.test.js
```

### After changing routes/:
```bash
npm test -- routes/contacts.test.js
npm test -- routes/leads.test.js
```

### Manual API test (the critical one):
```bash
# This should NOW WORK (was failing before)
curl -X PUT http://localhost:3000/api/contacts/[ID] \
  -H "Content-Type: application/json" \
  -d '{"status": "active", "source": "website"}'
```

Expected: ✅ 200 OK with updated contact

---

## 🎯 Commit Message

Once all changes are complete and tested:

```
fix: Fix contact status/source update bug in PRODUCTION

- Drop read-only generated columns (status, source) from contacts table
- Rename actual columns: contact_status → status, contact_source → source
- Make PRODUCTION schema match DEVTEST/STAGING
- Remove unnecessary field mapping and COALESCE workarounds
- Fixes issue where contact updates were failing with "column can only be updated to DEFAULT"

Migration: 040_fix_contacts_generated_columns.sql
Modified files: models/Contact.js, routes/contacts.js, routes/leads.js, etc.
```
