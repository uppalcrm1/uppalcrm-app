const db = require('../database/connection')

class CustomField {
  // ========================================
  // FIELD DEFINITIONS - CRUD METHODS
  // ========================================

  /**
   * Get all custom field definitions for an organization and entity type
   * @param {string} organizationId - Organization UUID
   * @param {string} entityType - Entity type (leads, contacts, accounts, transactions)
   * @param {boolean} activeOnly - Whether to return only active fields
   * @returns {Promise<Array>} Array of field definitions
   */
  static async getFieldDefinitions(organizationId, entityType, activeOnly = true) {
    try {
      console.log(`🔍 CustomField.getFieldDefinitions: org=${organizationId}, entity=${entityType}, activeOnly=${activeOnly}`)

      let query = `
        SELECT
          id,
          organization_id,
          field_name,
          field_label,
          field_description,
          entity_type,
          field_type,
          is_required,
          is_searchable,
          is_filterable,
          display_order,
          show_in_list_view,
          show_in_detail_view,
          show_in_create_form,
          show_in_edit_form,
          validation_rules,
          field_options,
          default_value,
          placeholder,
          field_group,
          is_active,
          created_at,
          updated_at
        FROM custom_field_definitions
        WHERE organization_id = $1 AND entity_type = $2
      `
      const params = [organizationId, entityType]

      if (activeOnly) {
        query += ' AND is_active = true'
      }

      query += ' ORDER BY display_order ASC, created_at ASC'

      console.log('📝 Executing query:', query.substring(0, 100) + '...')
      const result = await db.query(query, params)
      console.log(`✅ Query returned ${result.rows.length} rows`)
      return result.rows
    } catch (error) {
      console.error('❌ Error getting field definitions:', error.message)
      console.error('Error code:', error.code)

      // If table doesn't exist (error code 42P01), return empty array instead of throwing
      if (error.code === '42P01') {
        console.log('⚠️  custom_field_definitions table does not exist yet - returning empty array')
        return []
      }

      throw error
    }
  }

  /**
   * Get a single custom field definition by ID
   * @param {string} fieldId - Field definition UUID
   * @param {string} organizationId - Organization UUID
   * @returns {Promise<Object|null>} Field definition object or null
   */
  static async getFieldDefinitionById(fieldId, organizationId) {
    try {
      const query = `
        SELECT
          id,
          organization_id,
          field_name,
          field_label,
          field_description,
          entity_type,
          field_type,
          is_required,
          is_searchable,
          is_filterable,
          display_order,
          show_in_list_view,
          show_in_detail_view,
          show_in_create_form,
          show_in_edit_form,
          validation_rules,
          field_options,
          default_value,
          placeholder,
          field_group,
          is_active,
          created_at,
          updated_at
        FROM custom_field_definitions
        WHERE id = $1 AND organization_id = $2
      `
      const result = await db.query(query, [fieldId, organizationId])
      return result.rows[0] || null
    } catch (error) {
      console.error('Error getting field definition by ID:', error)
      throw error
    }
  }

  /**
   * Create a new custom field definition
   * @param {Object} fieldData - Field definition data
   * @returns {Promise<Object>} Created field definition
   */
  static async createFieldDefinition(fieldData) {
    try {
      console.log('================================================================================')
      console.log('📊 CustomField.createFieldDefinition - MODEL ENTRY POINT')
      console.log('================================================================================')
      console.log('📊 MODEL RECEIVED - Full fieldData object:')
      console.log(JSON.stringify(fieldData, null, 2))
      console.log('')
      console.log('📊 MODEL RECEIVED fieldOptions type:', typeof fieldData.fieldOptions)
      console.log('📊 MODEL RECEIVED fieldOptions value:', fieldData.fieldOptions)
      console.log('📊 MODEL RECEIVED fieldOptions stringified:', JSON.stringify(fieldData.fieldOptions))
      console.log('📊 MODEL RECEIVED fieldOptions is array?:', Array.isArray(fieldData.fieldOptions))
      if (Array.isArray(fieldData.fieldOptions) && fieldData.fieldOptions.length > 0) {
        console.log('📊 MODEL RECEIVED fieldOptions[0]:', fieldData.fieldOptions[0])
        console.log('📊 MODEL RECEIVED fieldOptions[0] type:', typeof fieldData.fieldOptions[0])
        console.log('📊 MODEL RECEIVED fieldOptions[0] stringified:', JSON.stringify(fieldData.fieldOptions[0]))
      }
      console.log('================================================================================')

      // Accept both camelCase and snake_case naming conventions
      const {
        organizationId, organization_id,
        fieldName, field_name,
        fieldLabel, field_label,
        fieldDescription, field_description,
        entityType, entity_type,
        fieldType, field_type,
        isRequired, is_required = false,
        isSearchable, is_searchable = true,
        isFilterable, is_filterable = true,
        displayOrder, display_order = 0,
        showInListView, show_in_list_view = false,
        showInDetailView, show_in_detail_view = true,
        showInCreateForm, show_in_create_form = true,
        showInEditForm, show_in_edit_form = true,
        validationRules, validation_rules = {},
        fieldOptions, field_options = [],
        defaultValue, default_value = null,
        placeholder,
        fieldGroup, field_group = null,
        createdBy, created_by,
        // Phase 1: Visibility fields
        overall_visibility = 'visible',
        visibility_logic = 'master_override'
      } = fieldData

      // Normalize to camelCase (prefer camelCase, fallback to snake_case)
      const normalizedOrgId = organizationId || organization_id
      const normalizedFieldName = fieldName || field_name
      const normalizedFieldLabel = fieldLabel || field_label
      const normalizedFieldDesc = fieldDescription || field_description
      const normalizedEntityType = entityType || entity_type
      const normalizedFieldType = fieldType || field_type
      const normalizedIsRequired = isRequired !== undefined ? isRequired : is_required
      const normalizedIsSearchable = isSearchable !== undefined ? isSearchable : is_searchable
      const normalizedIsFilterable = isFilterable !== undefined ? isFilterable : is_filterable
      const normalizedDisplayOrder = displayOrder !== undefined ? displayOrder : display_order
      const normalizedShowListView = showInListView !== undefined ? showInListView : show_in_list_view
      const normalizedShowDetailView = showInDetailView !== undefined ? showInDetailView : show_in_detail_view
      const normalizedShowCreateForm = showInCreateForm !== undefined ? showInCreateForm : show_in_create_form
      const normalizedShowEditForm = showInEditForm !== undefined ? showInEditForm : show_in_edit_form
      const normalizedValidationRules = validationRules || validation_rules
      const normalizedFieldOptions = fieldOptions || field_options
      const normalizedDefaultValue = defaultValue !== undefined ? defaultValue : default_value
      const normalizedFieldGroup = fieldGroup || field_group
      const normalizedCreatedBy = createdBy || created_by

      const query = `
        INSERT INTO custom_field_definitions (
          organization_id,
          field_name,
          field_label,
          field_description,
          entity_type,
          field_type,
          is_required,
          is_searchable,
          is_filterable,
          display_order,
          show_in_list_view,
          show_in_detail_view,
          show_in_create_form,
          show_in_edit_form,
          validation_rules,
          field_options,
          default_value,
          placeholder,
          field_group,
          created_by,
          overall_visibility,
          visibility_logic
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb, $17, $18, $19, $20, $21, $22)
        RETURNING *
      `

      // CRITICAL: Log types and values before passing to database
      console.log('🔍 DETAILED INSPECTION BEFORE DB INSERT:')
      console.log('  fieldOptions type:', typeof normalizedFieldOptions)
      console.log('  fieldOptions isArray:', Array.isArray(normalizedFieldOptions))
      console.log('  fieldOptions value:', JSON.stringify(normalizedFieldOptions, null, 2))
      console.log('  fieldOptions raw:', normalizedFieldOptions)
      console.log('  validationRules type:', typeof normalizedValidationRules)
      console.log('  validationRules value:', JSON.stringify(normalizedValidationRules, null, 2))

      console.log('================================================================================')
      console.log('📊 PREPARING DATABASE QUERY')
      console.log('================================================================================')
      console.log('📊 QUERY PARAMETER fieldOptions (raw - no stringify):')
      console.log('  Type:', typeof normalizedFieldOptions)
      console.log('  Is Array:', Array.isArray(normalizedFieldOptions))
      console.log('  Value:', normalizedFieldOptions)
      console.log('')
      console.log('📊 QUERY PARAMETER validationRules (raw - no stringify):')
      console.log('  Type:', typeof normalizedValidationRules)
      console.log('  Value:', normalizedValidationRules)
      console.log('================================================================================')

      // Clean and ensure proper format - handle edge cases where data might already be stringified
      const cleanFieldOptions = Array.isArray(normalizedFieldOptions)
        ? normalizedFieldOptions
        : (typeof normalizedFieldOptions === 'string' ? JSON.parse(normalizedFieldOptions) : (normalizedFieldOptions || []))

      const cleanValidationRules = (normalizedValidationRules && typeof normalizedValidationRules === 'object' && !Array.isArray(normalizedValidationRules))
        ? normalizedValidationRules
        : (typeof normalizedValidationRules === 'string' ? JSON.parse(normalizedValidationRules) : {})

      const values = [
        normalizedOrgId,
        normalizedFieldName,
        normalizedFieldLabel,
        normalizedFieldDesc,
        normalizedEntityType,
        normalizedFieldType,
        normalizedIsRequired,
        normalizedIsSearchable,
        normalizedIsFilterable,
        normalizedDisplayOrder,
        normalizedShowListView,
        normalizedShowDetailView,
        normalizedShowCreateForm,
        normalizedShowEditForm,
        // CRITICAL FIX: Pass raw JavaScript objects/arrays to pg driver
        // The ::jsonb cast in SQL will handle the conversion automatically
        // DO NOT use JSON.stringify - that causes double-stringification!
        cleanValidationRules,  // Raw object
        cleanFieldOptions,     // Raw array
        normalizedDefaultValue,
        placeholder,
        normalizedFieldGroup,
        normalizedCreatedBy,
        // Phase 1: Visibility fields
        overall_visibility,
        visibility_logic
      ]

      console.log('================================================================================')
      console.log('📊 FULL VALUES ARRAY (passed to db.query):')
      console.log('================================================================================')
      console.log(JSON.stringify(values, null, 2))
      console.log('')
      console.log('📊 CRITICAL JSONB PARAMETERS (CLEANED):')
      console.log('  cleanValidationRules:', cleanValidationRules)
      console.log('  cleanValidationRules type:', typeof cleanValidationRules)
      console.log('  cleanValidationRules is object?:', typeof cleanValidationRules === 'object')
      console.log('  cleanFieldOptions:', cleanFieldOptions)
      console.log('  cleanFieldOptions type:', typeof cleanFieldOptions)
      console.log('  cleanFieldOptions is array?:', Array.isArray(cleanFieldOptions))
      console.log('  values[14] (validationRules - RAW OBJECT for ::jsonb):', values[14])
      console.log('  values[14] type:', typeof values[14])
      console.log('  values[15] (fieldOptions - RAW ARRAY for ::jsonb):', values[15])
      console.log('  values[15] type:', typeof values[15])
      console.log('================================================================================')

      console.log('🚀 Executing database query with ::jsonb casts - pg will auto-convert raw objects/arrays...')
      const result = await db.query(query, values)
      console.log('✅ Database query successful!')

      console.log('✅ Field created in database:', result.rows[0].id)

      return result.rows[0]
    } catch (error) {
      console.error('❌ Error creating field definition:', error)
      console.error('Error code:', error.code)
      console.error('Error detail:', error.detail)
      console.error('Error hint:', error.hint)
      throw error
    }
  }

  /**
   * Update a custom field definition
   * @param {string} fieldId - Field definition UUID
   * @param {string} organizationId - Organization UUID
   * @param {Object} updateData - Fields to update
   * @param {string} updatedBy - User UUID performing the update
   * @returns {Promise<Object>} Updated field definition
   */
  static async updateFieldDefinition(fieldId, organizationId, updateData, updatedBy) {
    try {
      const allowedFields = [
        'field_label',
        'field_description',
        'field_type',
        'is_required',
        'is_searchable',
        'is_filterable',
        'display_order',
        'show_in_list_view',
        'show_in_detail_view',
        'show_in_create_form',
        'show_in_edit_form',
        'validation_rules',
        'field_options',
        'default_value',
        'placeholder',
        'field_group',
        'is_active',
        // Phase 1: Visibility fields
        'overall_visibility',
        'visibility_logic'
      ]

      const updates = []
      const values = []
      let paramCount = 1

      Object.keys(updateData).forEach(key => {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
        if (allowedFields.includes(snakeKey)) {
          // Handle JSONB fields - pass raw objects/arrays, pg will handle conversion
          if (snakeKey === 'validation_rules' || snakeKey === 'field_options') {
            updates.push(`${snakeKey} = $${paramCount}::jsonb`)
            // Clean the data - ensure it's the right type
            let cleanValue = updateData[key]
            if (snakeKey === 'field_options') {
              cleanValue = Array.isArray(cleanValue) ? cleanValue : (typeof cleanValue === 'string' ? JSON.parse(cleanValue) : [])
            } else if (snakeKey === 'validation_rules') {
              cleanValue = (cleanValue && typeof cleanValue === 'object' && !Array.isArray(cleanValue)) ? cleanValue : (typeof cleanValue === 'string' ? JSON.parse(cleanValue) : {})
            }
            values.push(cleanValue)  // Raw object/array
          } else {
            updates.push(`${snakeKey} = $${paramCount}`)
            values.push(updateData[key])
          }
          paramCount++
        }
      })

      if (updates.length === 0) {
        throw new Error('No valid fields to update')
      }

      // Add updated_by
      updates.push(`updated_by = $${paramCount}`)
      values.push(updatedBy)
      paramCount++

      // Add WHERE clause parameters
      values.push(fieldId)
      values.push(organizationId)

      const query = `
        UPDATE custom_field_definitions
        SET ${updates.join(', ')}
        WHERE id = $${paramCount - 1} AND organization_id = $${paramCount}
        RETURNING *
      `

      const result = await db.query(query, values)

      if (result.rows.length === 0) {
        throw new Error('Field definition not found')
      }

      return result.rows[0]
    } catch (error) {
      console.error('Error updating field definition:', error)
      throw error
    }
  }

  /**
   * Delete a custom field definition (soft delete by setting is_active to false)
   * @param {string} fieldId - Field definition UUID
   * @param {string} organizationId - Organization UUID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteFieldDefinition(fieldId, organizationId) {
    try {
      const query = `
        UPDATE custom_field_definitions
        SET is_active = false
        WHERE id = $1 AND organization_id = $2
        RETURNING id
      `
      const result = await db.query(query, [fieldId, organizationId])
      return result.rows.length > 0
    } catch (error) {
      console.error('Error deleting field definition:', error)
      throw error
    }
  }

  /**
   * Permanently delete a custom field definition and all its values
   * @param {string} fieldId - Field definition UUID
   * @param {string} organizationId - Organization UUID
   * @returns {Promise<boolean>} Success status
   */
  static async permanentlyDeleteFieldDefinition(fieldId, organizationId) {
    try {
      // First delete all values
      await db.query(
        'DELETE FROM custom_field_values WHERE field_definition_id = $1 AND organization_id = $2',
        [fieldId, organizationId]
      )

      // Then delete the definition
      const query = `
        DELETE FROM custom_field_definitions
        WHERE id = $1 AND organization_id = $2
        RETURNING id
      `
      const result = await db.query(query, [fieldId, organizationId])
      return result.rows.length > 0
    } catch (error) {
      console.error('Error permanently deleting field definition:', error)
      throw error
    }
  }

  // ========================================
  // FIELD VALUES - CRUD METHODS
  // ========================================

  /**
   * Get all custom field values for a specific entity
   * @param {string} organizationId - Organization UUID
   * @param {string} entityType - Entity type (leads, contacts, accounts, transactions)
   * @param {string} entityId - Entity UUID
   * @returns {Promise<Array>} Array of field values with definitions
   */
  static async getFieldValues(organizationId, entityType, entityId) {
    try {
      const query = `
        SELECT
          cfv.id as value_id,
          cfv.field_value,
          cfv.created_at as value_created_at,
          cfv.updated_at as value_updated_at,
          cfd.id as field_id,
          cfd.field_name,
          cfd.field_label,
          cfd.field_description,
          cfd.field_type,
          cfd.is_required,
          cfd.field_options,
          cfd.placeholder,
          cfd.field_group,
          cfd.display_order
        FROM custom_field_definitions cfd
        LEFT JOIN custom_field_values cfv ON cfd.id = cfv.field_definition_id AND cfv.entity_id = $3
        WHERE cfd.organization_id = $1
          AND cfd.entity_type = $2
          AND cfd.is_active = true
        ORDER BY cfd.display_order ASC, cfd.created_at ASC
      `
      const result = await db.query(query, [organizationId, entityType, entityId])
      return result.rows
    } catch (error) {
      console.error('Error getting field values:', error)
      throw error
    }
  }

  /**
   * Set or update a custom field value for an entity
   * @param {Object} valueData - Field value data
   * @returns {Promise<Object>} Created or updated field value
   */
  static async setFieldValue(valueData) {
    try {
      const {
        organizationId,
        fieldDefinitionId,
        entityType,
        entityId,
        fieldValue,
        createdBy
      } = valueData

      const query = `
        INSERT INTO custom_field_values (
          organization_id,
          field_definition_id,
          entity_type,
          entity_id,
          field_value,
          created_by,
          updated_by
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6)
        ON CONFLICT (field_definition_id, entity_id)
        DO UPDATE SET
          field_value = EXCLUDED.field_value,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *
      `

      const values = [
        organizationId,
        fieldDefinitionId,
        entityType,
        entityId,
        { value: fieldValue }, // Raw object - pg will handle ::jsonb conversion
        createdBy
      ]

      const result = await db.query(query, values)
      return result.rows[0]
    } catch (error) {
      console.error('Error setting field value:', error)
      throw error
    }
  }

  /**
   * Set multiple custom field values for an entity
   * @param {string} organizationId - Organization UUID
   * @param {string} entityType - Entity type
   * @param {string} entityId - Entity UUID
   * @param {Object} fieldValues - Object with fieldName: value pairs
   * @param {string} userId - User UUID performing the operation
   * @returns {Promise<Array>} Array of created/updated field values
   */
  static async setMultipleFieldValues(organizationId, entityType, entityId, fieldValues, userId) {
    try {
      // First, get all field definitions for this entity type
      const fieldDefs = await this.getFieldDefinitions(organizationId, entityType, true)

      // Create a map of field names to field IDs
      const fieldMap = {}
      fieldDefs.forEach(field => {
        fieldMap[field.field_name] = field.id
      })

      // Set values for each field
      const results = []
      for (const [fieldName, value] of Object.entries(fieldValues)) {
        const fieldDefinitionId = fieldMap[fieldName]
        if (fieldDefinitionId) {
          const result = await this.setFieldValue({
            organizationId,
            fieldDefinitionId,
            entityType,
            entityId,
            fieldValue: value,
            createdBy: userId
          })
          results.push(result)
        }
      }

      return results
    } catch (error) {
      console.error('Error setting multiple field values:', error)
      throw error
    }
  }

  /**
   * Delete a custom field value
   * @param {string} valueId - Field value UUID
   * @param {string} organizationId - Organization UUID
   * @returns {Promise<boolean>} Success status
   */
  static async deleteFieldValue(valueId, organizationId) {
    try {
      const query = `
        DELETE FROM custom_field_values
        WHERE id = $1 AND organization_id = $2
        RETURNING id
      `
      const result = await db.query(query, [valueId, organizationId])
      return result.rows.length > 0
    } catch (error) {
      console.error('Error deleting field value:', error)
      throw error
    }
  }

  /**
   * Delete all custom field values for an entity
   * @param {string} organizationId - Organization UUID
   * @param {string} entityType - Entity type
   * @param {string} entityId - Entity UUID
   * @returns {Promise<number>} Number of deleted values
   */
  static async deleteAllFieldValuesForEntity(organizationId, entityType, entityId) {
    try {
      const query = `
        DELETE FROM custom_field_values
        WHERE organization_id = $1 AND entity_type = $2 AND entity_id = $3
        RETURNING id
      `
      const result = await db.query(query, [organizationId, entityType, entityId])
      return result.rows.length
    } catch (error) {
      console.error('Error deleting all field values for entity:', error)
      throw error
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get entities with custom field values (for list views)
   * @param {string} organizationId - Organization UUID
   * @param {string} entityType - Entity type
   * @param {Array<string>} entityIds - Array of entity UUIDs
   * @returns {Promise<Object>} Object mapping entity IDs to their custom field values
   */
  static async getFieldValuesForEntities(organizationId, entityType, entityIds) {
    try {
      if (!entityIds || entityIds.length === 0) {
        return {}
      }

      const query = `
        SELECT
          cfv.entity_id,
          cfd.field_name,
          cfd.field_label,
          cfd.field_type,
          cfv.field_value
        FROM custom_field_values cfv
        JOIN custom_field_definitions cfd ON cfv.field_definition_id = cfd.id
        WHERE cfv.organization_id = $1
          AND cfv.entity_type = $2
          AND cfv.entity_id = ANY($3)
          AND cfd.is_active = true
          AND cfd.show_in_list_view = true
        ORDER BY cfd.display_order ASC
      `

      const result = await db.query(query, [organizationId, entityType, entityIds])

      // Group by entity ID
      const grouped = {}
      result.rows.forEach(row => {
        if (!grouped[row.entity_id]) {
          grouped[row.entity_id] = {}
        }
        grouped[row.entity_id][row.field_name] = {
          label: row.field_label,
          type: row.field_type,
          value: row.field_value?.value
        }
      })

      return grouped
    } catch (error) {
      console.error('Error getting field values for entities:', error)
      throw error
    }
  }

  /**
   * Validate field value against field definition
   * @param {Object} fieldDefinition - Field definition object
   * @param {*} value - Value to validate
   * @returns {Object} Validation result { valid: boolean, errors: Array }
   */
  static validateFieldValue(fieldDefinition, value) {
    const errors = []

    // Check required
    if (fieldDefinition.is_required && (value === null || value === undefined || value === '')) {
      errors.push(`${fieldDefinition.field_label} is required`)
    }

    // Type-specific validation
    if (value !== null && value !== undefined && value !== '') {
      switch (fieldDefinition.field_type) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(value)) {
            errors.push(`${fieldDefinition.field_label} must be a valid email address`)
          }
          break

        case 'url':
          try {
            new URL(value)
          } catch {
            errors.push(`${fieldDefinition.field_label} must be a valid URL`)
          }
          break

        case 'number':
          if (isNaN(value)) {
            errors.push(`${fieldDefinition.field_label} must be a number`)
          }
          break

        case 'select':
        case 'radio':
          const validOptions = fieldDefinition.field_options.map(opt => opt.value)
          if (!validOptions.includes(value)) {
            errors.push(`${fieldDefinition.field_label} must be one of: ${validOptions.join(', ')}`)
          }
          break

        case 'multiselect':
          if (!Array.isArray(value)) {
            errors.push(`${fieldDefinition.field_label} must be an array`)
          } else {
            const validOptions = fieldDefinition.field_options.map(opt => opt.value)
            const invalidValues = value.filter(v => !validOptions.includes(v))
            if (invalidValues.length > 0) {
              errors.push(`${fieldDefinition.field_label} contains invalid values: ${invalidValues.join(', ')}`)
            }
          }
          break
      }

      // Custom validation rules
      if (fieldDefinition.validation_rules) {
        const rules = fieldDefinition.validation_rules

        if (rules.min !== undefined && value < rules.min) {
          errors.push(`${fieldDefinition.field_label} must be at least ${rules.min}`)
        }

        if (rules.max !== undefined && value > rules.max) {
          errors.push(`${fieldDefinition.field_label} must be at most ${rules.max}`)
        }

        if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
          errors.push(`${fieldDefinition.field_label} does not match the required pattern`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

module.exports = CustomField
