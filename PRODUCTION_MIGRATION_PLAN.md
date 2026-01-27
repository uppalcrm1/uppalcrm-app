# Production Migration Plan

## Migrations to Apply (In Order)

### Contact Field Configuration (034-037)

#### Migration 034: Seed Contact Field Visibility
- **Purpose**: Initialize field visibility settings for contact fields
- **Type**: Data configuration
- **Safe**: Yes (idempotent)

#### Migration 035: Add Missing Contact System Fields
- **Purpose**: Add any missing system field definitions for contacts
- **Type**: Data/Schema
- **Safe**: Yes

#### Migration 036: Comprehensive Contact Field Configuration
- **Purpose**: Full configuration of all contact field settings
- **Type**: Data configuration
- **Safe**: Yes

#### Migration 037: Cleanup Duplicate LinkedIn Field
- **Purpose**: Remove duplicate LinkedIn field entries
- **Type**: Data cleanup
- **Safe**: Yes

### Lead Field Configuration (038-039)

#### Migration 038: Comprehensive Leads Field Configuration
- **Purpose**: Configure all lead system and custom field settings
- **Type**: Data configuration
- **Includes**:
  - System field definitions for leads
  - Default visibility settings
  - Field ordering and grouping
- **Safe**: Yes

#### Migration 039: Standardize Field Naming to snake_case
- **Purpose**: Convert all field names to consistent snake_case format
- **Type**: Data standardization
- **Changes**:
  - firstName → first_name
  - lastName → last_name
  - assignedTo → assigned_to
  - potentialValue → potential_value
  - nextFollowUp → next_follow_up
- **Safe**: Yes (removes duplicates)
- **Status**: Successfully tested on staging

## Execution Plan

### Prerequisites
- ✅ Production database credentials
- ✅ Backup of production database (recommended)
- ✅ Maintenance window scheduled (optional but recommended)

### Execution Order
```
1. Run Migration 034
2. Run Migration 035
3. Run Migration 036
4. Run Migration 037
5. Run Migration 038
6. Run Migration 039 (tested, safe to apply)
```

### Verification Steps
```sql
-- After migrations complete, verify:
SELECT DISTINCT field_name 
FROM default_field_configurations 
WHERE entity_type = 'leads' 
ORDER BY field_name;

-- Should show only snake_case names (first_name, last_name, etc.)
-- No camelCase duplicates (firstName, lastName, etc.)
```

## Timeline

- **Staging Applied**: ✅ Migration 039 successful (no duplicates remaining)
- **Production Ready**: All migrations bundled, ready to deploy
- **Estimated Duration**: < 5 minutes for all 6 migrations
- **Rollback Plan**: Database restore from backup (if needed)

## Files Provided

For manual execution on production database, scripts are available:
- `migrate-staging-039-safe.js` (template for safe removal of duplicates)

## Post-Migration Steps

1. Merge staging → production branch
2. Deploy frontend code
3. Test in production:
   - Open existing lead edit form
   - Create new lead
   - Verify all fields populate correctly
   - Check browser console for errors
4. Monitor application logs

