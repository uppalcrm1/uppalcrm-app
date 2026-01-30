# DevTest Deployment Guide - Lead Update Fix

## Commit Pushed ✅

**Branch:** devtest
**Commit:** ecb0638 (after d3997fd)
**Change:** Add migration to cleanup duplicate field configurations

```
ecb0638 fix: Add migration to cleanup duplicate field configurations
d3997fd feat: Implement timezone infrastructure with CORS and auth flow fixes
ff838ad feat: Implement pagination for transactions page
```

## What's Being Deployed

### Code Changes
- New migration file: `database/migrations/002-cleanup-duplicate-field-configurations.js`
- Removes 13 duplicate field configuration records
- Ensures each field has only 1 configuration per organization

### Database Changes (Already Applied Locally)
- ✅ Timezone migration (timezone column added to users table)
- ⏳ Duplicate field cleanup (ready to deploy via migration)

## Deployment Steps for DevTest

### Step 1: Pull Latest Code
```bash
git pull origin devtest
```

### Step 2: Apply the Migration
```bash
# Option A: Using the migration directly
node database/migrations/002-cleanup-duplicate-field-configurations.js up

# Option B: Create and run deployment script
cat > apply-devtest-migrations.js << 'EOF'
const { up: timezoneUp } = require('./database/migrations/001-add-timezone-to-users');
const { up: configCleanupUp } = require('./database/migrations/002-cleanup-duplicate-field-configurations');

async function applyAll() {
  try {
    console.log('🚀 Applying all migrations...\n');

    console.log('1️⃣  Timezone migration...');
    await timezoneUp();

    console.log('\n2️⃣  Field configuration cleanup...');
    await configCleanupUp();

    console.log('\n✅ All migrations applied successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyAll();
EOF

node apply-devtest-migrations.js
```

### Step 3: Restart Backend Service
```bash
npm run dev
```

### Step 4: Test Lead Updates
1. Navigate to leads page
2. Click edit on any lead
3. Change the status field
4. Save - should succeed with 200 status

## What Gets Fixed

✅ Lead update validation errors (400 Bad Request)
✅ "status must be [null]" error messages
✅ Duplicate field configuration issues
✅ Consistent validation schema generation

## Files in This Deployment

### New
- `database/migrations/002-cleanup-duplicate-field-configurations.js` - Cleanup migration

### Already Deployed (From d3997fd)
- `database/migrations/001-add-timezone-to-users.js` - Timezone support
- `routes/timezone.js` - Timezone endpoints
- `utils/timezone.js` - Timezone utilities
- Updated: `models/User.js`, `middleware/security.js`, `frontend/src/services/api.js`

## Verification After Deployment

### Check Migrations Applied
```sql
-- Count remaining field configs (should be 21)
SELECT COUNT(*) as total FROM default_field_configurations;

-- Check for duplicates (should be 0)
SELECT field_name, COUNT(*) as count
FROM default_field_configurations
GROUP BY field_name
HAVING COUNT(*) > 1;
```

### Test Lead Update
```bash
# Update a lead with status change
curl -X PUT http://localhost:3000/api/leads/{leadId} \
  -H "Authorization: Bearer {token}" \
  -H "X-Organization-Slug: {org}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "contacted",
    "notes": "Updated from devtest deployment"
  }'
```

Expected response:
```json
{
  "lead": {
    "id": "...",
    "status": "contacted",
    "notes": "Updated from devtest deployment",
    ...
  }
}
```

## Rollback (If Needed)

```bash
# Rollback field cleanup migration
node database/migrations/002-cleanup-duplicate-field-configurations.js down

# Rollback timezone migration (if needed)
node database/migrations/001-add-timezone-to-users.js down
```

**Note:** Field cleanup cannot be fully reversed as it deletes data. A backup restore would be needed to recover deleted configurations.

## Timeline

- **Created:** 2026-01-29
- **Issue:** Lead updates failing with 400 validation errors
- **Root Cause:** Duplicate field configurations in database
- **Solution:** Add migration to cleanup duplicates
- **Status:** ✅ Ready for deployment

---

**Deployed By:** Lead Interactions Agent
**Branch:** devtest
**Remote:** https://github.com/uppalcrm1/uppalcrm-app.git
