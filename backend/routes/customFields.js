const express = require('express')
const router = express.Router()
const CustomField = require('../models/CustomField')
const { authenticateToken } = require('../middleware/auth')

// Apply authentication middleware to all routes
router.use(authenticateToken)

// ========================================
// FIELD DEFINITIONS ROUTES
// ========================================

/**
 * GET /api/custom-fields/definitions/:entityType
 * Get all custom field definitions for an entity type
 */
router.get('/definitions/:entityType', async (req, res) => {
  try {
    const { entityType } = req.params
    const { activeOnly = 'true' } = req.query
    const organizationId = req.user.organization_id

    // Validate entity type
    const validEntityTypes = ['leads', 'contacts', 'accounts', 'transactions']
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        error: 'Invalid entity type',
        validTypes: validEntityTypes
      })
    }

    const fields = await CustomField.getFieldDefinitions(
      organizationId,
      entityType,
      activeOnly === 'true'
    )

    res.json({
      success: true,
      entityType,
      count: fields.length,
      fields
    })
  } catch (error) {
    console.error('Error fetching field definitions:', error)
    res.status(500).json({
      error: 'Failed to fetch field definitions',
      details: error.message
    })
  }
})

/**
 * GET /api/custom-fields/definitions/:entityType/:fieldId
 * Get a single custom field definition by ID
 */
router.get('/definitions/:entityType/:fieldId', async (req, res) => {
  try {
    const { fieldId } = req.params
    const organizationId = req.user.organization_id

    const field = await CustomField.getFieldDefinitionById(fieldId, organizationId)

    if (!field) {
      return res.status(404).json({
        error: 'Field definition not found'
      })
    }

    res.json({
      success: true,
      field
    })
  } catch (error) {
    console.error('Error fetching field definition:', error)
    res.status(500).json({
      error: 'Failed to fetch field definition',
      details: error.message
    })
  }
})

/**
 * POST /api/custom-fields/definitions
 * Create a new custom field definition
 */
router.post('/definitions', async (req, res) => {
  try {
    const organizationId = req.user.organization_id
    const userId = req.user.id
    const {
      fieldName,
      fieldLabel,
      fieldDescription,
      entityType,
      fieldType,
      isRequired,
      isSearchable,
      isFilterable,
      displayOrder,
      showInListView,
      showInDetailView,
      showInCreateForm,
      showInEditForm,
      validationRules,
      fieldOptions,
      defaultValue,
      placeholder,
      fieldGroup
    } = req.body

    // Validate required fields
    if (!fieldName || !fieldLabel || !entityType || !fieldType) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['fieldName', 'fieldLabel', 'entityType', 'fieldType']
      })
    }

    // Validate entity type
    const validEntityTypes = ['leads', 'contacts', 'accounts', 'transactions']
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({
        error: 'Invalid entity type',
        validTypes: validEntityTypes
      })
    }

    // Validate field type
    const validFieldTypes = [
      'text', 'number', 'email', 'phone', 'url', 'date', 'datetime',
      'textarea', 'select', 'multiselect', 'checkbox', 'radio'
    ]
    if (!validFieldTypes.includes(fieldType)) {
      return res.status(400).json({
        error: 'Invalid field type',
        validTypes: validFieldTypes
      })
    }

    // Validate field options for select/multiselect/radio
    if (['select', 'multiselect', 'radio'].includes(fieldType)) {
      if (!fieldOptions || !Array.isArray(fieldOptions) || fieldOptions.length === 0) {
        return res.status(400).json({
          error: 'Field options are required for select, multiselect, and radio field types'
        })
      }
    }

    const fieldData = {
      organizationId,
      fieldName,
      fieldLabel,
      fieldDescription,
      entityType,
      fieldType,
      isRequired,
      isSearchable,
      isFilterable,
      displayOrder,
      showInListView,
      showInDetailView,
      showInCreateForm,
      showInEditForm,
      validationRules,
      fieldOptions,
      defaultValue,
      placeholder,
      fieldGroup,
      createdBy: userId
    }

    const field = await CustomField.createFieldDefinition(fieldData)

    res.status(201).json({
      success: true,
      message: 'Field definition created successfully',
      field
    })
  } catch (error) {
    console.error('Error creating field definition:', error)

    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'A field with this name already exists for this entity type'
      })
    }

    res.status(500).json({
      error: 'Failed to create field definition',
      details: error.message
    })
  }
})

/**
 * PUT /api/custom-fields/definitions/:fieldId
 * Update a custom field definition
 */
router.put('/definitions/:fieldId', async (req, res) => {
  try {
    const { fieldId } = req.params
    const organizationId = req.user.organization_id
    const userId = req.user.id
    const updateData = req.body

    const field = await CustomField.updateFieldDefinition(
      fieldId,
      organizationId,
      updateData,
      userId
    )

    res.json({
      success: true,
      message: 'Field definition updated successfully',
      field
    })
  } catch (error) {
    console.error('Error updating field definition:', error)

    if (error.message === 'Field definition not found') {
      return res.status(404).json({
        error: 'Field definition not found'
      })
    }

    if (error.message === 'No valid fields to update') {
      return res.status(400).json({
        error: 'No valid fields to update'
      })
    }

    res.status(500).json({
      error: 'Failed to update field definition',
      details: error.message
    })
  }
})

/**
 * DELETE /api/custom-fields/definitions/:fieldId
 * Delete (soft delete) a custom field definition
 */
router.delete('/definitions/:fieldId', async (req, res) => {
  try {
    const { fieldId } = req.params
    const { permanent = 'false' } = req.query
    const organizationId = req.user.organization_id

    let success

    if (permanent === 'true') {
      // Permanent deletion (deletes all values too)
      success = await CustomField.permanentlyDeleteFieldDefinition(fieldId, organizationId)
    } else {
      // Soft delete (sets is_active to false)
      success = await CustomField.deleteFieldDefinition(fieldId, organizationId)
    }

    if (!success) {
      return res.status(404).json({
        error: 'Field definition not found'
      })
    }

    res.json({
      success: true,
      message: permanent === 'true'
        ? 'Field definition permanently deleted'
        : 'Field definition deactivated'
    })
  } catch (error) {
    console.error('Error deleting field definition:', error)
    res.status(500).json({
      error: 'Failed to delete field definition',
      details: error.message
    })
  }
})

// ========================================
// FIELD VALUES ROUTES
// ========================================

/**
 * GET /api/custom-fields/values/:entityType/:entityId
 * Get all custom field values for a specific entity
 */
router.get('/values/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params
    const organizationId = req.user.organization_id

    const fieldValues = await CustomField.getFieldValues(
      organizationId,
      entityType,
      entityId
    )

    res.json({
      success: true,
      entityType,
      entityId,
      count: fieldValues.length,
      fieldValues
    })
  } catch (error) {
    console.error('Error fetching field values:', error)
    res.status(500).json({
      error: 'Failed to fetch field values',
      details: error.message
    })
  }
})

/**
 * POST /api/custom-fields/values
 * Set or update a custom field value
 */
router.post('/values', async (req, res) => {
  try {
    const organizationId = req.user.organization_id
    const userId = req.user.id
    const {
      fieldDefinitionId,
      entityType,
      entityId,
      fieldValue
    } = req.body

    // Validate required fields
    if (!fieldDefinitionId || !entityType || !entityId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['fieldDefinitionId', 'entityType', 'entityId']
      })
    }

    // Get field definition to validate
    const fieldDef = await CustomField.getFieldDefinitionById(fieldDefinitionId, organizationId)

    if (!fieldDef) {
      return res.status(404).json({
        error: 'Field definition not found'
      })
    }

    // Validate the value
    const validation = CustomField.validateFieldValue(fieldDef, fieldValue)

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        validationErrors: validation.errors
      })
    }

    const valueData = {
      organizationId,
      fieldDefinitionId,
      entityType,
      entityId,
      fieldValue,
      createdBy: userId
    }

    const value = await CustomField.setFieldValue(valueData)

    res.status(201).json({
      success: true,
      message: 'Field value saved successfully',
      value
    })
  } catch (error) {
    console.error('Error saving field value:', error)
    res.status(500).json({
      error: 'Failed to save field value',
      details: error.message
    })
  }
})

/**
 * POST /api/custom-fields/values/bulk
 * Set multiple custom field values for an entity
 */
router.post('/values/bulk', async (req, res) => {
  try {
    const organizationId = req.user.organization_id
    const userId = req.user.id
    const {
      entityType,
      entityId,
      fieldValues // Object with fieldName: value pairs
    } = req.body

    // Validate required fields
    if (!entityType || !entityId || !fieldValues) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['entityType', 'entityId', 'fieldValues']
      })
    }

    const results = await CustomField.setMultipleFieldValues(
      organizationId,
      entityType,
      entityId,
      fieldValues,
      userId
    )

    res.status(201).json({
      success: true,
      message: 'Field values saved successfully',
      count: results.length,
      values: results
    })
  } catch (error) {
    console.error('Error saving field values:', error)
    res.status(500).json({
      error: 'Failed to save field values',
      details: error.message
    })
  }
})

/**
 * DELETE /api/custom-fields/values/:valueId
 * Delete a custom field value
 */
router.delete('/values/:valueId', async (req, res) => {
  try {
    const { valueId } = req.params
    const organizationId = req.user.organization_id

    const success = await CustomField.deleteFieldValue(valueId, organizationId)

    if (!success) {
      return res.status(404).json({
        error: 'Field value not found'
      })
    }

    res.json({
      success: true,
      message: 'Field value deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting field value:', error)
    res.status(500).json({
      error: 'Failed to delete field value',
      details: error.message
    })
  }
})

/**
 * DELETE /api/custom-fields/values/:entityType/:entityId
 * Delete all custom field values for an entity
 */
router.delete('/values/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params
    const organizationId = req.user.organization_id

    const count = await CustomField.deleteAllFieldValuesForEntity(
      organizationId,
      entityType,
      entityId
    )

    res.json({
      success: true,
      message: `Deleted ${count} field values`,
      count
    })
  } catch (error) {
    console.error('Error deleting field values:', error)
    res.status(500).json({
      error: 'Failed to delete field values',
      details: error.message
    })
  }
})

// ========================================
// UTILITY ROUTES
// ========================================

/**
 * POST /api/custom-fields/validate
 * Validate a field value against its definition
 */
router.post('/validate', async (req, res) => {
  try {
    const { fieldDefinitionId, value } = req.body
    const organizationId = req.user.organization_id

    if (!fieldDefinitionId) {
      return res.status(400).json({
        error: 'fieldDefinitionId is required'
      })
    }

    const fieldDef = await CustomField.getFieldDefinitionById(fieldDefinitionId, organizationId)

    if (!fieldDef) {
      return res.status(404).json({
        error: 'Field definition not found'
      })
    }

    const validation = CustomField.validateFieldValue(fieldDef, value)

    res.json({
      success: true,
      valid: validation.valid,
      errors: validation.errors
    })
  } catch (error) {
    console.error('Error validating field value:', error)
    res.status(500).json({
      error: 'Failed to validate field value',
      details: error.message
    })
  }
})

/**
 * POST /api/custom-fields/values/batch
 * Get custom field values for multiple entities (for list views)
 */
router.post('/values/batch', async (req, res) => {
  try {
    const { entityType, entityIds } = req.body
    const organizationId = req.user.organization_id

    if (!entityType || !entityIds || !Array.isArray(entityIds)) {
      return res.status(400).json({
        error: 'entityType and entityIds (array) are required'
      })
    }

    const fieldValues = await CustomField.getFieldValuesForEntities(
      organizationId,
      entityType,
      entityIds
    )

    res.json({
      success: true,
      entityType,
      count: Object.keys(fieldValues).length,
      fieldValues
    })
  } catch (error) {
    console.error('Error fetching batch field values:', error)
    res.status(500).json({
      error: 'Failed to fetch field values',
      details: error.message
    })
  }
})

module.exports = router
