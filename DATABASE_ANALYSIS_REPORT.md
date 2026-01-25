# DevTest Database Analysis Report
**Date:** 2026-01-24
**Database:** uppalcrm_devtest
**Entity:** Leads Table

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Columns in Leads Table | 29 |
| System Fields (Always Visible) | 16 |
| Extended Fields (Currently Hidden) | 10 |
| Internal Fields (Never Visible) | 3 |
| Custom Fields Defined | 3 |
| Missing from Custom Definitions | 10 |

---

## 1. System Fields (Currently Visible) - 16 Fields

These fields are essential CRM core fields and should always be visible in the UI.

| Field Name | Data Type | Nullable | Status | Visibility |
|-----------|-----------|----------|--------|-----------|
| first_name | character varying | YES | ✓ Active | VISIBLE |
| last_name | character varying | YES | ✓ Active | VISIBLE |
| email | character varying | YES | ✓ Active | VISIBLE |
| phone | character varying | YES | ✓ Active | VISIBLE |
| company | character varying | YES | ✓ Active | VISIBLE |
| title | character varying | YES | ✓ Active | VISIBLE |
| source | character varying | YES | ✓ Active | VISIBLE |
| status | character varying | YES | ✓ Active | VISIBLE |
| priority | character varying | YES | ✓ Active | VISIBLE |
| assigned_to | uuid | YES | ✓ Active | VISIBLE |
| notes | text | YES | ✓ Active | VISIBLE |
| created_at | timestamp with time zone | YES | ✓ Active | VISIBLE |
| updated_at | timestamp with time zone | YES | ✓ Active | VISIBLE |
| last_contact_date | timestamp with time zone | YES | ✓ Active | VISIBLE |
| next_follow_up | timestamp with time zone | YES | ✓ Active | VISIBLE |
| value | numeric | YES | ✓ Active | VISIBLE |

---

## 2. Extended Fields (Currently Hidden) - 10 Fields

These fields exist in the database but are NOT defined in custom_field_definitions. They should be added to enable proper UI field management.

### Address Information (5 fields)

| Field Name | Data Type | Suggested Field Type | Action Required | Priority |
|-----------|-----------|---------------------|-----------------|----------|
| address | character varying | text | ADD TO CUSTOM FIELDS | HIGH |
| city | character varying | text | ADD TO CUSTOM FIELDS | HIGH |
| state | character varying | text | ADD TO CUSTOM FIELDS | HIGH |
| postal_code | character varying | text | ADD TO CUSTOM FIELDS | HIGH |
| country | character varying | text | ADD TO CUSTOM FIELDS | HIGH |

### Relationship & Reference Fields (4 fields)

| Field Name | Data Type | Suggested Field Type | Action Required | Priority |
|-----------|-----------|---------------------|-----------------|----------|
| created_by | uuid | text | ADD TO CUSTOM FIELDS | MEDIUM |
| linked_contact_id | uuid | text | ADD TO CUSTOM FIELDS | MEDIUM |
| relationship_type | character varying | text | ADD TO CUSTOM FIELDS | MEDIUM |
| interest_type | character varying | text | ADD TO CUSTOM FIELDS | MEDIUM |

### Time-Based Fields (1 field)

| Field Name | Data Type | Suggested Field Type | Action Required | Priority |
|-----------|-----------|---------------------|-----------------|----------|
| converted_date | timestamp with time zone | date | ADD TO CUSTOM FIELDS | HIGH |

---

## 3. Internal Fields (Never Visible) - 3 Fields

These are internal system fields and should NOT be exposed in the UI.

| Field Name | Data Type | Purpose | Visibility |
|-----------|-----------|---------|-----------|
| id | uuid | Primary Key | HIDDEN |
| organization_id | uuid | Organization Reference | HIDDEN |
| custom_fields | jsonb | Dynamic Field Storage | HIDDEN |

---

## 4. Current Custom Fields Definition Status - 3 Fields

These fields are already defined in `custom_field_definitions` table for leads:

| Field Name | Field Type | Field Label | Status |
|-----------|-----------|------------|--------|
| prefer_method | text | prefer method | Active |
| test_field_123 | text | Test Field 123 | Active |
| test_website_url | text | Test Website URL | Active |

---

## 5. Detailed Field Mapping & Recommendations

### CREATE CUSTOM FIELD DEFINITIONS - SQL Script

The following 10 fields need to be added to `custom_field_definitions`:

```sql
-- Address Information Fields
INSERT INTO custom_field_definitions (field_name, field_type, field_label, entity_type, is_required)
VALUES 
  ('address', 'text', 'Address', 'leads', false),
  ('city', 'text', 'City', 'leads', false),
  ('state', 'text', 'State/Province', 'leads', false),
  ('postal_code', 'text', 'Postal Code', 'leads', false),
  ('country', 'text', 'Country', 'leads', false),
  ('created_by', 'text', 'Created By', 'leads', false),
  ('linked_contact_id', 'text', 'Linked Contact ID', 'leads', false),
  ('relationship_type', 'text', 'Relationship Type', 'leads', false),
  ('interest_type', 'text', 'Interest Type', 'leads', false),
  ('converted_date', 'date', 'Converted Date', 'leads', false);
```

---

## 6. Summary Table: All 29 Fields Overview

| Category | Count | Fields | Visibility |
|----------|-------|--------|-----------|
| **System Core** | 16 | first_name, last_name, email, phone, company, title, source, status, priority, assigned_to, notes, created_at, updated_at, last_contact_date, next_follow_up, value | VISIBLE |
| **Address Info** | 5 | address, city, state, postal_code, country | NEEDS DEFINITION |
| **Relationship** | 4 | created_by, linked_contact_id, relationship_type, interest_type | NEEDS DEFINITION |
| **Timeline** | 1 | converted_date | NEEDS DEFINITION |
| **Internal System** | 3 | id, organization_id, custom_fields | HIDDEN |
| **TOTAL** | 29 | — | — |

---

## 7. Implementation Status

### Completed (16 System Fields)
- All core CRM fields are properly visible and functional
- System already supports these fields at the database level
- No action required

### Pending (10 Extended Fields)
- Database columns exist but need custom_field_definitions entries
- Required to make fields visible and manageable in the UI
- Each field has a recommended field_type for proper handling

### Internal Only (3 Fields)
- System-level fields that manage data structure
- Should never be exposed to end users
- Properly hidden

---

## 8. Field Type Classification Details

**Text Fields (8):** address, city, state, postal_code, country, created_by, linked_contact_id, relationship_type, interest_type
- Data Type in DB: character varying or uuid
- UI Field Type: text
- Use for: Single-line text input

**Date Fields (1):** converted_date
- Data Type in DB: timestamp with time zone
- UI Field Type: date
- Use for: Date selection and display

---

## 9. Recommended Implementation Plan

1. **Phase 1: Add Missing Custom Field Definitions (IMMEDIATE)**
   - Execute the provided SQL script to add 10 fields
   - Verify entries in custom_field_definitions table
   - No data migration needed

2. **Phase 2: UI Implementation**
   - Update UI components to display new fields
   - Add field visibility toggles
   - Implement form validation for address fields

3. **Phase 3: Testing**
   - Verify all fields display correctly in forms
   - Test data entry and retrieval
   - Validate date field functionality

---

## 10. Database Connectivity Details

- **Host:** dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com
- **Database:** uppalcrm_devtest
- **User:** uppalcrm_devtest
- **Connection String:** postgresql://uppalcrm_devtest:***@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest
- **SSL Required:** Yes
- **Port:** 5432 (default)

---

## Report Generated
Analysis completed successfully. All 29 columns queried and categorized.
