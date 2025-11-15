// ============================================================================
// PRODUCT FIELD CUSTOMIZATION CONTROLLER
// ============================================================================
// This controller handles all business logic for managing custom fields
// specifically for Products in the CRM system.
//
// Database Structure:
// - custom_field_definitions: Stores field metadata (schema)
// - custom_field_values: Stores actual field values for each product
// - entity_type column: Set to 'product' for all product-related fields
// - organization_id: Ensures multi-tenant data isolation
//
// Model Usage:
// Currently uses the CustomField model. If you create a separate DynamicField
// model in the future, simply update the require statement below.
// ============================================================================

const CustomField = require('../models/CustomField')

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a field is the protected "Product Name" field
 * @param {Object} field - Field definition object
 * @returns {boolean} - True if this is the Product Name field
 */
const isProductNameField = (field) => {
  if (!field) return false

  const fieldName = (field.field_name || '').toLowerCase()
  const fieldLabel = (field.field_label || '').toLowerCase()

  return (
    fieldName === 'product_name' ||
    fieldName === 'productname' ||
    fieldName === 'name' ||
    fieldLabel === 'product name' ||
    fieldLabel === 'name'
  )
}

/**
 * Normalize field data from request body (supports both camelCase and snake_case)
 * @param {Object} data - Request body data
 * @returns {Object} - Normalized field data
 */
const normalizeFieldData = (data) => {
  return {
    fieldName: data.fieldName || data.field_name,
    fieldLabel: data.fieldLabel || data.field_label,
    fieldDescription: data.fieldDescription || data.field_description,
    fieldType: data.fieldType || data.field_type,
    isRequired: data.isRequired !== undefined ? data.isRequired : data.is_required,
    isSearchable: data.isSearchable !== undefined ? data.isSearchable : data.is_searchable,
    isFilterable: data.isFilterable !== undefined ? data.isFilterable : data.is_filterable,
    displayOrder: data.displayOrder !== undefined ? data.displayOrder : data.display_order,
    showInListView: data.showInListView !== undefined ? data.showInListView : data.show_in_list_view,
    showInDetailView: data.showInDetailView !== undefined ? data.showInDetailView : data.show_in_detail_view,
    showInCreateForm: data.showInCreateForm !== undefined ? data.showInCreateForm : data.show_in_create_form,
    showInEditForm: data.showInEditForm !== undefined ? data.showInEditForm : data.show_in_edit_form,
    validationRules: data.validationRules || data.validation_rules,
    fieldOptions: data.fieldOptions || data.field_options,
    defaultValue: data.defaultValue !== undefined ? data.defaultValue : data.default_value,
    placeholder: data.placeholder,
    fieldGroup: data.fieldGroup || data.field_group
  }
}

/**
 * Validate field name is not empty
 * @param {string} fieldName - Field name to validate
 * @returns {Object} - Validation result {valid: boolean, error: string}
 */
const validateFieldName = (fieldName) => {
  if (!fieldName || fieldName.trim() === '') {
    return {
      valid: false,
      error: 'Field name cannot be empty'
    }
  }

  // Check for valid characters (alphanumeric, underscores, hyphens)
  const validNamePattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/
  if (!validNamePattern.test(fieldName)) {
    return {
      valid: false,
      error: 'Field name must start with a letter and contain only letters, numbers, underscores, and hyphens'
    }
  }

  return { valid: true }
}

/**
 * Validate field label is not empty
 * @param {string} fieldLabel - Field label to validate
 * @returns {Object} - Validation result {valid: boolean, error: string}
 */
const validateFieldLabel = (fieldLabel) => {
  if (!fieldLabel || fieldLabel.trim() === '') {
    return {
      valid: false,
      error: 'Field label cannot be empty'
    }
  }

  return { valid: true }
}

/**
 * Validate field type is supported
 * @param {string} fieldType - Field type to validate
 * @returns {Object} - Validation result {valid: boolean, error: string}
 */
const validateFieldType = (fieldType) => {
  const validFieldTypes = [
    'text', 'number', 'email', 'phone', 'url', 'date', 'datetime',
    'textarea', 'select', 'multiselect', 'checkbox', 'radio'
  ]

  if (!fieldType || !validFieldTypes.includes(fieldType)) {
    return {
      valid: false,
      error: `Invalid field type. Must be one of: ${validFieldTypes.join(', ')}`,
      validTypes: validFieldTypes
    }
  }

  return { valid: true }
}

/**
 * Validate field options for select/multiselect/radio fields
 * @param {string} fieldType - Type of field
 * @param {Array} fieldOptions - Array of field options
 * @returns {Object} - Validation result {valid: boolean, error: string}
 */
const validateFieldOptions = (fieldType, fieldOptions) => {
  // Only required for select, multiselect, and radio fields
  if (!['select', 'multiselect', 'radio'].includes(fieldType)) {
    return { valid: true }
  }

  if (!fieldOptions || !Array.isArray(fieldOptions) || fieldOptions.length === 0) {
    return {
      valid: false,
      error: `Field options are required for ${fieldType} field type and must be a non-empty array`
    }
  }

  // Validate each option has required properties
  for (let i = 0; i < fieldOptions.length; i++) {
    const option = fieldOptions[i]
    if (!option.label || !option.value) {
      return {
        valid: false,
        error: `Field option at index ${i} must have both 'label' and 'value' properties`
      }
    }
  }

  return { valid: true }
}

// ============================================================================
// CONTROLLER FUNCTIONS
// ============================================================================

/**
 * 1. GET ALL PRODUCT FIELDS
 * Retrieves all custom field definitions for products in an organization
 *
 * Query Parameters:
 * - activeOnly (boolean, default: true): Only return active fields
 *
 * Response: {success, count, fields}
 */
const getProductFields = async (req, res) => {
  try {
    console.log('='.repeat(80))
    console.log('📋 GET PRODUCT FIELDS - Controller')
    console.log('='.repeat(80))
    console.log('Organization ID:', req.user?.organization_id)
    console.log('Query params:', req.query)

    // Extract organization ID from authenticated user
    const organizationId = req.user.organization_id

    // Validate organization context
    if (!organizationId) {
      console.error('❌ No organization_id found in user context')
      return res.status(400).json({
        success: false,
        error: 'Missing organization context',
        message: 'User must be associated with an organization'
      })
    }

    // Extract query parameters
    const { activeOnly = 'true' } = req.query
    const includeInactive = activeOnly !== 'true'

    console.log(`🔍 Fetching product fields (activeOnly: ${activeOnly})`)

    // Fetch all product field definitions from database
    // entity_type is set to 'product' to filter only product-related fields
    const fields = await CustomField.getFieldDefinitions(
      organizationId,
      'product', // Entity type for products
      !includeInactive // Pass activeOnly as boolean
    )

    console.log(`✅ Successfully retrieved ${fields.length} product fields`)

    // Return successful response with field data
    return res.status(200).json({
      success: true,
      count: fields.length,
      fields: fields
    })

  } catch (error) {
    console.error('❌ Error in getProductFields:', error)
    console.error('Stack trace:', error.stack)

    // Return error response with helpful message
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve product fields',
      message: error.message,
      // Include stack trace in development mode for debugging
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    })
  }
}

/**
 * 2. CREATE NEW PRODUCT FIELD
 * Adds a new custom field definition for products
 *
 * Request Body: {fieldName, fieldLabel, fieldType, isRequired, fieldOptions, ...}
 *
 * Business Rules:
 * - Field name must not be empty
 * - Field name must be unique within the organization's product fields
 * - Field type must be valid
 * - Select/multiselect/radio fields must have options
 *
 * Response: {success, message, field}
 */
const createProductField = async (req, res) => {
  try {
    console.log('='.repeat(80))
    console.log('➕ CREATE PRODUCT FIELD - Controller')
    console.log('='.repeat(80))
    console.log('Organization ID:', req.user?.organization_id)
    console.log('User ID:', req.user?.id)
    console.log('Request body:', JSON.stringify(req.body, null, 2))

    // Extract organization and user context
    const organizationId = req.user.organization_id
    const userId = req.user.id

    // Validate organization context
    if (!organizationId) {
      console.error('❌ No organization_id found in user context')
      return res.status(400).json({
        success: false,
        error: 'Missing organization context',
        message: 'User must be associated with an organization'
      })
    }

    // Normalize field data (supports both camelCase and snake_case)
    const normalizedData = normalizeFieldData(req.body)

    console.log('📋 Normalized data:', {
      fieldName: normalizedData.fieldName,
      fieldLabel: normalizedData.fieldLabel,
      fieldType: normalizedData.fieldType
    })

    // ========================================
    // VALIDATION STEP 1: Field Name
    // ========================================
    console.log('🔍 VALIDATION STEP 1: Checking field name')

    const nameValidation = validateFieldName(normalizedData.fieldName)
    if (!nameValidation.valid) {
      console.error('❌ Invalid field name:', nameValidation.error)
      return res.status(400).json({
        success: false,
        error: 'Invalid field name',
        message: nameValidation.error
      })
    }

    console.log('✅ Field name is valid')

    // ========================================
    // VALIDATION STEP 2: Field Label
    // ========================================
    console.log('🔍 VALIDATION STEP 2: Checking field label')

    const labelValidation = validateFieldLabel(normalizedData.fieldLabel)
    if (!labelValidation.valid) {
      console.error('❌ Invalid field label:', labelValidation.error)
      return res.status(400).json({
        success: false,
        error: 'Invalid field label',
        message: labelValidation.error
      })
    }

    console.log('✅ Field label is valid')

    // ========================================
    // VALIDATION STEP 3: Field Type
    // ========================================
    console.log('🔍 VALIDATION STEP 3: Checking field type')

    const typeValidation = validateFieldType(normalizedData.fieldType)
    if (!typeValidation.valid) {
      console.error('❌ Invalid field type:', typeValidation.error)
      return res.status(400).json({
        success: false,
        error: 'Invalid field type',
        message: typeValidation.error,
        validTypes: typeValidation.validTypes
      })
    }

    console.log('✅ Field type is valid')

    // ========================================
    // VALIDATION STEP 4: Field Options (for select/multiselect/radio)
    // ========================================
    console.log('🔍 VALIDATION STEP 4: Checking field options')

    const optionsValidation = validateFieldOptions(
      normalizedData.fieldType,
      normalizedData.fieldOptions
    )
    if (!optionsValidation.valid) {
      console.error('❌ Invalid field options:', optionsValidation.error)
      return res.status(400).json({
        success: false,
        error: 'Invalid field options',
        message: optionsValidation.error
      })
    }

    console.log('✅ Field options are valid (or not required)')

    // ========================================
    // VALIDATION STEP 5: Check for Duplicate Field Names
    // ========================================
    console.log('🔍 VALIDATION STEP 5: Checking for duplicate field names')

    // Fetch all existing product fields (including inactive ones)
    const existingFields = await CustomField.getFieldDefinitions(
      organizationId,
      'product',
      false // Include inactive fields in duplicate check
    )

    // Check if a field with this name already exists
    const duplicateField = existingFields.find(
      field => field.field_name.toLowerCase() === normalizedData.fieldName.toLowerCase()
    )

    if (duplicateField) {
      console.error('❌ Duplicate field name found:', normalizedData.fieldName)
      return res.status(409).json({
        success: false,
        error: 'Duplicate field name',
        message: `A product field with the name "${normalizedData.fieldName}" already exists`,
        existingField: {
          id: duplicateField.id,
          fieldName: duplicateField.field_name,
          fieldLabel: duplicateField.field_label,
          isActive: duplicateField.is_active
        }
      })
    }

    console.log('✅ No duplicate field name found')

    // ========================================
    // CREATE FIELD DEFINITION
    // ========================================
    console.log('💾 Creating new product field definition in database...')

    // Prepare field data for database insertion
    const fieldData = {
      organizationId: organizationId,
      fieldName: normalizedData.fieldName,
      fieldLabel: normalizedData.fieldLabel,
      fieldDescription: normalizedData.fieldDescription,
      entityType: 'product', // ALWAYS 'product' for product fields
      fieldType: normalizedData.fieldType,
      isRequired: normalizedData.isRequired || false,
      isSearchable: normalizedData.isSearchable !== false, // Default true
      isFilterable: normalizedData.isFilterable !== false, // Default true
      displayOrder: normalizedData.displayOrder || 0,
      showInListView: normalizedData.showInListView || false,
      showInDetailView: normalizedData.showInDetailView !== false, // Default true
      showInCreateForm: normalizedData.showInCreateForm !== false, // Default true
      showInEditForm: normalizedData.showInEditForm !== false, // Default true
      validationRules: normalizedData.validationRules || {},
      fieldOptions: normalizedData.fieldOptions || [],
      defaultValue: normalizedData.defaultValue || null,
      placeholder: normalizedData.placeholder || null,
      fieldGroup: normalizedData.fieldGroup || null,
      createdBy: userId
    }

    console.log('📦 Field data prepared:', {
      ...fieldData,
      fieldOptions: fieldData.fieldOptions?.length || 0
    })

    // Insert field definition into database
    const createdField = await CustomField.createFieldDefinition(fieldData)

    console.log('✅ Product field created successfully:', createdField.id)

    // Return success response with created field
    return res.status(201).json({
      success: true,
      message: 'Product field created successfully',
      field: createdField
    })

  } catch (error) {
    console.error('❌ Error in createProductField:', error)
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    console.error('Stack trace:', error.stack)

    // Handle database-specific errors
    // 23505 = unique_violation (PostgreSQL error code)
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Duplicate field name',
        message: 'A product field with this name already exists',
        details: error.message
      })
    }

    // Handle other database errors
    if (error.code) {
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: 'Failed to create product field due to database error',
        code: error.code,
        details: error.message
      })
    }

    // Generic error response
    return res.status(500).json({
      success: false,
      error: 'Failed to create product field',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    })
  }
}

/**
 * 3. UPDATE PRODUCT FIELD
 * Modifies an existing product field definition
 *
 * Path Parameters: {fieldId}
 * Request Body: {fieldLabel, isRequired, displayOrder, ...}
 *
 * Special Business Rules:
 * - The "Product Name" field CANNOT be made optional (is_required must stay true)
 * - Field name (field_name) cannot be changed after creation
 * - Entity type (entity_type) cannot be changed
 *
 * Response: {success, message, field}
 */
const updateProductField = async (req, res) => {
  try {
    console.log('='.repeat(80))
    console.log('✏️  UPDATE PRODUCT FIELD - Controller')
    console.log('='.repeat(80))
    console.log('Field ID:', req.params.fieldId)
    console.log('Organization ID:', req.user?.organization_id)
    console.log('User ID:', req.user?.id)
    console.log('Request body:', JSON.stringify(req.body, null, 2))

    // Extract context from request
    const { fieldId } = req.params
    const organizationId = req.user.organization_id
    const userId = req.user.id

    // Validate organization context
    if (!organizationId) {
      console.error('❌ No organization_id found in user context')
      return res.status(400).json({
        success: false,
        error: 'Missing organization context',
        message: 'User must be associated with an organization'
      })
    }

    // Validate field ID is provided
    if (!fieldId) {
      console.error('❌ No field ID provided')
      return res.status(400).json({
        success: false,
        error: 'Missing field ID',
        message: 'Field ID is required'
      })
    }

    // ========================================
    // FETCH EXISTING FIELD
    // ========================================
    console.log('🔍 Fetching existing field definition from database...')

    const existingField = await CustomField.getFieldDefinitionById(fieldId, organizationId)

    if (!existingField) {
      console.error('❌ Field not found')
      return res.status(404).json({
        success: false,
        error: 'Field not found',
        message: 'The specified product field does not exist or does not belong to your organization'
      })
    }

    console.log('✅ Found existing field:', existingField.field_name)

    // Verify this is a product field
    if (existingField.entity_type !== 'product') {
      console.error('❌ Not a product field:', existingField.entity_type)
      return res.status(400).json({
        success: false,
        error: 'Invalid field type',
        message: 'This field is not a product field'
      })
    }

    // ========================================
    // SPECIAL PROTECTION FOR "PRODUCT NAME" FIELD
    // ========================================
    console.log('🔒 Checking if this is the protected "Product Name" field...')

    if (isProductNameField(existingField)) {
      console.log('⚠️  This is the "Product Name" field - applying special protections')

      // Check if trying to make it optional
      const { isRequired, is_required } = req.body
      const newIsRequired = isRequired !== undefined ? isRequired : is_required

      if (newIsRequired === false) {
        console.error('❌ Attempt to make "Product Name" field optional')
        return res.status(400).json({
          success: false,
          error: 'Cannot modify Product Name field',
          message: 'The "Product Name" field must always be required and cannot be made optional'
        })
      }
    }

    // ========================================
    // VALIDATE UPDATE DATA
    // ========================================

    // If field type is being changed, validate it
    const newFieldType = req.body.fieldType || req.body.field_type
    if (newFieldType && newFieldType !== existingField.field_type) {
      console.log('🔍 Validating new field type:', newFieldType)

      const typeValidation = validateFieldType(newFieldType)
      if (!typeValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid field type',
          message: typeValidation.error,
          validTypes: typeValidation.validTypes
        })
      }

      // If changing to select/multiselect/radio, ensure field options are provided
      const newFieldOptions = req.body.fieldOptions || req.body.field_options
      const optionsValidation = validateFieldOptions(newFieldType, newFieldOptions)
      if (!optionsValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid field options',
          message: optionsValidation.error
        })
      }
    }

    // ========================================
    // UPDATE FIELD DEFINITION
    // ========================================
    console.log('💾 Updating product field definition in database...')

    // Update the field using the model
    const updatedField = await CustomField.updateFieldDefinition(
      fieldId,
      organizationId,
      req.body, // Pass the entire request body - model handles normalization
      userId
    )

    console.log('✅ Product field updated successfully')

    // Return success response with updated field
    return res.status(200).json({
      success: true,
      message: 'Product field updated successfully',
      field: updatedField
    })

  } catch (error) {
    console.error('❌ Error in updateProductField:', error)
    console.error('Error message:', error.message)
    console.error('Stack trace:', error.stack)

    // Handle specific error cases
    if (error.message === 'Field definition not found') {
      return res.status(404).json({
        success: false,
        error: 'Field not found',
        message: 'The specified product field does not exist'
      })
    }

    if (error.message === 'No valid fields to update') {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
        message: 'Please provide at least one valid field to update'
      })
    }

    // Generic error response
    return res.status(500).json({
      success: false,
      error: 'Failed to update product field',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    })
  }
}

/**
 * 4. DELETE PRODUCT FIELD
 * Removes a custom field definition for products
 *
 * Path Parameters: {fieldId}
 * Query Parameters: {permanent} - If true, permanently deletes; otherwise soft deletes
 *
 * Special Business Rules:
 * - The "Product Name" field CANNOT be deleted (soft or permanent)
 * - Soft delete: Sets is_active to false (can be reactivated later)
 * - Permanent delete: Removes field and ALL associated values (cannot be undone)
 *
 * Response: {success, message}
 */
const deleteProductField = async (req, res) => {
  try {
    console.log('='.repeat(80))
    console.log('🗑️  DELETE PRODUCT FIELD - Controller')
    console.log('='.repeat(80))
    console.log('Field ID:', req.params.fieldId)
    console.log('Organization ID:', req.user?.organization_id)
    console.log('Query params:', req.query)

    // Extract context from request
    const { fieldId } = req.params
    const { permanent = 'false' } = req.query
    const organizationId = req.user.organization_id

    // Validate organization context
    if (!organizationId) {
      console.error('❌ No organization_id found in user context')
      return res.status(400).json({
        success: false,
        error: 'Missing organization context',
        message: 'User must be associated with an organization'
      })
    }

    // Validate field ID is provided
    if (!fieldId) {
      console.error('❌ No field ID provided')
      return res.status(400).json({
        success: false,
        error: 'Missing field ID',
        message: 'Field ID is required'
      })
    }

    // ========================================
    // FETCH EXISTING FIELD
    // ========================================
    console.log('🔍 Fetching existing field definition from database...')

    const existingField = await CustomField.getFieldDefinitionById(fieldId, organizationId)

    if (!existingField) {
      console.error('❌ Field not found')
      return res.status(404).json({
        success: false,
        error: 'Field not found',
        message: 'The specified product field does not exist or does not belong to your organization'
      })
    }

    console.log('✅ Found existing field:', existingField.field_name)

    // Verify this is a product field
    if (existingField.entity_type !== 'product') {
      console.error('❌ Not a product field:', existingField.entity_type)
      return res.status(400).json({
        success: false,
        error: 'Invalid field type',
        message: 'This field is not a product field'
      })
    }

    // ========================================
    // SPECIAL PROTECTION FOR "PRODUCT NAME" FIELD
    // ========================================
    console.log('🔒 Checking if this is the protected "Product Name" field...')

    if (isProductNameField(existingField)) {
      console.error('❌ Attempt to delete "Product Name" field')
      return res.status(400).json({
        success: false,
        error: 'Cannot delete Product Name field',
        message: 'The "Product Name" field is a core field and cannot be deleted'
      })
    }

    // ========================================
    // DELETE FIELD DEFINITION
    // ========================================

    const isPermanent = permanent === 'true'

    if (isPermanent) {
      console.log('⚠️  PERMANENT DELETE - This will delete the field and ALL associated values!')
    } else {
      console.log('📦 SOFT DELETE - This will deactivate the field (can be reactivated)')
    }

    let success

    if (isPermanent) {
      // Permanent deletion: Deletes field definition and all field values
      success = await CustomField.permanentlyDeleteFieldDefinition(fieldId, organizationId)
    } else {
      // Soft deletion: Sets is_active to false
      success = await CustomField.deleteFieldDefinition(fieldId, organizationId)
    }

    if (!success) {
      console.error('❌ Field deletion failed')
      return res.status(404).json({
        success: false,
        error: 'Field not found',
        message: 'Failed to delete field - it may have already been deleted'
      })
    }

    console.log('✅ Product field deleted successfully')

    // Return success response with appropriate message
    return res.status(200).json({
      success: true,
      message: isPermanent
        ? 'Product field permanently deleted (including all values)'
        : 'Product field deactivated (can be reactivated later)'
    })

  } catch (error) {
    console.error('❌ Error in deleteProductField:', error)
    console.error('Error message:', error.message)
    console.error('Stack trace:', error.stack)

    // Generic error response
    return res.status(500).json({
      success: false,
      error: 'Failed to delete product field',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    })
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  getProductFields,
  createProductField,
  updateProductField,
  deleteProductField
}
