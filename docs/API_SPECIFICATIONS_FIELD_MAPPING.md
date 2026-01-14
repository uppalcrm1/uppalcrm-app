# Field Mapping API Specifications

**Document Version:** 1.0
**Created:** 2026-01-08
**Base URL:** `/api`
**Authentication:** Required (JWT Bearer Token)

---

## Table of Contents
1. [API Overview](#api-overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Field Mapping Configuration Endpoints](#field-mapping-configuration-endpoints)
4. [Transformation Rules Endpoints](#transformation-rules-endpoints)
5. [Template Endpoints](#template-endpoints)
6. [Conversion Endpoints](#conversion-endpoints)
7. [Analytics & Statistics Endpoints](#analytics--statistics-endpoints)
8. [Error Responses](#error-responses)
9. [Rate Limiting](#rate-limiting)
10. [Webhooks](#webhooks)

---

## API Overview

### Base Endpoint Structure

```
/api/field-mappings/*                   # Field mapping configuration
/api/transformation-rules/*             # Custom transformation logic
/api/field-mapping-templates/*          # Conversion templates
/api/leads/:id/convert                  # Lead conversion (enhanced)
/api/field-mapping-analytics/*          # Statistics and insights
```

### Common Headers

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-Organization-ID: <organization_uuid>  # Optional, extracted from token
```

### Response Format

All responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-01-08T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

---

## Authentication & Authorization

### Required Permissions

| Endpoint | Required Role | Permission |
|----------|--------------|------------|
| GET /field-mappings | User | `field_mappings:read` |
| POST/PUT/DELETE /field-mappings | Admin | `field_mappings:write` |
| GET /transformation-rules | User | `transformations:read` |
| POST/PUT/DELETE /transformation-rules | Admin | `transformations:write` |
| GET /field-mapping-templates | User | `templates:read` |
| POST /field-mapping-templates | Admin | `templates:write` |
| POST /leads/:id/convert | User | `leads:convert` |

---

## Field Mapping Configuration Endpoints

### 1. Get All Field Mappings

**GET** `/api/field-mappings`

Retrieve all field mapping configurations for the organization.

**Query Parameters:**

```typescript
{
  target_entity?: 'contacts' | 'accounts' | 'transactions';
  is_active?: boolean;
  include_system?: boolean;  // Include system mappings
  page?: number;             // Default: 1
  limit?: number;            // Default: 100
  search?: string;           // Search by field names
}
```

**Request Example:**

```http
GET /api/field-mappings?target_entity=contacts&is_active=true
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "mappings": [
      {
        "id": "mapping_123",
        "source_entity": "leads",
        "source_field": "first_name",
        "source_field_type": "text",
        "source_field_path": null,
        "target_entity": "contacts",
        "target_field": "first_name",
        "target_field_type": "text",
        "target_field_path": null,
        "is_active": true,
        "is_system_mapping": true,
        "is_editable_on_convert": true,
        "is_required_on_convert": true,
        "is_visible_on_convert": true,
        "transformation_type": "none",
        "transformation_rule_id": null,
        "default_value": null,
        "default_value_type": "static",
        "display_order": 1,
        "display_label": "First Name",
        "help_text": "Contact's first name",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z"
      },
      {
        "id": "mapping_124",
        "source_entity": "leads",
        "source_field": "app",
        "source_field_type": "text",
        "source_field_path": "custom_fields.app",
        "target_entity": "contacts",
        "target_field": "app",
        "target_field_type": "text",
        "target_field_path": "custom_fields.app",
        "is_active": true,
        "is_system_mapping": false,
        "is_editable_on_convert": true,
        "is_required_on_convert": false,
        "is_visible_on_convert": true,
        "transformation_type": "lowercase",
        "transformation_rule_id": null,
        "default_value": "smart_stb",
        "default_value_type": "static",
        "display_order": 5,
        "display_label": "App",
        "help_text": "Application platform",
        "created_at": "2026-01-05T12:00:00Z",
        "updated_at": "2026-01-05T12:00:00Z"
      }
    ],
    "pagination": {
      "total": 12,
      "page": 1,
      "limit": 100,
      "pages": 1
    },
    "summary": {
      "total_mappings": 12,
      "active_mappings": 10,
      "system_mappings": 4,
      "custom_mappings": 8
    }
  },
  "meta": {
    "timestamp": "2026-01-08T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

---

### 2. Get Single Field Mapping

**GET** `/api/field-mappings/:id`

Retrieve a specific field mapping by ID.

**Response Example:**

```json
{
  "success": true,
  "data": {
    "mapping": {
      "id": "mapping_124",
      "source_entity": "leads",
      "source_field": "app",
      // ... full mapping details
    }
  }
}
```

---

### 3. Create Field Mapping

**POST** `/api/field-mappings`

Create a new field mapping configuration.

**Request Body:**

```json
{
  "source_entity": "leads",
  "source_field": "industry",
  "source_field_type": "select",
  "source_field_path": "custom_fields.industry",
  "target_entity": "contacts",
  "target_field": "industry",
  "target_field_type": "select",
  "target_field_path": "custom_fields.industry",
  "is_editable_on_convert": true,
  "is_required_on_convert": false,
  "is_visible_on_convert": true,
  "transformation_type": "none",
  "default_value": null,
  "display_order": 10,
  "display_label": "Industry",
  "help_text": "Contact's industry vertical"
}
```

**Validation Rules:**

- `source_field` and `target_field` are required
- `source_entity` must be 'leads', 'contacts', or 'accounts'
- `target_entity` must be 'contacts', 'accounts', or 'transactions'
- Cannot duplicate existing mapping (same source → target)
- Field types should be compatible (text → text, number → number, etc.)

**Response Example (Success):**

```json
{
  "success": true,
  "data": {
    "mapping": {
      "id": "mapping_125",
      "source_entity": "leads",
      "source_field": "industry",
      // ... full mapping details
    }
  },
  "meta": {
    "message": "Field mapping created successfully"
  }
}
```

**Response Example (Validation Error):**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "target_field",
        "message": "This target field is already mapped from another source",
        "existing_mapping_id": "mapping_122"
      }
    ]
  }
}
```

---

### 4. Update Field Mapping

**PUT** `/api/field-mappings/:id`

Update an existing field mapping.

**Request Body:**

```json
{
  "is_editable_on_convert": false,
  "is_required_on_convert": true,
  "transformation_type": "lowercase",
  "display_order": 8,
  "help_text": "Updated help text"
}
```

**Notes:**
- Cannot update `source_field` or `target_field` (must delete and recreate)
- Cannot modify system mappings (where `is_system_mapping = true`)
- Partial updates allowed (only send fields to change)

**Response Example:**

```json
{
  "success": true,
  "data": {
    "mapping": {
      "id": "mapping_124",
      // ... updated mapping details
    }
  },
  "meta": {
    "message": "Field mapping updated successfully"
  }
}
```

---

### 5. Delete Field Mapping

**DELETE** `/api/field-mappings/:id`

Delete a field mapping configuration.

**Request Example:**

```http
DELETE /api/field-mappings/mapping_124
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "deleted_id": "mapping_124"
  },
  "meta": {
    "message": "Field mapping deleted successfully"
  }
}
```

**Error Response (System Mapping):**

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Cannot delete system mapping",
    "details": "System mappings are required and cannot be removed"
  }
}
```

---

### 6. Bulk Update Field Mappings

**PATCH** `/api/field-mappings/bulk`

Update multiple field mappings at once (useful for reordering).

**Request Body:**

```json
{
  "updates": [
    {
      "id": "mapping_123",
      "display_order": 1
    },
    {
      "id": "mapping_124",
      "display_order": 2,
      "is_visible_on_convert": false
    },
    {
      "id": "mapping_125",
      "display_order": 3
    }
  ]
}
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "updated_count": 3,
    "updated_ids": ["mapping_123", "mapping_124", "mapping_125"]
  }
}
```

---

### 7. Get Available Source Fields

**GET** `/api/field-mappings/available-sources`

Get list of available lead fields that can be used as mapping sources.

**Query Parameters:**

```typescript
{
  entity?: 'leads' | 'contacts' | 'accounts';  // Default: 'leads'
  include_custom?: boolean;                     // Default: true
  unmapped_only?: boolean;                      // Only show unmapped fields
}
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "fields": [
      {
        "field_name": "first_name",
        "field_type": "text",
        "field_path": null,
        "is_custom": false,
        "is_required": true,
        "is_mapped": true,
        "mapped_to": "contacts.first_name"
      },
      {
        "field_name": "app",
        "field_type": "text",
        "field_path": "custom_fields.app",
        "is_custom": true,
        "is_required": false,
        "is_mapped": true,
        "mapped_to": "contacts.app"
      },
      {
        "field_name": "budget",
        "field_type": "number",
        "field_path": "custom_fields.budget",
        "is_custom": true,
        "is_required": false,
        "is_mapped": false,
        "mapped_to": null
      }
    ],
    "summary": {
      "total_fields": 15,
      "standard_fields": 8,
      "custom_fields": 7,
      "mapped_fields": 12,
      "unmapped_fields": 3
    }
  }
}
```

---

### 8. Get Available Target Fields

**GET** `/api/field-mappings/available-targets`

Get list of available target fields for a given entity and source field type.

**Query Parameters:**

```typescript
{
  target_entity: 'contacts' | 'accounts' | 'transactions';  // Required
  source_field_type: string;                                 // Filter compatible types
  unmapped_only?: boolean;
}
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "fields": [
      {
        "field_name": "first_name",
        "field_type": "text",
        "field_path": null,
        "is_custom": false,
        "is_available": false,
        "reason": "Already mapped from leads.first_name"
      },
      {
        "field_name": "description",
        "field_type": "longtext",
        "field_path": null,
        "is_custom": false,
        "is_available": true,
        "is_compatible": true
      },
      {
        "field_name": "app",
        "field_type": "text",
        "field_path": "custom_fields.app",
        "is_custom": true,
        "is_available": true,
        "is_compatible": true
      }
    ]
  }
}
```

---

### 9. Validate Field Mapping

**POST** `/api/field-mappings/validate`

Validate a field mapping configuration before saving.

**Request Body:**

```json
{
  "source_field": "app",
  "source_field_type": "text",
  "target_entity": "contacts",
  "target_field": "app",
  "target_field_type": "text",
  "transformation_type": "lowercase"
}
```

**Response Example (Valid):**

```json
{
  "success": true,
  "data": {
    "is_valid": true,
    "warnings": [
      "Source field 'app' contains 87% non-null values"
    ],
    "suggestions": [
      "Consider making this field visible during conversion"
    ]
  }
}
```

**Response Example (Invalid):**

```json
{
  "success": true,
  "data": {
    "is_valid": false,
    "errors": [
      "Field types are incompatible: text cannot map to number",
      "Target field 'app' is already mapped from 'application'"
    ],
    "warnings": []
  }
}
```

---

### 10. Preview Conversion Modal

**POST** `/api/field-mappings/preview`

Generate a preview of how the conversion modal will look with current mappings.

**Request Body:**

```json
{
  "lead_id": "lead_123",  // Optional: Use specific lead for realistic preview
  "target_entities": ["contacts", "accounts", "transactions"]
}
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "preview": {
      "contact": {
        "fields": [
          {
            "field_name": "first_name",
            "display_label": "First Name",
            "field_type": "text",
            "is_required": true,
            "is_editable": true,
            "pre_populated_value": "John",
            "source": "Mapped from lead.first_name",
            "help_text": "Contact's first name"
          },
          {
            "field_name": "app",
            "display_label": "App",
            "field_type": "text",
            "is_required": false,
            "is_editable": true,
            "pre_populated_value": "smart_stb",
            "source": "Mapped from lead.app (lowercase)",
            "help_text": "Application platform"
          }
        ]
      },
      "account": {
        "fields": [...]
      },
      "transaction": {
        "fields": [...]
      }
    },
    "sample_lead": {
      "id": "lead_123",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "custom_fields": {
        "app": "Smart_STB"
      }
    }
  }
}
```

---

## Transformation Rules Endpoints

### 1. Get All Transformation Rules

**GET** `/api/transformation-rules`

Retrieve all custom transformation rules for the organization.

**Response Example:**

```json
{
  "success": true,
  "data": {
    "rules": [
      {
        "id": "rule_123",
        "rule_name": "Smart App Normalizer",
        "description": "Normalizes various app name formats",
        "transformation_code": "function transform(value, leadData) { ... }",
        "is_validated": true,
        "validation_error": null,
        "input_type": "text",
        "output_type": "text",
        "usage_count": 45,
        "last_used_at": "2026-01-07T15:30:00Z",
        "created_at": "2026-01-01T00:00:00Z"
      }
    ]
  }
}
```

---

### 2. Create Transformation Rule

**POST** `/api/transformation-rules`

Create a new custom transformation rule.

**Request Body:**

```json
{
  "rule_name": "Phone Formatter",
  "description": "Formats phone numbers to E.164 format",
  "transformation_code": "function transform(value, leadData) {\n  if (!value) return null;\n  // Remove all non-digits\n  const digits = value.replace(/\\D/g, '');\n  // Format as +1-XXX-XXX-XXXX\n  return `+1-${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;\n}",
  "input_type": "text",
  "output_type": "text"
}
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "rule": {
      "id": "rule_124",
      "rule_name": "Phone Formatter",
      "is_validated": true,
      "validation_error": null,
      // ... full rule details
    }
  },
  "meta": {
    "message": "Transformation rule created and validated successfully"
  }
}
```

**Response Example (Validation Failed):**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Transformation code validation failed",
    "details": {
      "syntax_errors": [
        "SyntaxError: Unexpected token ) at line 3"
      ],
      "security_violations": [
        "Attempted to use restricted function: eval()"
      ]
    }
  }
}
```

---

### 3. Test Transformation Rule

**POST** `/api/transformation-rules/:id/test`

Test a transformation rule with sample data.

**Request Body:**

```json
{
  "test_value": "Smart_STB_App",
  "sample_lead_data": {
    "first_name": "John",
    "last_name": "Doe",
    "custom_fields": {
      "industry": "Technology"
    }
  }
}
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "input": "Smart_STB_App",
    "output": "smart_stb_app",
    "execution_time_ms": 2,
    "errors": null,
    "warnings": null
  }
}
```

---

### 4. Delete Transformation Rule

**DELETE** `/api/transformation-rules/:id`

Delete a transformation rule.

**Notes:**
- Cannot delete if rule is currently used by any field mapping
- Must first remove rule from all mappings

**Response Example (In Use):**

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Cannot delete transformation rule that is in use",
    "details": {
      "used_by_mappings": [
        {
          "mapping_id": "mapping_124",
          "source_field": "app",
          "target_field": "app"
        }
      ]
    }
  }
}
```

---

## Template Endpoints

### 1. Get All Templates

**GET** `/api/field-mapping-templates`

Get all available templates (system + organization templates).

**Query Parameters:**

```typescript
{
  template_type?: 'system' | 'industry' | 'custom';
  is_active?: boolean;
}
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "template_123",
        "template_name": "Full Conversion",
        "template_slug": "full-conversion",
        "description": "Create contact, account, and initial transaction",
        "template_type": "system",
        "is_system_template": true,
        "applies_to_entities": ["contacts", "accounts", "transactions"],
        "icon": "users-check",
        "color": "#3B82F6",
        "usage_count": 1250,
        "is_active": true,
        "field_count": 15
      },
      {
        "id": "template_124",
        "template_name": "Contact Only",
        "template_slug": "contact-only",
        "description": "Convert lead to contact without account",
        "template_type": "system",
        "is_system_template": true,
        "applies_to_entities": ["contacts"],
        "icon": "user-plus",
        "color": "#10B981",
        "usage_count": 350,
        "is_active": true,
        "field_count": 8
      }
    ]
  }
}
```

---

### 2. Get Template Details

**GET** `/api/field-mapping-templates/:id`

Get detailed template configuration including all field mappings.

**Response Example:**

```json
{
  "success": true,
  "data": {
    "template": {
      "id": "template_123",
      "template_name": "Full Conversion",
      // ... template details
    },
    "field_mappings": [
      {
        "id": "template_item_1",
        "source_field": "first_name",
        "target_entity": "contacts",
        "target_field": "first_name",
        "is_required": true,
        "is_editable": true,
        "transformation_type": "none",
        "display_order": 1
      },
      // ... more field mappings
    ]
  }
}
```

---

### 3. Apply Template to Organization

**POST** `/api/field-mapping-templates/:id/apply`

Apply a template's field mappings to the current organization.

**Request Body:**

```json
{
  "override_existing": false,  // If true, replaces existing mappings
  "field_mappings_to_include": [  // Optional: Only apply specific fields
    "first_name",
    "last_name",
    "email"
  ]
}
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "applied_mappings": 12,
    "skipped_mappings": 3,
    "skipped_reasons": [
      {
        "field": "phone",
        "reason": "Already mapped with different configuration"
      }
    ]
  },
  "meta": {
    "message": "Template applied successfully"
  }
}
```

---

### 4. Create Custom Template

**POST** `/api/field-mapping-templates`

Create a custom template from current field mappings.

**Request Body:**

```json
{
  "template_name": "SaaS Customer Conversion",
  "description": "Template for converting SaaS trial leads to customers",
  "template_type": "custom",
  "applies_to_entities": ["contacts", "accounts", "transactions"],
  "icon": "rocket",
  "color": "#8B5CF6",
  "source_mappings": [
    "mapping_123",
    "mapping_124",
    "mapping_125"
  ]
}
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "template": {
      "id": "template_125",
      "template_name": "SaaS Customer Conversion",
      // ... full template details
    }
  }
}
```

---

## Conversion Endpoints

### Enhanced Lead Conversion

**POST** `/api/leads/:id/convert`

Convert a lead using field mappings (enhanced existing endpoint).

**Request Body:**

```json
{
  "use_field_mappings": true,  // Use configured mappings
  "template_id": "template_123",  // Optional: Use specific template
  "contact_mode": "new",  // 'new' or 'existing'
  "contact": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "+1-555-0123",
    "custom_fields": {
      "app": "smart_stb",  // Can override mapped value
      "industry": "Technology"
    }
  },
  "create_account": true,
  "account": {
    "account_name": "John Doe's Account",
    "product_id": "product_123",
    "device_name": "Device 001",
    "mac_address": "00:00:00:00:00:00",
    "custom_fields": {
      "app": "smart_stb"
    }
  },
  "create_transaction": true,
  "transaction": {
    "payment_method": "Credit Card",
    "amount": 49.99,
    "currency": "CAD"
  },
  "field_overrides": {
    // Explicitly override specific field mappings
    "contacts.app": "custom_value"
  }
}
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "conversion": {
      "lead_id": "lead_123",
      "contact_id": "contact_456",
      "account_id": "account_789",
      "transaction_id": "transaction_012",
      "converted_at": "2026-01-08T10:30:00Z"
    },
    "field_mappings_applied": {
      "total": 12,
      "auto_populated": 10,
      "user_edited": 2,
      "details": [
        {
          "mapping_id": "mapping_123",
          "field": "first_name",
          "source_value": "John",
          "mapped_value": "John",
          "final_value": "John",
          "was_edited": false
        },
        {
          "mapping_id": "mapping_124",
          "field": "app",
          "source_value": "Smart_STB",
          "mapped_value": "smart_stb",
          "final_value": "smart_stb",
          "was_edited": false,
          "transformation_applied": "lowercase"
        }
      ]
    }
  },
  "meta": {
    "message": "Lead converted successfully with field mappings applied"
  }
}
```

---

## Analytics & Statistics Endpoints

### 1. Get Mapping Statistics

**GET** `/api/field-mapping-analytics/statistics`

Get usage statistics for field mappings.

**Query Parameters:**

```typescript
{
  period_start?: string;  // ISO date
  period_end?: string;    // ISO date
  mapping_id?: string;    // Specific mapping
}
```

**Response Example:**

```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-01-01",
      "end": "2026-01-08"
    },
    "statistics": [
      {
        "mapping_id": "mapping_124",
        "field_name": "app",
        "times_used": 145,
        "times_edited": 23,
        "times_skipped": 5,
        "edit_rate": 15.86,
        "success_rate": 96.55,
        "most_common_value": "smart_stb",
        "value_variance": 8
      }
    ],
    "summary": {
      "total_conversions": 150,
      "avg_edit_rate": 12.5,
      "avg_success_rate": 98.2
    }
  }
}
```

---

### 2. Get Unmapped Fields Report

**GET** `/api/field-mapping-analytics/unmapped-fields`

Get report of lead fields that aren't mapped.

**Response Example:**

```json
{
  "success": true,
  "data": {
    "unmapped_fields": [
      {
        "field_name": "budget",
        "field_type": "number",
        "usage_in_leads": {
          "total_leads": 1000,
          "non_null_count": 450,
          "non_null_percentage": 45.0
        },
        "suggested_targets": [
          {
            "entity": "contacts",
            "field": "annual_revenue",
            "compatibility": "high"
          }
        ]
      }
    ]
  }
}
```

---

### 3. Get Conversion Effectiveness

**GET** `/api/field-mapping-analytics/effectiveness`

Analyze effectiveness of field mappings.

**Response Example:**

```json
{
  "success": true,
  "data": {
    "effectiveness": {
      "overall_score": 85.5,
      "metrics": {
        "data_completeness": 92.3,
        "user_satisfaction": 78.7,
        "time_saved": "45%"
      },
      "recommendations": [
        {
          "priority": "high",
          "suggestion": "Make 'app' field required - 87% of leads have this value",
          "mapping_id": "mapping_124"
        },
        {
          "priority": "medium",
          "suggestion": "Consider default value for 'payment_method' - users edit this 78% of the time",
          "mapping_id": "mapping_145"
        }
      ]
    }
  }
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional context or validation errors",
    "request_id": "req_abc123"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `CONFLICT` | 409 | Resource conflict (duplicate mapping) |
| `INTERNAL_ERROR` | 500 | Server error |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

---

## Rate Limiting

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704710400
```

### Limits

| Endpoint Type | Limit |
|--------------|-------|
| Read operations (GET) | 1000/hour |
| Write operations (POST/PUT/DELETE) | 100/hour |
| Analytics | 500/hour |
| Conversion | 200/hour |

---

## Webhooks

### Field Mapping Events

Organizations can subscribe to webhooks for field mapping events:

```json
{
  "event": "field_mapping.created",
  "timestamp": "2026-01-08T10:30:00Z",
  "organization_id": "org_123",
  "data": {
    "mapping_id": "mapping_124",
    "source_field": "app",
    "target_field": "app"
  }
}
```

**Available Events:**
- `field_mapping.created`
- `field_mapping.updated`
- `field_mapping.deleted`
- `transformation_rule.created`
- `template.applied`
- `conversion.completed` (includes field mapping data)

---

## Next Steps

These API specifications are ready for:

1. ✅ **Backend Implementation**: Build route handlers
2. ✅ **Frontend Integration**: Connect to UI components
3. ✅ **Testing**: Create API tests
4. ✅ **Documentation**: Generate OpenAPI/Swagger docs

Would you like me to:
- Implement the backend routes and controllers?
- Create the frontend API client service?
- Generate OpenAPI/Swagger specification?
- Build test suites for the APIs?
