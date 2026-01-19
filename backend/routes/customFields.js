const express = require('express')
const router = express.Router()
const CustomField = require('../models/CustomField')
const { authenticateToken } = require('../middleware/auth')
const fieldVisibilityService = require('../services/fieldVisibilityService')

// Apply authentication middleware to all routes
router.use(authenticateToken)

// System field defaults - these are the standard fields that should always be available
const SYSTEM_FIELD_DEFAULTS = {
  first_name: {
    field_name: 'first_name',
    field_label: 'First Name',
    field_type: 'text',
    is_required: true,
    is_enabled: true,
    show_in_create_form: true,
    show_in_edit_form: true,
    show_in_detail_view: true,
    show_in_list_view: true,
    field_options: null,
    display_order: 1
  },
  last_name: {
    field_name: 'last_name',
    field_label: 'Last Name',
    field_type: 'text',
    is_required: true,
    is_enabled: true,
    show_in_create_form: true,
    show_in_edit_form: true,
    show_in_detail_view: true,
    show_in_list_view: true,
    field_options: null,
    display_order: 2
  },
  email: {
    field_name: 'email',
    field_label: 'Email',
    field_type: 'email',
    is_required: true,
    is_enabled: true,
    show_in_create_form: true,
    show_in_edit_form: true,
    show_in_detail_view: true,
    show_in_list_view: true,
    field_options: null,
    display_order: 3
  },
  phone: {
    field_name: 'phone',
    field_label: 'Phone',
    field_type: 'text',
    is_required: false,
    is_enabled: true,
    show_in_create_form: true,
    show_in_edit_form: true,
    show_in_detail_view: true,
    show_in_list_view: false,
    field_options: null,
    display_order: 4
  },
  company: {
    field_name: 'company',
    field_label: 'Company',
    field_type: 'text',
    is_required: false,
    is_enabled: true,
    show_in_create_form: true,
    show_in_edit_form: true,
    show_in_detail_view: true,
    show_in_list_view: false,
    field_options: null,
    display_order: 5
  },
  source: {
    field_name: 'source',
    field_label: 'Source',
    field_type: 'select',
    is_required: false,
    is_enabled: true,
    show_in_create_form: true,
    show_in_edit_form: true,
    show_in_detail_view: true,
    show_in_list_view: true,
    field_options: ['website', 'referral', 'phone', 'email', 'social_media', 'event', 'manual'],
    display_order: 6
  },
  status: {
    field_name: 'status',
    field_label: 'Status',
    field_type: 'select',
    is_required: false,
    is_enabled: true,
    show_in_create_form: true,
    show_in_edit_form: true,
    show_in_detail_view: true,
    show_in_list_view: true,
    field_options: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],
    display_order: 7
  },
  priority: {
    field_name: 'priority',
    field_label: 'Priority',
    field_type: 'select',
    is_required: false,
    is_enabled: true,
    show_in_create_form: true,
    show_in_edit_form: true,
    show_in_detail_view: true,
    show_in_list_view: true,
    field_options: ['low', 'medium', 'high'],
    display_order: 8
  },
  value: {
    field_name: 'value',
    field_label: 'Potential Value ($)',
    field_type: 'number',
    is_required: false,
    is_enabled: true,
    show_in_create_form: true,
    show_in_edit_form: true,
    show_in_detail_view: true,
    show_in_list_view: false,
    field_options: null,
    display_order: 9
  },
  assigned_to: {
    field_name: 'assigned_to',
    field_label: 'Assign To',
    field_type: 'user_select',
    is_required: false,
    is_enabled: true,
    show_in_create_form: true,
    show_in_edit_form: true,
    show_in_detail_view: true,
    show_in_list_view: false,
    field_options: null,
    display_order: 10
  },
  next_follow_up: {
    field_name: 'next_follow_up',
    field_label: 'Next Follow Up',
    field_type: 'date',
    is_required: false,
    is_enabled: true,
    show_in_create_form: true,
    show_in_edit_form: true,
    show_in_detail_view: true,
    show_in_list_view: false,
    field_options: null,
    display_order: 11
  },
  notes: {
    field_name: 'notes',
    field_label: 'Notes',
    field_type: 'textarea',
    is_required: false,
    is_enabled: true,
    show_in_create_form: true,
    show_in_edit_form: true,
    show_in_detail_view: true,
    show_in_list_view: false,
    field_options: null,
    display_order: 12
  }
}

// ========================================
// FIELD DEFINITIONS ROUTES
// ========================================

/**
 * GET /api/custom-fields
 * Get all custom field definitions (optionally filtered by entityType query param)
 * Phase 1: Applies visibility logic to all fields
 */
router.get('/', async (req, res) => {
  try {
    console.log('📥 GET /api/custom-fields - Request received')
    console.log('Query params:', req.query)
    console.log('User:', req.user?.id, 'Org:', req.user?.organization_id)

    const { entityType, activeOnly = 'true', context } = req.query
    const organizationId = req.user.organization_id

    if (!organizationId) {
      console.error('❌ No organization_id found in request')
      return res.status(400).json({
        error: 'Missing organization context',
        details: 'User must be associated with an organization'
      })
    }

    // If entityType is provided, filter by it
    if (entityType) {
      // Validate entity type
      const validEntityTypes = ['leads', 'contacts', 'accounts', 'transactions', 'product']
      if (!validEntityTypes.includes(entityType)) {
        return res.status(400).json({
          error: 'Invalid entity type',
          validTypes: validEntityTypes
        })
      }

      console.log(`🔍 Fetching fields for entityType: ${entityType}`)
      let fields = await CustomField.getFieldDefinitions(
        organizationId,
        entityType,
        activeOnly === 'true'
      )

      // Phase 1: Apply visibility logic to all fields
      fields = fields.map(field => fieldVisibilityService.applyVisibilityLogic(field))

      // Filter by context if requested
      if (context) {
        fields = fields.filter(field => fieldVisibilityService.isVisibleInContext(field, context))
        console.log(`🔍 Filtered to ${fields.length} fields visible in context: ${context}`)
      }

      console.log(`✅ Found ${fields.length} fields for ${entityType}`)
      return res.json({
        success: true,
        entityType,
        count: fields.length,
        fields
      })
    }

    // If no entityType, return all fields grouped by entity type
    console.log('🔍 Fetching all fields for all entity types')
    const allFields = {}
    const entityTypes = ['leads', 'contacts', 'accounts', 'transactions', 'product']

    for (const type of entityTypes) {
      let fields = await CustomField.getFieldDefinitions(
        organizationId,
        type,
        activeOnly === 'true'
      )

      // Phase 1: Apply visibility logic to all fields
      fields = fields.map(field => fieldVisibilityService.applyVisibilityLogic(field))

      // Filter by context if requested
      if (context) {
        fields = fields.filter(field => fieldVisibilityService.isVisibleInContext(field, context))
      }

      allFields[type] = fields
    }

    const totalCount = Object.values(allFields).reduce((sum, fields) => sum + fields.length, 0)
    console.log(`✅ Found ${totalCount} total fields across all entity types`)

    res.json({
      success: true,
      count: totalCount,
      fieldsByEntityType: allFields
    })
  } catch (error) {
    console.error('❌ Error in GET /api/custom-fields:', error)
    console.error('Stack trace:', error.stack)
    res.status(500).json({
      error: 'Failed to fetch custom fields',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * POST /api/custom-fields
 * Create a new custom field definition (convenience endpoint - same as POST /definitions)
 */
router.post('/', async (req, res) => {
  try {
    console.log('='.repeat(80))
    console.log('=== CODE VERSION: backend/routes/customFields.js - 2025-11-08-v6 ===')
    console.log('=== FILE: backend/routes/customFields.js (NEW FILE WITH CustomField MODEL) ===')
    console.log('='.repeat(80))
    console.log('================================================================================')
    console.log('📥 POST /api/custom-fields - ROUTE HANDLER START')
    console.log('================================================================================')
    console.log('🔍 STEP 1: RAW REQUEST BODY')
    console.log('  Full body:', JSON.stringify(req.body, null, 2))
    console.log('  field_options type:', typeof req.body.field_options)
    console.log('  field_options value:', req.body.field_options)
    console.log('  field_options is array?:', Array.isArray(req.body.field_options))
    if (Array.isArray(req.body.field_options)) {
      console.log('  field_options length:', req.body.field_options.length)
      console.log('  First element:', req.body.field_options[0])
      console.log('  First element type:', typeof req.body.field_options[0])
      console.log('  First element stringified:', JSON.stringify(req.body.field_options[0]))
    }
    console.log('User:', { id: req.user?.id, organization_id: req.user?.organization_id })

    const organizationId = req.user.organization_id
    const userId = req.user.id

    if (!organizationId) {
      console.error('❌ No organization_id found')
      return res.status(400).json({
        error: 'Missing organization context',
        details: 'User must be associated with an organization'
      })
    }

    // Support both camelCase and snake_case field names from frontend
    const {
      fieldName, field_name,
      fieldLabel, field_label,
      fieldDescription, field_description,
      entityType, entity_type,
      fieldType, field_type,
      isRequired, is_required,
      isSearchable, is_searchable,
      isFilterable, is_filterable,
      displayOrder, display_order,
      showInListView, show_in_list_view,
      showInDetailView, show_in_detail_view,
      showInCreateForm, show_in_create_form,
      showInEditForm, show_in_edit_form,
      validationRules, validation_rules,
      fieldOptions, field_options,
      defaultValue, default_value,
      placeholder,
      fieldGroup, field_group,
      // Phase 1: Visibility fields
      overall_visibility,
      visibility_logic
    } = req.body

    // Normalize to camelCase (prefer camelCase, fallback to snake_case)
    const normalizedData = {
      fieldName: fieldName || field_name,
      fieldLabel: fieldLabel || field_label,
      fieldDescription: fieldDescription || field_description,
      entityType: entityType || entity_type || 'leads', // Default to 'leads' if not provided
      fieldType: fieldType || field_type,
      isRequired: isRequired !== undefined ? isRequired : is_required,
      isSearchable: isSearchable !== undefined ? isSearchable : is_searchable,
      isFilterable: isFilterable !== undefined ? isFilterable : is_filterable,
      displayOrder: displayOrder !== undefined ? displayOrder : display_order,
      showInListView: showInListView !== undefined ? showInListView : show_in_list_view,
      showInDetailView: showInDetailView !== undefined ? showInDetailView : show_in_detail_view,
      showInCreateForm: showInCreateForm !== undefined ? showInCreateForm : show_in_create_form,
      showInEditForm: showInEditForm !== undefined ? showInEditForm : show_in_edit_form,
      validationRules: validationRules || validation_rules,
      fieldOptions: fieldOptions || field_options,
      defaultValue: defaultValue !== undefined ? defaultValue : default_value,
      placeholder: placeholder,
      fieldGroup: fieldGroup || field_group,
      // Phase 1: Visibility fields
      overall_visibility: overall_visibility || 'visible',
      visibility_logic: visibility_logic || 'master_override'
    }

    console.log('🔍 STEP 2: AFTER NORMALIZATION')
    console.log('  normalizedData.fieldOptions type:', typeof normalizedData.fieldOptions)
    console.log('  normalizedData.fieldOptions is array?:', Array.isArray(normalizedData.fieldOptions))
    console.log('  normalizedData.fieldOptions value:', normalizedData.fieldOptions)
    if (Array.isArray(normalizedData.fieldOptions) && normalizedData.fieldOptions.length > 0) {
      console.log('  normalizedData.fieldOptions[0]:', normalizedData.fieldOptions[0])
      console.log('  normalizedData.fieldOptions[0] type:', typeof normalizedData.fieldOptions[0])
    }

    console.log('📋 Extracted field data:', {
      fieldName: normalizedData.fieldName,
      fieldLabel: normalizedData.fieldLabel,
      entityType: normalizedData.entityType,
      fieldType: normalizedData.fieldType,
      fieldOptions: normalizedData.fieldOptions?.length || 0,
      organizationId
    })

    // Validate required fields
    if (!normalizedData.fieldName || !normalizedData.fieldLabel || !normalizedData.entityType || !normalizedData.fieldType) {
      console.error('❌ Missing required fields:', {
        fieldName: normalizedData.fieldName,
        fieldLabel: normalizedData.fieldLabel,
        entityType: normalizedData.entityType,
        fieldType: normalizedData.fieldType
      })
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['fieldName', 'fieldLabel', 'entityType', 'fieldType'],
        received: {
          fieldName: normalizedData.fieldName,
          fieldLabel: normalizedData.fieldLabel,
          entityType: normalizedData.entityType,
          fieldType: normalizedData.fieldType
        }
      })
    }

    // Validate entity type
    const validEntityTypes = ['leads', 'contacts', 'accounts', 'transactions', 'product']
    if (!validEntityTypes.includes(normalizedData.entityType)) {
      console.error('❌ Invalid entity type:', normalizedData.entityType)
      return res.status(400).json({
        error: 'Invalid entity type',
        validTypes: validEntityTypes,
        received: normalizedData.entityType
      })
    }

    // Validate field type
    const validFieldTypes = [
      'text', 'number', 'email', 'phone', 'url', 'date', 'datetime',
      'textarea', 'select', 'multiselect', 'checkbox', 'radio'
    ]
    if (!validFieldTypes.includes(normalizedData.fieldType)) {
      console.error('❌ Invalid field type:', normalizedData.fieldType)
      return res.status(400).json({
        error: 'Invalid field type',
        validTypes: validFieldTypes,
        received: normalizedData.fieldType
      })
    }

    // Validate field options for select/multiselect/radio
    if (['select', 'multiselect', 'radio'].includes(normalizedData.fieldType)) {
      console.log('🔍 Validating field options for', normalizedData.fieldType)
      console.log('Field options received:', normalizedData.fieldOptions)

      if (!normalizedData.fieldOptions || !Array.isArray(normalizedData.fieldOptions) || normalizedData.fieldOptions.length === 0) {
        console.error('❌ Missing or invalid field options for select/multiselect/radio field')
        return res.status(400).json({
          error: 'Field options are required for select, multiselect, and radio field types',
          fieldType: normalizedData.fieldType,
          received: normalizedData.fieldOptions
        })
      }
      console.log('✅ Field options valid:', normalizedData.fieldOptions.length, 'options')
    }

    // Validate Phase 1 visibility fields
    const validVisibilityStates = ['visible', 'hidden']
    const validVisibilityLogics = ['master_override', 'context_based']

    if (normalizedData.overall_visibility && !validVisibilityStates.includes(normalizedData.overall_visibility)) {
      console.error('❌ Invalid overall_visibility:', normalizedData.overall_visibility)
      return res.status(400).json({
        error: 'Invalid overall_visibility value',
        validValues: validVisibilityStates,
        received: normalizedData.overall_visibility
      })
    }

    if (normalizedData.visibility_logic && !validVisibilityLogics.includes(normalizedData.visibility_logic)) {
      console.error('❌ Invalid visibility_logic:', normalizedData.visibility_logic)
      return res.status(400).json({
        error: 'Invalid visibility_logic value',
        validValues: validVisibilityLogics,
        received: normalizedData.visibility_logic
      })
    }

    console.log('✅ Phase 1 visibility fields valid')
    console.log('   overall_visibility:', normalizedData.overall_visibility)
    console.log('   visibility_logic:', normalizedData.visibility_logic)

    const fieldData = {
      organizationId,
      fieldName: normalizedData.fieldName,
      fieldLabel: normalizedData.fieldLabel,
      fieldDescription: normalizedData.fieldDescription,
      entityType: normalizedData.entityType,
      fieldType: normalizedData.fieldType,
      isRequired: normalizedData.isRequired,
      isSearchable: normalizedData.isSearchable,
      isFilterable: normalizedData.isFilterable,
      displayOrder: normalizedData.displayOrder,
      showInListView: normalizedData.showInListView,
      showInDetailView: normalizedData.showInDetailView,
      showInCreateForm: normalizedData.showInCreateForm,
      showInEditForm: normalizedData.showInEditForm,
      validationRules: normalizedData.validationRules,
      fieldOptions: normalizedData.fieldOptions,
      defaultValue: normalizedData.defaultValue,
      placeholder: normalizedData.placeholder,
      fieldGroup: normalizedData.fieldGroup,
      // Phase 1: Visibility fields
      overall_visibility: normalizedData.overall_visibility,
      visibility_logic: normalizedData.visibility_logic,
      createdBy: userId
    }

    console.log('💾 Calling CustomField.createFieldDefinition with:', {
      ...fieldData,
      fieldOptions: fieldData.fieldOptions?.length || 0
    })

    // CRITICAL: Log the exact data about to be passed to model
    console.log('🔍 STEP 3: BEFORE CALLING MODEL')
    console.log('  fieldData.fieldOptions type:', typeof fieldData.fieldOptions)
    console.log('  fieldData.fieldOptions is array?:', Array.isArray(fieldData.fieldOptions))
    console.log('  fieldData.fieldOptions value:', fieldData.fieldOptions)
    console.log('  fieldData.fieldOptions stringified:', JSON.stringify(fieldData.fieldOptions))
    if (Array.isArray(fieldData.fieldOptions) && fieldData.fieldOptions.length > 0) {
      console.log('  fieldData.fieldOptions[0]:', fieldData.fieldOptions[0])
      console.log('  fieldData.fieldOptions[0] type:', typeof fieldData.fieldOptions[0])
    }
    console.log('================================================================================')

    const field = await CustomField.createFieldDefinition(fieldData)

    console.log('================================================================================')
    console.log('🎉 Model returned successfully:', field.id)
    console.log('================================================================================')

    console.log('✅ Field created successfully:', field.id)

    res.status(201).json({
      success: true,
      message: 'Field definition created successfully',
      field
    })
  } catch (error) {
    console.error('❌ Error creating field definition:', error)
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    console.error('Error code:', error.code)
    console.error('Error stack:', error.stack)

    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'A field with this name already exists for this entity type',
        details: error.message
      })
    }

    // Handle database errors
    if (error.code) {
      return res.status(500).json({
        error: 'Database error',
        code: error.code,
        details: error.message,
        hint: error.hint
      })
    }

    res.status(500).json({
      error: 'Failed to create field definition',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * GET /api/custom-fields/definitions/:entityType
 * Get all custom field definitions for an entity type
 */
router.get('/definitions/:entityType', async (req, res) => {
  try {
    const { entityType } = req.params
    const { activeOnly = 'true' } = req.query
    const organizationId = req.user.organization_id

    console.log(`📥 GET /api/custom-fields/definitions/${entityType}`)

    // Validate entity type
    const validEntityTypes = ['leads', 'contacts', 'accounts', 'transactions', 'product']
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

    console.log(`✅ Found ${fields.length} fields`)

    res.json({
      success: true,
      entityType,
      count: fields.length,
      fields
    })
  } catch (error) {
    console.error('❌ Error fetching field definitions:', error)
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

    console.log(`📥 GET /api/custom-fields/definitions/:entityType/${fieldId}`)

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
    console.error('❌ Error fetching field definition:', error)
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
    console.log('📥 POST /api/custom-fields/definitions')
    console.log('Request body:', JSON.stringify(req.body, null, 2))
    console.log('User:', { id: req.user?.id, organization_id: req.user?.organization_id })

    const organizationId = req.user.organization_id
    const userId = req.user.id

    if (!organizationId) {
      console.error('❌ No organization_id found')
      return res.status(400).json({
        error: 'Missing organization context',
        details: 'User must be associated with an organization'
      })
    }

    // Support both camelCase and snake_case field names from frontend
    const {
      fieldName, field_name,
      fieldLabel, field_label,
      fieldDescription, field_description,
      entityType, entity_type,
      fieldType, field_type,
      isRequired, is_required,
      isSearchable, is_searchable,
      isFilterable, is_filterable,
      displayOrder, display_order,
      showInListView, show_in_list_view,
      showInDetailView, show_in_detail_view,
      showInCreateForm, show_in_create_form,
      showInEditForm, show_in_edit_form,
      validationRules, validation_rules,
      fieldOptions, field_options,
      defaultValue, default_value,
      placeholder,
      fieldGroup, field_group,
      // Phase 1: Visibility fields
      overall_visibility,
      visibility_logic
    } = req.body

    // Normalize to camelCase (prefer camelCase, fallback to snake_case)
    const normalizedData = {
      fieldName: fieldName || field_name,
      fieldLabel: fieldLabel || field_label,
      fieldDescription: fieldDescription || field_description,
      entityType: entityType || entity_type || 'leads', // Default to 'leads' if not provided
      fieldType: fieldType || field_type,
      isRequired: isRequired !== undefined ? isRequired : is_required,
      isSearchable: isSearchable !== undefined ? isSearchable : is_searchable,
      isFilterable: isFilterable !== undefined ? isFilterable : is_filterable,
      displayOrder: displayOrder !== undefined ? displayOrder : display_order,
      showInListView: showInListView !== undefined ? showInListView : show_in_list_view,
      showInDetailView: showInDetailView !== undefined ? showInDetailView : show_in_detail_view,
      showInCreateForm: showInCreateForm !== undefined ? showInCreateForm : show_in_create_form,
      showInEditForm: showInEditForm !== undefined ? showInEditForm : show_in_edit_form,
      validationRules: validationRules || validation_rules,
      fieldOptions: fieldOptions || field_options,
      defaultValue: defaultValue !== undefined ? defaultValue : default_value,
      placeholder: placeholder,
      fieldGroup: fieldGroup || field_group,
      // Phase 1: Visibility fields
      overall_visibility: overall_visibility || 'visible',
      visibility_logic: visibility_logic || 'master_override'
    }

    console.log('📋 Extracted field data:', {
      fieldName: normalizedData.fieldName,
      fieldLabel: normalizedData.fieldLabel,
      entityType: normalizedData.entityType,
      fieldType: normalizedData.fieldType,
      fieldOptions: normalizedData.fieldOptions?.length || 0,
      organizationId
    })

    // Validate required fields
    if (!normalizedData.fieldName || !normalizedData.fieldLabel || !normalizedData.entityType || !normalizedData.fieldType) {
      console.error('❌ Missing required fields:', {
        fieldName: normalizedData.fieldName,
        fieldLabel: normalizedData.fieldLabel,
        entityType: normalizedData.entityType,
        fieldType: normalizedData.fieldType
      })
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['fieldName', 'fieldLabel', 'entityType', 'fieldType'],
        received: {
          fieldName: normalizedData.fieldName,
          fieldLabel: normalizedData.fieldLabel,
          entityType: normalizedData.entityType,
          fieldType: normalizedData.fieldType
        }
      })
    }

    // Validate entity type
    const validEntityTypes = ['leads', 'contacts', 'accounts', 'transactions', 'product']
    if (!validEntityTypes.includes(normalizedData.entityType)) {
      console.error('❌ Invalid entity type:', normalizedData.entityType)
      return res.status(400).json({
        error: 'Invalid entity type',
        validTypes: validEntityTypes,
        received: normalizedData.entityType
      })
    }

    // Validate field type
    const validFieldTypes = [
      'text', 'number', 'email', 'phone', 'url', 'date', 'datetime',
      'textarea', 'select', 'multiselect', 'checkbox', 'radio'
    ]
    if (!validFieldTypes.includes(normalizedData.fieldType)) {
      console.error('❌ Invalid field type:', normalizedData.fieldType)
      return res.status(400).json({
        error: 'Invalid field type',
        validTypes: validFieldTypes,
        received: normalizedData.fieldType
      })
    }

    // Validate field options for select/multiselect/radio
    if (['select', 'multiselect', 'radio'].includes(normalizedData.fieldType)) {
      console.log('🔍 Validating field options for', normalizedData.fieldType)
      console.log('Field options received:', normalizedData.fieldOptions)

      if (!normalizedData.fieldOptions || !Array.isArray(normalizedData.fieldOptions) || normalizedData.fieldOptions.length === 0) {
        console.error('❌ Missing or invalid field options for select/multiselect/radio field')
        return res.status(400).json({
          error: 'Field options are required for select, multiselect, and radio field types',
          fieldType: normalizedData.fieldType,
          received: normalizedData.fieldOptions
        })
      }
      console.log('✅ Field options valid:', normalizedData.fieldOptions.length, 'options')
    }

    // Validate Phase 1 visibility fields
    const validVisibilityStates = ['visible', 'hidden']
    const validVisibilityLogics = ['master_override', 'context_based']

    if (normalizedData.overall_visibility && !validVisibilityStates.includes(normalizedData.overall_visibility)) {
      console.error('❌ Invalid overall_visibility:', normalizedData.overall_visibility)
      return res.status(400).json({
        error: 'Invalid overall_visibility value',
        validValues: validVisibilityStates,
        received: normalizedData.overall_visibility
      })
    }

    if (normalizedData.visibility_logic && !validVisibilityLogics.includes(normalizedData.visibility_logic)) {
      console.error('❌ Invalid visibility_logic:', normalizedData.visibility_logic)
      return res.status(400).json({
        error: 'Invalid visibility_logic value',
        validValues: validVisibilityLogics,
        received: normalizedData.visibility_logic
      })
    }

    console.log('✅ Phase 1 visibility fields valid')
    console.log('   overall_visibility:', normalizedData.overall_visibility)
    console.log('   visibility_logic:', normalizedData.visibility_logic)

    const fieldData = {
      organizationId,
      fieldName: normalizedData.fieldName,
      fieldLabel: normalizedData.fieldLabel,
      fieldDescription: normalizedData.fieldDescription,
      entityType: normalizedData.entityType,
      fieldType: normalizedData.fieldType,
      isRequired: normalizedData.isRequired,
      isSearchable: normalizedData.isSearchable,
      isFilterable: normalizedData.isFilterable,
      displayOrder: normalizedData.displayOrder,
      showInListView: normalizedData.showInListView,
      showInDetailView: normalizedData.showInDetailView,
      showInCreateForm: normalizedData.showInCreateForm,
      showInEditForm: normalizedData.showInEditForm,
      validationRules: normalizedData.validationRules,
      fieldOptions: normalizedData.fieldOptions,
      defaultValue: normalizedData.defaultValue,
      placeholder: normalizedData.placeholder,
      fieldGroup: normalizedData.fieldGroup,
      // Phase 1: Visibility fields
      overall_visibility: normalizedData.overall_visibility,
      visibility_logic: normalizedData.visibility_logic,
      createdBy: userId
    }

    console.log('💾 Calling CustomField.createFieldDefinition with:', {
      ...fieldData,
      fieldOptions: fieldData.fieldOptions?.length || 0
    })

    // CRITICAL: Log the exact data about to be passed to model
    console.log('🔍 STEP 3: BEFORE CALLING MODEL')
    console.log('  fieldData.fieldOptions type:', typeof fieldData.fieldOptions)
    console.log('  fieldData.fieldOptions is array?:', Array.isArray(fieldData.fieldOptions))
    console.log('  fieldData.fieldOptions value:', fieldData.fieldOptions)
    console.log('  fieldData.fieldOptions stringified:', JSON.stringify(fieldData.fieldOptions))
    if (Array.isArray(fieldData.fieldOptions) && fieldData.fieldOptions.length > 0) {
      console.log('  fieldData.fieldOptions[0]:', fieldData.fieldOptions[0])
      console.log('  fieldData.fieldOptions[0] type:', typeof fieldData.fieldOptions[0])
    }
    console.log('================================================================================')

    const field = await CustomField.createFieldDefinition(fieldData)

    console.log('================================================================================')
    console.log('🎉 Model returned successfully:', field.id)
    console.log('================================================================================')

    console.log('✅ Field created successfully:', field.id)

    res.status(201).json({
      success: true,
      message: 'Field definition created successfully',
      field
    })
  } catch (error) {
    console.error('❌ Error creating field definition:', error)
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    console.error('Error code:', error.code)
    console.error('Error stack:', error.stack)

    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'A field with this name already exists for this entity type',
        details: error.message
      })
    }

    // Handle database errors
    if (error.code) {
      return res.status(500).json({
        error: 'Database error',
        code: error.code,
        details: error.message,
        hint: error.hint
      })
    }

    res.status(500).json({
      error: 'Failed to create field definition',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * PUT /api/custom-fields/definitions/:fieldId
 * Update a custom field definition
 * Phase 1: Validates updates using fieldVisibilityService
 */
router.put('/definitions/:fieldId', async (req, res) => {
  try {
    const { fieldId } = req.params
    const organizationId = req.user.organization_id
    const userId = req.user.id

    console.log(`📥 PUT /api/custom-fields/definitions/${fieldId}`)

    // Phase 1: Validate and adjust updates
    let updateData = fieldVisibilityService.validateUpdate(req.body)

    const field = await CustomField.updateFieldDefinition(
      fieldId,
      organizationId,
      updateData,
      userId
    )

    // Phase 1: Apply visibility logic to response
    const processedField = fieldVisibilityService.applyVisibilityLogic(field)

    console.log('✅ Field updated successfully')

    // Phase 1: Include adjustment info if auto-adjusted
    const response = {
      success: true,
      message: 'Field definition updated successfully',
      field: processedField
    }

    if (updateData._auto_adjusted) {
      response.adjusted = true
      response.adjustment_reason = updateData._adjustment_reason
    }

    res.json(response)
  } catch (error) {
    console.error('❌ Error updating field definition:', error)

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
 * GET /api/custom-fields/definitions/:fieldId/visibility-status
 * Get visibility status for a field (Phase 1)
 * Returns effective visibility configuration for UI display
 */
router.get('/definitions/:fieldId/visibility-status', async (req, res) => {
  try {
    const { fieldId } = req.params
    const organizationId = req.user.organization_id

    console.log(`📥 GET /api/custom-fields/definitions/${fieldId}/visibility-status`)

    const field = await CustomField.getFieldDefinitionById(fieldId, organizationId)

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Field not found'
      })
    }

    const status = fieldVisibilityService.getVisibilityStatus(field)

    console.log('✅ Retrieved visibility status')

    res.json({
      success: true,
      data: status
    })
  } catch (error) {
    console.error('❌ Error fetching visibility status:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch visibility status',
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

    console.log(`📥 DELETE /api/custom-fields/definitions/${fieldId} (permanent: ${permanent})`)

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

    console.log('✅ Field deleted successfully')

    res.json({
      success: true,
      message: permanent === 'true'
        ? 'Field definition permanently deleted'
        : 'Field definition deactivated'
    })
  } catch (error) {
    console.error('❌ Error deleting field definition:', error)
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

    console.log(`📥 GET /api/custom-fields/values/${entityType}/${entityId}`)

    const fieldValues = await CustomField.getFieldValues(
      organizationId,
      entityType,
      entityId
    )

    console.log(`✅ Found ${fieldValues.length} field values`)

    res.json({
      success: true,
      entityType,
      entityId,
      count: fieldValues.length,
      fieldValues
    })
  } catch (error) {
    console.error('❌ Error fetching field values:', error)
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
    console.log('📥 POST /api/custom-fields/values')

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

    console.log('✅ Field value saved successfully')

    res.status(201).json({
      success: true,
      message: 'Field value saved successfully',
      value
    })
  } catch (error) {
    console.error('❌ Error saving field value:', error)
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
    console.log('📥 POST /api/custom-fields/values/bulk')

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

    console.log(`✅ Saved ${results.length} field values`)

    res.status(201).json({
      success: true,
      message: 'Field values saved successfully',
      count: results.length,
      values: results
    })
  } catch (error) {
    console.error('❌ Error saving field values:', error)
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

    console.log(`📥 DELETE /api/custom-fields/values/${valueId}`)

    const success = await CustomField.deleteFieldValue(valueId, organizationId)

    if (!success) {
      return res.status(404).json({
        error: 'Field value not found'
      })
    }

    console.log('✅ Field value deleted successfully')

    res.json({
      success: true,
      message: 'Field value deleted successfully'
    })
  } catch (error) {
    console.error('❌ Error deleting field value:', error)
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

    console.log(`📥 DELETE /api/custom-fields/values/${entityType}/${entityId}`)

    const count = await CustomField.deleteAllFieldValuesForEntity(
      organizationId,
      entityType,
      entityId
    )

    console.log(`✅ Deleted ${count} field values`)

    res.json({
      success: true,
      message: `Deleted ${count} field values`,
      count
    })
  } catch (error) {
    console.error('❌ Error deleting field values:', error)
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

    console.log('📥 POST /api/custom-fields/validate')

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
    console.error('❌ Error validating field value:', error)
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

    console.log('📥 POST /api/custom-fields/values/batch')

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

    console.log(`✅ Retrieved field values for ${Object.keys(fieldValues).length} entities`)

    res.json({
      success: true,
      entityType,
      count: Object.keys(fieldValues).length,
      fieldValues
    })
  } catch (error) {
    console.error('❌ Error fetching batch field values:', error)
    res.status(500).json({
      error: 'Failed to fetch field values',
      details: error.message
    })
  }
})

/**
 * GET /api/custom-fields/form-config
 * Get complete form configuration including system fields and custom fields
 * with all visibility flags needed for dynamic form rendering
 */
router.get('/form-config', async (req, res) => {
  try {
    console.log('📥 GET /api/custom-fields/form-config')

    const organizationId = req.user.organization_id

    if (!organizationId) {
      return res.status(400).json({
        error: 'Missing organization context',
        details: 'User must be associated with an organization'
      })
    }

    // Fetch custom fields with ALL visibility flags
    const customFieldsResult = await CustomField.getFieldDefinitions(
      organizationId,
      'leads', // Default to leads, but this endpoint serves all entity types
      true // activeOnly
    )

    // Fetch system fields from default_field_configurations with visibility flags
    let systemFieldsResult = []
    let storedConfigs = {}

    try {
      // Try to fetch with visibility flags first (if columns exist)
      try {
        const systemFieldsQuery = `
          SELECT
            id,
            field_name,
            field_label,
            field_type,
            field_options,
            is_required,
            is_enabled,
            COALESCE(show_in_create_form, true) as show_in_create_form,
            COALESCE(show_in_edit_form, true) as show_in_edit_form,
            COALESCE(show_in_detail_view, true) as show_in_detail_view,
            COALESCE(show_in_list_view, false) as show_in_list_view,
            display_order
          FROM default_field_configurations
          WHERE organization_id = $1
          ORDER BY display_order ASC, field_name ASC
        `
        const systemFieldsRes = await require('../database/connection').query(systemFieldsQuery, [organizationId])

        // Store configs by field_name for merging with defaults
        systemFieldsRes.rows.forEach(row => {
          storedConfigs[row.field_name] = row
        })
      } catch (innerError) {
        // If visibility columns don't exist, fetch without them and add defaults
        console.warn('⚠️ Could not fetch with visibility flags, trying without:', innerError.message)
        try {
          const fallbackQuery = `
            SELECT
              id,
              field_name,
              field_label,
              field_type,
              field_options,
              is_required,
              is_enabled,
              display_order
            FROM default_field_configurations
            WHERE organization_id = $1
            ORDER BY display_order ASC, field_name ASC
          `
          const fallbackRes = await require('../database/connection').query(fallbackQuery, [organizationId])
          fallbackRes.rows.forEach(row => {
            storedConfigs[row.field_name] = {
              ...row,
              show_in_create_form: true,
              show_in_edit_form: true,
              show_in_detail_view: true,
              show_in_list_view: false
            }
          })
        } catch (fallbackError) {
          console.warn('⚠️ Could not fetch from default_field_configurations table:', fallbackError.message)
        }
      }

      // Build final system fields by merging defaults with stored configs
      systemFieldsResult = Object.values(SYSTEM_FIELD_DEFAULTS).map(defaultField => {
        const stored = storedConfigs[defaultField.field_name] || {}
        return {
          ...defaultField,
          // Override defaults with stored values if they exist
          ...(stored.id && { id: stored.id }),
          ...(stored.field_label && { field_label: stored.field_label }),
          ...(stored.is_required !== undefined && { is_required: stored.is_required }),
          ...(stored.is_enabled !== undefined && { is_enabled: stored.is_enabled }),
          ...(stored.show_in_create_form !== undefined && { show_in_create_form: stored.show_in_create_form }),
          ...(stored.show_in_edit_form !== undefined && { show_in_edit_form: stored.show_in_edit_form }),
          ...(stored.show_in_detail_view !== undefined && { show_in_detail_view: stored.show_in_detail_view }),
          ...(stored.show_in_list_view !== undefined && { show_in_list_view: stored.show_in_list_view }),
          ...(stored.display_order !== undefined && { display_order: stored.display_order })
        }
      }).filter(field => field.is_enabled !== false)

    } catch (error) {
      console.warn('⚠️ Could not fetch system fields from default_field_configurations:', error.message)
      // Even if there's an error, provide the defaults
      systemFieldsResult = Object.values(SYSTEM_FIELD_DEFAULTS).filter(field => field.is_enabled !== false)
    }

    console.log(`✅ Retrieved ${customFieldsResult.length} custom fields and ${systemFieldsResult.length} system fields`)

    res.json({
      success: true,
      customFields: customFieldsResult,
      systemFields: systemFieldsResult,
      count: {
        custom: customFieldsResult.length,
        system: systemFieldsResult.length,
        total: customFieldsResult.length + systemFieldsResult.length
      }
    })
  } catch (error) {
    console.error('❌ Error fetching form config:', error)
    res.status(500).json({
      error: 'Failed to fetch form configuration',
      details: error.message
    })
  }
})

/**
 * GET /api/custom-fields/debug-config
 * Debug endpoint to see raw field configurations
 */
router.get('/debug-config', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const db = require('../database/connection');

    console.log('🔍 DEBUG: Checking field configurations for org:', organizationId);

    // Get raw data from database
    let dbRows = [];
    try {
      const query = `
        SELECT * FROM default_field_configurations
        WHERE organization_id = $1
        ORDER BY field_name ASC
      `;
      const result = await db.query(query, [organizationId]);
      dbRows = result.rows;
    } catch (error) {
      console.error('Error fetching from DB:', error);
    }

    // Get what the API would return
    const apiData = await require('../models/CustomField').getFieldDefinitions(organizationId, 'leads', true);

    // Get system fields as they would be sent
    let storedConfigs = {};
    try {
      const systemFieldsQuery = `
        SELECT * FROM default_field_configurations
        WHERE organization_id = $1
      `;
      const systemFieldsRes = await db.query(systemFieldsQuery, [organizationId]);
      systemFieldsRes.rows.forEach(row => {
        storedConfigs[row.field_name] = row;
      });
    } catch (error) {
      console.error('Error:', error);
    }

    const mergedSystemFields = Object.values(SYSTEM_FIELD_DEFAULTS).map(defaultField => {
      const stored = storedConfigs[defaultField.field_name] || {};
      return {
        field_name: defaultField.field_name,
        default_is_enabled: defaultField.is_enabled,
        default_show_in_create: defaultField.show_in_create_form,
        stored_is_enabled: stored.is_enabled,
        stored_show_in_create: stored.show_in_create_form,
        final_is_enabled: stored.is_enabled !== undefined ? stored.is_enabled : defaultField.is_enabled,
        final_show_in_create: stored.show_in_create_form !== undefined ? stored.show_in_create_form : defaultField.show_in_create_form,
        will_pass_filter: (stored.is_enabled !== undefined ? stored.is_enabled : defaultField.is_enabled) !== false,
        has_db_row: !!stored.id
      };
    });

    res.json({
      success: true,
      organization_id: organizationId,
      db_rows_count: dbRows.length,
      db_rows: dbRows,
      merged_system_fields: mergedSystemFields,
      company_field: mergedSystemFields.find(f => f.field_name === 'company'),
      priority_field: mergedSystemFields.find(f => f.field_name === 'priority')
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/custom-fields/default/:fieldName
 * Update a system/default field configuration
 */
router.put('/default/:fieldName', async (req, res) => {
  try {
    const { fieldName } = req.params
    const organizationId = req.user.organization_id
    const updateData = req.body

    console.log(`📥 PUT /api/custom-fields/default/${fieldName}`, updateData)

    if (!organizationId) {
      return res.status(400).json({
        error: 'Missing organization context',
        details: 'User must be associated with an organization'
      })
    }

    // Validate field name is a known system field
    if (!SYSTEM_FIELD_DEFAULTS[fieldName]) {
      return res.status(400).json({
        error: 'Invalid system field',
        details: `Field '${fieldName}' is not a recognized system field`
      })
    }

    // Build the update query dynamically based on provided fields
    const allowedFields = [
      'field_label',
      'field_type',
      'field_options',
      'is_required',
      'is_enabled',
      'show_in_create_form',
      'show_in_edit_form',
      'show_in_detail_view',
      'show_in_list_view',
      'display_order'
    ]

    const updates = {}
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field]
      }
    })

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update',
        details: 'Request must include at least one valid field to update'
      })
    }

    // Check if a configuration row exists for this field
    const db = require('../database/connection')
    const checkQuery = `
      SELECT id FROM default_field_configurations
      WHERE organization_id = $1 AND field_name = $2
    `
    const checkResult = await db.query(checkQuery, [organizationId, fieldName])

    let result
    if (checkResult.rows.length > 0) {
      // Update existing configuration
      const setClause = Object.keys(updates)
        .map((key, idx) => `${key} = $${idx + 3}`)
        .join(', ')

      const updateQuery = `
        UPDATE default_field_configurations
        SET ${setClause}, updated_at = NOW()
        WHERE organization_id = $1 AND field_name = $2
        RETURNING *
      `
      const values = [organizationId, fieldName, ...Object.values(updates)]
      result = await db.query(updateQuery, values)
    } else {
      // Insert new configuration
      const defaultConfig = SYSTEM_FIELD_DEFAULTS[fieldName]
      const insertData = {
        ...defaultConfig,
        ...updates,
        organization_id: organizationId
      }

      const insertFields = Object.keys(insertData)
      const placeholders = insertFields.map((_, idx) => `$${idx + 1}`).join(', ')

      const insertQuery = `
        INSERT INTO default_field_configurations (${insertFields.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `
      const values = Object.values(insertData)
      result = await db.query(insertQuery, values)
    }

    console.log('✅ System field configuration updated successfully')

    res.json({
      success: true,
      message: `Field '${fieldName}' configuration updated successfully`,
      field: result.rows[0]
    })
  } catch (error) {
    console.error('❌ Error updating system field configuration:', error)
    res.status(500).json({
      error: 'Failed to update system field configuration',
      details: error.message
    })
  }
})

module.exports = router
