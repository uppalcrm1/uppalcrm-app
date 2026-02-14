# Migration: Extend lead_interactions for Contact and Account Linking

## Overview

This migration extends the `lead_interactions` table to support tasks that link to contacts and accounts (not just leads).

**Migration File:** `database/migrations/041_extend_interactions_to_contacts_and_accounts.sql`

### Changes Made

1. ✅ **Makes `lead_id` nullable** - Allows tasks without a lead reference
2. ✅ **Adds `contact_id` column** - Optional UUID for contact-specific tasks
3. ✅ **Adds `account_id` column** - Optional UUID for account-specific tasks
4. ✅ **Creates performance indexes** - Three indexes for efficient querying
5. ✅ **Validates schema** - Reports success/failure on completion

### Data Safety

- All existing lead-linked tasks remain unchanged
- Foreign keys use `ON DELETE SET NULL` (no cascading deletes)
- Migration uses `IF NOT EXISTS` checks to prevent re-run issues
- No data is modified; only schema changes

---

## Running the Migration on DevTest

### Option 1: Using the Migration Helper Script

```bash
# Set DevTest database credentials in environment
export DEVTEST_DATABASE_URL="postgresql://user:password@host:port/database"

# Or set individual credentials:
export DEVTEST_DB_HOST="your-devtest-host"
export DEVTEST_DB_PORT="5432"
export DEVTEST_DB_NAME="your_devtest_database"
export DEVTEST_DB_USER="your_user"
export DEVTEST_DB_PASSWORD="your_password"

# Run the migration
node run-migration-devtest.js 041_extend_interactions_to_contacts_and_accounts.sql
```

### Option 2: Using .env.devtest File

Create `.env.devtest` file in project root:

```env
DEVTEST_DATABASE_URL=postgresql://user:password@host:5432/devtest_db
```

Then run:

```bash
node run-migration-devtest.js 041_extend_interactions_to_contacts_and_accounts.sql
```

### Option 3: Manual PostgreSQL Connection

Connect directly to DevTest database and run the SQL:

```bash
psql -h your-devtest-host -U your_user -d your_devtest_database -f database/migrations/041_extend_interactions_to_contacts_and_accounts.sql
```

Or via psql interactive:

```bash
psql postgresql://user:password@host:5432/devtest_db
\i database/migrations/041_extend_interactions_to_contacts_and_accounts.sql
```

---

## Verification

After running the migration, the script will display a validation report showing:

```
╔════════════════════════════════════════════════════════════════╗
║         MIGRATION VALIDATION REPORT                            ║
╚════════════════════════════════════════════════════════════════╝
✅ lead_id column: NULLABLE (allows tasks without leads)
✅ contact_id column: CREATED
✅ account_id column: CREATED
✅ contact_id index: CREATED
✅ account_id index: CREATED

🎉 MIGRATION COMPLETED SUCCESSFULLY!

Tasks can now link to:
  • Lead (lead_id) - for lead-specific tasks
  • Contact (contact_id) - for contact-specific tasks
  • Account (account_id) - for account-specific tasks
  • Any combination of the above
```

### Manual Verification Query

To verify the schema changes manually:

```sql
-- Check columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'lead_interactions'
  AND column_name IN ('lead_id', 'contact_id', 'account_id')
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname
FROM pg_indexes
WHERE tablename = 'lead_interactions'
  AND indexname LIKE '%contact_id%' OR indexname LIKE '%account_id%';
```

---

## Next Steps

After successful migration on DevTest:

1. **Test the new schema** in DevTest environment
   - Create task linked to contact only
   - Create task linked to account only
   - Create task linked to both contact and account
   - Verify existing lead-linked tasks still work

2. **Update API endpoints** to support new columns
   - POST `/api/tasks` - accept `contact_id` and `account_id`
   - GET `/api/tasks/:id` - return all three IDs
   - Task filtering by entity type

3. **Update frontend forms**
   - Allow selecting contact/account when creating task
   - Display task associations in timeline
   - Add task filters by contact/account

4. **Deploy to Staging** after DevTest validation

5. **Deploy to Production** after staging approval

---

## Rollback (if needed)

If you need to revert the migration:

```sql
-- Drop new indexes
DROP INDEX IF EXISTS idx_lead_interactions_contact_id;
DROP INDEX IF EXISTS idx_lead_interactions_account_id;
DROP INDEX IF EXISTS idx_lead_interactions_by_type_and_entities;

-- Drop new columns
ALTER TABLE lead_interactions DROP COLUMN IF EXISTS contact_id;
ALTER TABLE lead_interactions DROP COLUMN IF EXISTS account_id;

-- Make lead_id NOT NULL again (if needed)
ALTER TABLE lead_interactions ALTER COLUMN lead_id SET NOT NULL;
```

---

## Questions?

- Check the migration file: `database/migrations/041_extend_interactions_to_contacts_and_accounts.sql`
- Review task schema: See `agents/interactions-management.md` for task details
- Contact admin for database access credentials
