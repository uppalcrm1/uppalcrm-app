# Database Analysis - Complete Index

## Analysis Date
January 24, 2026

## Database Analyzed
- **Host:** dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com
- **Database:** uppalcrm_devtest
- **Table:** custom_field_definitions
- **Records Analyzed:** 5 custom field definitions

---

## Generated Files

### 1. DATABASE_ANALYSIS.md
**Primary comprehensive analysis document**
- Complete table schema (19 columns)
- Sample data for each entity type
- Field counts per organization
- Unique field names analysis
- Visibility infrastructure overview
- Key findings and recommendations

**Use this file for:** Complete understanding of the table structure and contents

---

### 2. VISIBILITY_SYSTEM_GUIDE.md
**Implementation guide for visibility controls**
- Visibility control components explained
- Form/view flag purposes and defaults
- Hierarchy of visibility logic
- Best practices for implementation
- Database query examples
- Future enhancement suggestions

**Use this file for:** Building or enhancing UI visibility logic

---

### 3. QUERIES.sql
**Reusable PostgreSQL queries**
- 15+ documented queries
- Query descriptions and expected results
- Ranging from simple schemas to complex visibility breakdowns
- Ready-to-run against the database

**Use this file for:** Direct database querying and validation

---

## Quick Summary

### Table Structure
- 19 columns including UUID, text, boolean, JSONB, and timestamp types
- Primary ID: uuid (auto-generated)
- Org-scoped: organization_id (required)
- Audit trail: created_at, updated_at, created_by

### Data Overview
```
Total Records: 5
Organizations: 1 (4af68759-65cf-4b38-8fd5-e6f41d7a726f)
Entity Types: 3
  - leads: 3 fields
  - accounts: 1 field
  - contacts: 1 field
Field Types: text only (5 fields)
Visibility States: 2 hidden, 3 visible
```

### Visibility System
The system uses a two-tier approach:
1. **Overall Visibility** (master switch)
   - Values: 'visible' or 'hidden'
   - Default: 'visible'

2. **Form/View Flags** (granular controls)
   - show_in_create_form (default: true)
   - show_in_edit_form (default: true)
   - show_in_detail_view (default: true)
   - show_in_list_view (default: false)

### Current Leads Fields
| Field | Overall Visibility | All Form Flags |
|---|---|---|
| prefer_method | visible | false |
| test_field_123 | hidden | false |
| test_website_url | hidden | false |

Note: All form/view flags are false despite visibility differences, suggesting external or conditional control

---

## Key Findings

1. **Single Organization** - All data belongs to one org
2. **Mostly Leads** - 60% of fields are for leads entity type
3. **Simple Field Types** - Only text fields currently used
4. **No Hidden Visibility Tables** - Visibility is inline in the main table
5. **Unused JSONB** - field_options is empty but available for future rules
6. **Master Override** - All records use 'master_override' logic
7. **Form Visibility Disabled** - All leads fields have form/view flags = false

---

## Related Tables Found

During analysis, visibility-related columns were found in:
- custom_field_definitions (main table)
- default_field_configurations
- field_mapping_configurations

Future work may require analyzing these related tables.

---

## How to Use These Documents

### For Database Developers
1. Start with DATABASE_ANALYSIS.md for schema understanding
2. Use QUERIES.sql for direct data access
3. Refer to VISIBILITY_SYSTEM_GUIDE.md for implementation details

### For Frontend Developers
1. Read VISIBILITY_SYSTEM_GUIDE.md first
2. Understand the two-tier visibility approach
3. Use the provided pseudo-code examples for implementation
4. Validate with queries from QUERIES.sql

### For Data Analysts
1. Use QUERIES.sql for custom analysis
2. Modify queries to explore specific scenarios
3. Cross-reference with DATABASE_ANALYSIS.md for column meanings

### For System Architects
1. Review all three documents
2. Note the planned visibility_logic expansion opportunities
3. Consider field_options JSONB for future conditional rules
4. Plan for additional entity types and field types

---

## Connection Details for Future Access

```
Connection String:
postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest

Requirements:
- SSL enabled (rejectUnauthorized: false for Node.js)
- PostgreSQL 13+ for full feature support
- JSONB support required
- UUID extension enabled
```

---

## Next Steps Recommendations

1. **Analyze Related Tables**
   - default_field_configurations
   - field_mapping_configurations
   - Any permission/role tables

2. **Understand Visibility Logic Implementation**
   - Where are show_in_* flags actually used?
   - How does master_override work in code?
   - Are there conditional visibility rules elsewhere?

3. **Plan Visibility Enhancements**
   - Conditional visibility based on field values
   - Role-based visibility
   - Permission-based access control

4. **Field Type Expansion**
   - Currently only 'text' fields
   - Plan for select, multiselect, date, number, etc.
   - Document field type validation rules

5. **Documentation**
   - Create API documentation for field definitions
   - Document UI implementation patterns
   - Create user guide for field management

---

## Questions & Clarifications Needed

1. Why are all leads field form/view flags false?
   - Are they managed conditionally in code?
   - Is there another visibility control layer?

2. What is the actual behavior difference between overall_visibility and form flags?
   - Which takes precedence in the current implementation?

3. Are there any conditional visibility rules currently implemented?
   - In field_options or elsewhere?

4. What are the other 2 custom field definitions (non-leads)?
   - Which organization owns accounts and contacts fields?

---

## File Locations
- DATABASE_ANALYSIS.md - Complete schema and data analysis
- VISIBILITY_SYSTEM_GUIDE.md - Visibility implementation guide
- QUERIES.sql - Reusable SQL queries
- DATABASE_ANALYSIS_INDEX.md - This file

---

Generated with PostgreSQL + Node.js pg client
Analysis by Claude Code
