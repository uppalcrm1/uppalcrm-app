# PostgreSQL Database Analysis: custom_field_definitions Table

## Overview
Successfully connected to devtest PostgreSQL database and analyzed the `custom_field_definitions` table structure and data.

---

## 1. Table Schema (Columns & Data Types)

The `custom_field_definitions` table contains **19 columns**:

| # | Column Name | Data Type | Nullable | Default |
|---|---|---|---|---|
| 1 | id | uuid | NO | uuid_generate_v4() |
| 2 | organization_id | uuid | NO | - |
| 3 | field_name | character varying | NO | - |
| 4 | field_label | character varying | NO | - |
| 5 | field_type | character varying | NO | - |
| 6 | field_options | jsonb | YES | - |
| 7 | is_required | boolean | YES | false |
| 8 | is_enabled | boolean | YES | true |
| 9 | sort_order | integer | YES | 0 |
| 10 | created_at | timestamp with time zone | YES | now() |
| 11 | updated_at | timestamp with time zone | YES | now() |
| 12 | created_by | uuid | YES | - |
| 13 | entity_type | character varying | YES | 'leads' |
| 14 | show_in_create_form | boolean | YES | true |
| 15 | show_in_edit_form | boolean | YES | true |
| 16 | show_in_detail_view | boolean | YES | true |
| 17 | show_in_list_view | boolean | YES | false |
| 18 | overall_visibility | character varying | YES | 'visible' |
| 19 | visibility_logic | character varying | YES | 'master_override' |

---

## 2. Sample Data for entity_type = 'leads'

**Total rows for leads: 3**

| field_name | field_label | field_type | overall_visibility | show_in_create_form | show_in_edit_form | show_in_detail_view | show_in_list_view |
|---|---|---|---|---|---|---|---|
| test_website_url | Test Website URL | text | hidden | false | false | false | false |
| test_field_123 | Test Field 123 | text | hidden | false | false | false | false |
| prefer_method | prefer method | text | visible | false | false | false | false |

---

## 3. Field Definitions Count per Organization

| organization_id | field_count |
|---|---|
| 4af68759-65cf-4b38-8fd5-e6f41d7a726f | 5 |

**Note:** Only one organization has custom field definitions in the database.

---

## 4. Unique Field Names for entity_type = 'leads'

1. prefer_method
2. test_field_123
3. test_website_url

---

## 5. Visibility Infrastructure

### 5.1 Visibility-Related Tables
**Result:** No dedicated visibility tables found. Visibility is managed through columns within the `custom_field_definitions` table itself.

### 5.2 Visibility-Related Columns (Across Database)
Found in multiple tables:

| Table | Column | Data Type |
|---|---|---|
| custom_field_definitions | overall_visibility | character varying |
| custom_field_definitions | visibility_logic | character varying |
| default_field_configurations | overall_visibility | character varying |
| default_field_configurations | visibility_logic | character varying |
| field_mapping_configurations | is_visible_on_convert | boolean |

---

## 6. Visibility Implementation Details

### Visibility Control Structure in custom_field_definitions

The table uses a **hybrid visibility approach** with two main components:

#### A. Form/View Visibility Flags (Boolean)
- **show_in_create_form** (default: true) - Controls visibility in create forms
- **show_in_edit_form** (default: true) - Controls visibility in edit forms
- **show_in_detail_view** (default: true) - Controls visibility in detail/record views
- **show_in_list_view** (default: false) - Controls visibility in list/table views

#### B. Overall Visibility Settings (Enum-like)
- **overall_visibility** - Can be 'visible' or 'hidden'
- **visibility_logic** - Currently only contains 'master_override'

### Current Values Distribution:

**Overall Visibility Values:**
- hidden: 2 occurrences
- visible: 3 occurrences

**Visibility Logic Values:**
- master_override: 5 occurrences (all records)

---

## 7. Entity Types Currently Defined

| entity_type | count |
|---|---|
| leads | 3 |
| accounts | 1 |
| contacts | 1 |

---

## 8. Field Types in Use

| field_type | count |
|---|---|
| text | 5 |

---

## 9. Additional Metadata

### Form & View Visibility Breakdown (for leads)

| field_name | create | edit | detail | list | overall_visibility |
|---|---|---|---|---|---|
| prefer_method | false | false | false | false | visible |
| test_field_123 | false | false | false | false | hidden |
| test_website_url | false | false | false | false | hidden |

**Key Observation:** All leads fields have all form/view flags set to false, suggesting they may be managed through a conditional/dynamic visibility system.

---

## 10. Key Findings

1. **Single Organization:** The database currently has data for only one organization (4af68759-65cf-4b38-8fd5-e6f41d7a726f)

2. **Mostly Leads Fields:** 3 out of 5 custom fields are for leads entity type

3. **Text-Only Fields:** All custom fields are of type 'text' - no other field types currently in use

4. **Visibility Logic:** 
   - Uses both granular (form/view-specific) and overall visibility flags
   - All records use 'master_override' logic, suggesting a cascading visibility system
   - No dedicated visibility tables - all inline

5. **Hidden Fields:** 2 out of 3 leads fields are marked as 'hidden' overall

6. **Form Visibility:** All leads fields have form/view visibility turned off, but they still exist in the database

7. **Default Behaviors:**
   - Fields default to 'visible' overall
   - Fields default to showing in create/edit/detail forms but NOT in list views
   - Form visibility flags appear to override overall visibility in some cases

---

## 11. Visibility Logic Diagram

```
Custom Field Definition
│
├─ Overall Visibility: 'visible' | 'hidden'
│  └─ Applies master-level control
│
├─ Visibility Logic: 'master_override' (only current value)
│  └─ Determines how form/view flags interact with overall visibility
│
└─ Form/View Flags (Granular Controls)
   ├─ show_in_create_form (boolean, default: true)
   ├─ show_in_edit_form (boolean, default: true)
   ├─ show_in_detail_view (boolean, default: true)
   └─ show_in_list_view (boolean, default: false)
```

---

## 12. Data Integrity

### Current State Summary
- Total custom field definitions: 5
- Organizations with definitions: 1
- Entity types defined: 3 (leads, accounts, contacts)
- Field visibility states: 2 hidden, 3 visible
- All fields using master_override logic

---

## 13. Database Connection Details

- **Host:** dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com
- **Database:** uppalcrm_devtest
- **SSL Required:** Yes (enforced by Render hosting)
- **Connection Status:** Verified and working

---

## 14. Recommendations for Implementation

1. **Visibility System:** The current implementation is clean and separates concerns:
   - Use `overall_visibility` for broad access control
   - Use form/view flags for UI-specific visibility
   - Extend `visibility_logic` for complex conditional rules

2. **Field Options (JSONB):** Currently empty but available for:
   - Conditional visibility rules
   - Field-specific metadata
   - UI customization options

3. **Future Enhancements:**
   - Add more field types (select, multiselect, date, number, etc.)
   - Implement conditional visibility rules in field_options
   - Add role-based visibility logic
   - Create dedicated visibility rules table if needed

4. **Documentation:**
   - Document the interaction between overall_visibility and form flags
   - Define the master_override behavior clearly
   - Create UI guidelines for visibility controls

---

## Generated
Date: 2026-01-24
Analysis Tool: PostgreSQL + Node.js pg client
