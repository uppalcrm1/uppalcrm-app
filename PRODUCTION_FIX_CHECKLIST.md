# PRODUCTION Contact Update Fix - Execution Checklist

## ✅ Pre-Flight Checks
- [ ] Backup PRODUCTION database
- [ ] Verify migration 040 file exists
- [ ] All team members notified
- [ ] Downtime window scheduled (if needed)

---

## 🗄️ Phase 1: Database Migration

### Step 1: Run the Migration
```bash
cd /path/to/project
psql postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database -f database/migrations/040_fix_contacts_generated_columns.sql
```

**Expected output:**
```
BEGIN
ALTER TABLE
ALTER TABLE
COMMIT
```

### Step 2: Verify Schema Changed
```bash
psql postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database -c "
SELECT column_name, is_generated FROM information_schema.columns
WHERE table_name = 'contacts'
AND column_name IN ('status', 'source')
ORDER BY column_name;
"
```

**Expected result:**
```
  column_name  | is_generated
--------------+--------------
 source       | NEVER
 status       | NEVER
```

- [ ] Schema migration successful

---

## 💻 Phase 2: Code Updates

### Files to Update (in order):

#### 1. `models/Contact.js`
- [ ] Line 104: Change INSERT column list from `contact_status, contact_source` to `status, source`
- [ ] Lines 117-118: Remove mapping comments
- [ ] Line 236: Change `c.contact_status` to `c.status`
- [ ] Line 256: Change `c.contact_source` to `c.source`
- [ ] Lines 293-295: Replace COALESCE with direct column names
- [ ] Line 368: Remove duplicate column references

#### 2. `models/Contact-Safe.js`
- [ ] Search for `contact_status` and `contact_source`
- [ ] Update to `status` and `source`

#### 3. `routes/contacts.js`
- [ ] Line 304: Replace COALESCE workaround with `c.status`
- [ ] Line 528: Change `contact_status, contact_source` to `status, source`

#### 4. `routes/leads.js`
- [ ] Line 2484: Change `contact.contact_status` to `contact.status`

#### 5. `services/leadConversionService.js`
- [ ] Search for any `contact_status` or `contact_source` references
- [ ] Update to `status` and `source`

#### 6. Check any other files
```bash
grep -r "contact_status\|contact_source" models/ routes/ services/ --include="*.js"
```
- [ ] All references updated

---

## 🧪 Phase 3: Testing

### Before Deploying:
- [ ] Run tests locally: `npm test`
- [ ] Manual test: Create a contact
- [ ] Manual test: Update a contact status
- [ ] Manual test: Query contacts with status filter

### After Deployment:
- [ ] Test contact creation via API
- [ ] Test contact status UPDATE (the critical test)
- [ ] Test contact source UPDATE
- [ ] Test queries with status/source filters
- [ ] Check application logs for errors
- [ ] Verify triggers are working correctly

### Key Test Command (should work now):
```bash
curl -X PUT http://your-api/api/contacts/:contact-id \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"status": "active", "source": "website"}'
```

Expected: ✅ 200 OK (previously was failing)

---

## 📋 Files Changed Summary

| File | Changes | Lines |
|------|---------|-------|
| models/Contact.js | 6 changes | 104, 117-118, 236, 256, 293-295, 368 |
| models/Contact-Safe.js | Multiple | Check file |
| routes/contacts.js | 2 changes | 304, 528 |
| routes/leads.js | 1 change | 2484 |
| services/leadConversionService.js | Check file | TBD |
| database/migrations/040_fix_contacts_generated_columns.sql | New file | - |

**Total files:** 6 ✏️
**Total lines changed:** ~20 📝
**Risk level:** Low ✅ (already tested on DEVTEST/STAGING)

---

## 🎯 Success Criteria

- [ ] Contact creation works ✅
- [ ] Contact UPDATE works ✅ (THE MAIN FIX)
- [ ] Existing contacts still queryable ✅
- [ ] Triggers fire correctly ✅
- [ ] No error logs ✅
- [ ] PRODUCTION matches DEVTEST/STAGING schema ✅

---

## 🚨 If Something Goes Wrong

### Immediate Rollback:
1. Revert code changes (git restore)
2. Contact support to rollback database migration
3. Redeploy previous version

### Troubleshooting:
- Migration won't run? Check for dependent views/triggers
- Code tests failing? Check grep results for missed references
- API returning wrong field names? Verify all SELECT clauses updated

---

## 📝 Notes

- The migration is idempotent (uses `IF EXISTS`)
- No data loss occurs
- Existing contact data preserved
- This makes PRODUCTION match DEVTEST/STAGING
- All changes are backward compatible with the model code

---

## 👤 Sign-Off

- [ ] Reviewed by: _________________ Date: _______
- [ ] Approved for PRODUCTION: _________________ Date: _______
- [ ] Deployed by: _________________ Date: _______
- [ ] Verified by: _________________ Date: _______
