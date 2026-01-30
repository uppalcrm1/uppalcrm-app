# PRODUCTION Contact Update Bug - Fix Plan

## Problem
PRODUCTION has read-only generated columns `status` and `source` that prevent updates.
DEVTEST and STAGING already have the correct schema with real updatable columns.

## Solution
1. Run migration 040 to fix the schema
2. Update code to remove unnecessary column mapping
3. Test and verify

---

## Phase 1: Database Migration

**File:** `database/migrations/040_fix_contacts_generated_columns.sql`

**Run on PRODUCTION:**
```bash
psql postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database -f database/migrations/040_fix_contacts_generated_columns.sql
```

**Verification Query:**
```sql
SELECT column_name, is_generated FROM information_schema.columns
WHERE table_name = 'contacts'
AND column_name IN ('status', 'source')
ORDER BY column_name;
```

Expected result:
```
status | NEVER
source | NEVER
```

---

## Phase 2: Code Changes Required

### File: `models/Contact.js`

#### Change 1: CREATE method (lines 104, 117-118)
**Current (has unnecessary mapping):**
```javascript
// Line 104
INSERT INTO contacts (
  organization_id, title, company, first_name, last_name, email, phone,
  contact_status, contact_source, priority, lifetime_value, notes, assigned_to, created_by,
  next_follow_up, custom_fields
)
...
// Lines 117-118
status, // maps to contact_status
source, // maps to contact_source
```

**Change to:**
```javascript
// Line 104
INSERT INTO contacts (
  organization_id, title, company, first_name, last_name, email, phone,
  status, source, priority, lifetime_value, notes, assigned_to, created_by,
  next_follow_up, custom_fields
)
...
// Lines 117-118
status,
source,
```

---

#### Change 2: Query method (lines 236, 256)
**Current:**
```javascript
// Line 236
if (status) {
  whereConditions.push(`c.contact_status = $${++paramCount}`);
  params.push(status);
}

// Line 256
if (source) {
  whereConditions.push(`c.contact_source ILIKE $${++paramCount}`);
  params.push(`%${source}%`);
}
```

**Change to:**
```javascript
// Line 236
if (status) {
  whereConditions.push(`c.status = $${++paramCount}`);
  params.push(status);
}

// Line 256
if (source) {
  whereConditions.push(`c.source ILIKE $${++paramCount}`);
  params.push(`%${source}%`);
}
```

---

#### Change 3: SELECT clause (lines 293-295)
**Current (COALESCE workaround):**
```javascript
// Lines 293-295
COALESCE(c.contact_status, c.status) as status,
c.type,
COALESCE(c.contact_source, c.source) as source,
```

**Change to:**
```javascript
c.status,
c.type,
c.source,
```

---

#### Change 4: Aggregation query (line 368)
**Current:**
```javascript
c.contact_status, c.status, c.type, c.contact_source, c.source,
```

**Change to:**
```javascript
c.status, c.type, c.source,
```

---

### File: `routes/contacts.js`

#### Change: Line 304 (WHERE clause)
**Current:**
```javascript
WHEN COALESCE(c.contact_status, c.status) = 'active'
```

**Change to:**
```javascript
WHEN c.status = 'active'
```

---

#### Change: Line 528 (SELECT clause)
**Current:**
```javascript
contact_status, contact_source, company, title,
```

**Change to:**
```javascript
status, source, company, title,
```

---

### File: `routes/leads.js`

#### Change: Line 2484
**Current:**
```javascript
status: contact.contact_status
```

**Change to:**
```javascript
status: contact.status
```

---

### File: `models/Contact-Safe.js`
Check for same column references as Contact.js and update accordingly.

---

### File: `services/leadConversionService.js`
Check for any hardcoded `contact_status` or `contact_source` references and update to `status` and `source`.

---

## Phase 3: Testing

### Test 1: Verify Schema
```bash
psql postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database -c "
SELECT column_name, is_generated FROM information_schema.columns
WHERE table_name = 'contacts'
AND column_name IN ('status', 'source', 'contact_status', 'contact_source')
ORDER BY column_name;
"
```

Expected: Only `status` and `source` should exist, both with `is_generated = NEVER`

### Test 2: Create a Contact
```bash
curl -X POST http://your-app/api/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "Contact",
    "email": "test@example.com",
    "status": "active",
    "source": "website"
  }'
```

Expected: ✅ Success

### Test 3: Update a Contact
```bash
curl -X PUT http://your-app/api/contacts/:id \
  -H "Content-Type: application/json" \
  -d '{
    "status": "inactive",
    "source": "referral"
  }'
```

Expected: ✅ Success (this was failing before)

### Test 4: Query with Filters
```bash
curl "http://your-app/api/contacts?status=active&source=website"
```

Expected: ✅ Returns filtered results

---

## Rollback Plan (if needed)

If issues occur, you can revert:
```bash
# Undo the migration
psql postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database -c "
BEGIN;
ALTER TABLE contacts RENAME COLUMN status TO contact_status;
ALTER TABLE contacts RENAME COLUMN source TO contact_source;
-- Recreate generated columns if needed
COMMIT;
"

# Then revert code changes and redeploy
```

---

## Summary

**Files to update:** 6
- models/Contact.js (4 changes)
- models/Contact-Safe.js (check for similar changes)
- routes/contacts.js (2 changes)
- routes/leads.js (1 change)
- services/leadConversionService.js (check for references)

**Lines affected:** ~15-20 total

**Impact:** Bug fix - no breaking changes, fixes existing functionality

**Risk:** Low - DEVTEST and STAGING already run this schema successfully
