# Custom Field Visibility System Guide

## Overview
The custom_field_definitions table implements a comprehensive visibility system for managing how custom fields appear in the CRM UI across different contexts.

---

## Visibility Control Components

### 1. Overall Visibility (Master Switch)
Column: overall_visibility
Type: character varying (enum-like)
Default: 'visible'

Possible Values:
- 'visible' - Field is generally accessible
- 'hidden' - Field is hidden from UI but may exist in data

---

### 2. Visibility Logic (Control Strategy)
Column: visibility_logic
Type: character varying
Default: 'master_override'

Current Values:
- 'master_override' - Overall visibility takes precedence

---

### 3. Form/View Flags (Granular Controls)
Type: boolean (individual toggles)

| Flag | Purpose | Default | Use Case |
|---|---|---|---|
| show_in_create_form | Display in new record form | true | Can set field on creation |
| show_in_edit_form | Display in record edit form | true | Can modify field |
| show_in_detail_view | Display in record detail view | true | Can see field value |
| show_in_list_view | Display in list/table view | false | Shows in record list |

---

## Current Implementation Pattern

Hierarchy:
1. Overall Visibility Check (Master Override)
   - If 'hidden' -> field hidden everywhere
   - If 'visible' -> proceed to next step

2. Visibility Logic Evaluation (master_override)
   - Master override takes precedence

3. Form/View Flags Evaluation
   - Check individual show_in_* flags

---

## Entity Types Currently Supported

1. leads (3 custom fields defined)
   - prefer_method
   - test_field_123
   - test_website_url

2. accounts (1 custom field defined)

3. contacts (1 custom field defined)

---

## Current Data Pattern

All leads fields have:
- form/view flags set to false (all contexts)
- overall_visibility varies (some 'visible', some 'hidden')
- This suggests visibility is controlled elsewhere or conditionally

---

## Other Visibility-Related Fields

### is_enabled
Type: boolean
Default: true
Purpose: Activate/deactivate field without removing it

### is_required
Type: boolean
Default: false
Purpose: Determines if field must be filled in forms

### created_by, created_at, updated_at
Purpose: Audit trail for visibility configuration changes

---

## Best Practices

1. Use overall_visibility for broad control
2. Use form flags for context-specific control
3. Only mark is_required if field is shown
4. Document visibility rules in field_options
5. Test all visibility combinations
6. Track visibility changes via audit fields

---

## Database Queries

Find all hidden fields:
SELECT * FROM custom_field_definitions WHERE overall_visibility = 'hidden';

Find fields shown in list view:
SELECT * FROM custom_field_definitions WHERE show_in_list_view = true;

Find required fields for leads:
SELECT * FROM custom_field_definitions WHERE entity_type = 'leads' AND is_required = true;

---

## Future Enhancements

- Conditional visibility based on field values
- Role-based visibility logic
- Permission-based access control
- Use field_options JSONB for complex rules

