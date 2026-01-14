const fieldMappingService = require('../services/fieldMappingService');
const { AppError } = require('../utils/errors');
const { pool } = require('../database/connection');

/**
 * Field Mapping Controller
 * Handles HTTP requests for field mapping configuration
 */

/**
 * GET /api/field-mappings
 * Get all field mappings for the organization
 */
exports.getAllMappings = async (req, res, next) => {
  try {
    const { organization_id } = req.user;
    const {
      target_entity_type,
      source_entity_type,
      include_inactive
    } = req.query;

    const filters = {
      target_entity_type,
      source_entity_type,
      include_inactive: include_inactive === 'true'
    };

    const mappings = await fieldMappingService.getAllMappings(organization_id, filters);

    res.json({
      success: true,
      data: mappings,
      count: mappings.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/field-mappings/:id
 * Get a specific field mapping by ID
 */
exports.getMappingById = async (req, res, next) => {
  try {
    const { organization_id } = req.user;
    const { id } = req.params;

    const mapping = await fieldMappingService.getMappingById(organization_id, id);

    if (!mapping) {
      throw new AppError('Field mapping not found', 404);
    }

    res.json({
      success: true,
      data: mapping
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/field-mappings
 * Create a new field mapping
 * Requires admin role
 */
exports.createMapping = async (req, res, next) => {
  try {
    const { organization_id, role } = req.user;

    console.log('createMapping called with body:', JSON.stringify(req.body, null, 2));

    // Check admin permission
    if (role !== 'admin') {
      throw new AppError('Only administrators can create field mappings', 403);
    }

    const mappingData = {
      organization_id,
      ...req.body
    };

    console.log('mappingData prepared:', JSON.stringify(mappingData, null, 2));

    // Validate the mapping configuration
    const validation = await fieldMappingService.validateMappingConfiguration(mappingData);
    console.log('Validation result:', JSON.stringify(validation, null, 2));

    if (!validation.valid) {
      const errorMessage = validation.errors?.join(', ') || 'Invalid mapping configuration';
      throw new AppError(errorMessage, 400);
    }

    const newMapping = await fieldMappingService.createMapping(mappingData);
    console.log('New mapping created:', JSON.stringify(newMapping, null, 2));

    res.status(201).json({
      success: true,
      data: newMapping,
      message: 'Field mapping created successfully'
    });
  } catch (error) {
    console.error('createMapping error:', error.message);
    console.error('createMapping error stack:', error.stack);
    next(error);
  }
};

/**
 * PUT /api/field-mappings/:id
 * Update an existing field mapping
 * Requires admin role
 */
exports.updateMapping = async (req, res, next) => {
  try {
    const { organization_id, role } = req.user;
    const { id } = req.params;

    // Check admin permission
    if (role !== 'admin') {
      throw new AppError('Only administrators can update field mappings', 403);
    }

    // Check if mapping exists and belongs to organization
    const existing = await fieldMappingService.getMappingById(organization_id, id);
    if (!existing) {
      throw new AppError('Field mapping not found', 404);
    }

    // Cannot update system mappings
    if (existing.is_system_mapping) {
      throw new AppError('System field mappings cannot be modified', 400);
    }

    // Validate the updated configuration
    const mappingData = {
      organization_id,
      ...req.body
    };
    const validation = await fieldMappingService.validateMappingConfiguration(mappingData);
    if (!validation.valid) {
      throw new AppError(validation.error, 400);
    }

    const updatedMapping = await fieldMappingService.updateMapping(organization_id, id, req.body);

    res.json({
      success: true,
      data: updatedMapping,
      message: 'Field mapping updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/field-mappings/:id
 * Delete a field mapping
 * Requires admin role
 */
exports.deleteMapping = async (req, res, next) => {
  try {
    const { organization_id, role } = req.user;
    const { id } = req.params;

    // Check admin permission
    if (role !== 'admin') {
      throw new AppError('Only administrators can delete field mappings', 403);
    }

    // Check if mapping exists and belongs to organization
    const existing = await fieldMappingService.getMappingById(organization_id, id);
    if (!existing) {
      throw new AppError('Field mapping not found', 404);
    }

    // Cannot delete system mappings
    if (existing.is_system_mapping) {
      throw new AppError('System field mappings cannot be deleted', 400);
    }

    await fieldMappingService.deleteMapping(organization_id, id);

    res.json({
      success: true,
      message: 'Field mapping deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/field-mappings/bulk
 * Bulk update field mappings (e.g., reordering)
 * Requires admin role
 */
exports.bulkUpdateMappings = async (req, res, next) => {
  try {
    const { organization_id, role } = req.user;
    const { updates } = req.body;

    // Check admin permission
    if (role !== 'admin') {
      throw new AppError('Only administrators can bulk update field mappings', 403);
    }

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new AppError('Updates array is required', 400);
    }

    const result = await fieldMappingService.bulkUpdateMappings(organization_id, updates);

    res.json({
      success: true,
      data: result,
      message: `${result.updated} field mapping(s) updated successfully`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/field-mappings/validate
 * Validate a field mapping configuration before saving
 */
exports.validateMapping = async (req, res, next) => {
  try {
    const { organization_id } = req.user;

    const mappingData = {
      organization_id,
      ...req.body
    };

    const validation = await fieldMappingService.validateMappingConfiguration(mappingData);

    res.json({
      success: true,
      valid: validation.valid,
      errors: validation.errors || [],
      warnings: validation.warnings || []
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/field-mappings/available-sources
 * Get available source fields that can be mapped
 */
exports.getAvailableSourceFields = async (req, res, next) => {
  try {
    const { organization_id } = req.user;
    const { source_entity = 'leads' } = req.query;

    const fields = await fieldMappingService.getAvailableSourceFields(
      organization_id,
      source_entity
    );

    res.json({
      success: true,
      data: fields,
      count: fields.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/field-mappings/available-targets
 * Get available target fields for a given entity
 */
exports.getAvailableTargetFields = async (req, res, next) => {
  try {
    const { organization_id } = req.user;
    const { target_entity } = req.query;

    if (!target_entity) {
      throw new AppError('target_entity query parameter is required', 400);
    }

    if (!['contacts', 'accounts', 'transactions'].includes(target_entity)) {
      throw new AppError('Invalid target_entity. Must be contacts, accounts, or transactions', 400);
    }

    const fields = await fieldMappingService.getAvailableTargetFields(
      organization_id,
      target_entity
    );

    res.json({
      success: true,
      data: fields,
      count: fields.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/field-mappings/fields/:entityType
 * Get available fields for an entity type (for frontend dropdowns)
 * Includes both standard fields and organization's custom fields
 */
exports.getEntityFields = async (req, res, next) => {
  try {
    const { entityType } = req.params;
    const { organization_id } = req.user;

    // Normalize entity type to plural form for database query
    let normalizedType = entityType.toLowerCase();
    if (normalizedType === 'lead') normalizedType = 'leads';
    if (normalizedType === 'contact') normalizedType = 'contacts';
    if (normalizedType === 'account') normalizedType = 'accounts';
    if (normalizedType === 'transaction') normalizedType = 'transactions';

    let standardFields = [];

    // Define standard fields for each entity type (using snake_case to match DB columns)
    if (normalizedType === 'leads') {
      standardFields = [
        { name: 'first_name', type: 'text', label: 'First Name', is_custom: false },
        { name: 'last_name', type: 'text', label: 'Last Name', is_custom: false },
        { name: 'email', type: 'email', label: 'Email', is_custom: false },
        { name: 'phone', type: 'tel', label: 'Phone', is_custom: false },
        { name: 'company', type: 'text', label: 'Company', is_custom: false },
        { name: 'title', type: 'text', label: 'Title', is_custom: false },
        { name: 'source', type: 'text', label: 'Source', is_custom: false },
        { name: 'status', type: 'text', label: 'Status', is_custom: false },
        { name: 'priority', type: 'select', label: 'Priority', is_custom: false },
        { name: 'potential_value', type: 'number', label: 'Potential Value', is_custom: false },
        { name: 'notes', type: 'textarea', label: 'Notes', is_custom: false }
      ];
    } else if (normalizedType === 'contacts') {
      standardFields = [
        { name: 'first_name', type: 'text', label: 'First Name', is_custom: false },
        { name: 'last_name', type: 'text', label: 'Last Name', is_custom: false },
        { name: 'email', type: 'email', label: 'Email', is_custom: false },
        { name: 'phone', type: 'tel', label: 'Phone', is_custom: false },
        { name: 'company', type: 'text', label: 'Company', is_custom: false },
        { name: 'title', type: 'text', label: 'Title', is_custom: false },
        { name: 'address_line1', type: 'text', label: 'Address Line 1', is_custom: false },
        { name: 'address_line2', type: 'text', label: 'Address Line 2', is_custom: false },
        { name: 'city', type: 'text', label: 'City', is_custom: false },
        { name: 'state', type: 'text', label: 'State', is_custom: false },
        { name: 'postal_code', type: 'text', label: 'Postal Code', is_custom: false },
        { name: 'country', type: 'text', label: 'Country', is_custom: false },
        { name: 'contact_type', type: 'select', label: 'Contact Type', is_custom: false },
        { name: 'status', type: 'select', label: 'Status', is_custom: false },
        { name: 'source', type: 'text', label: 'Source', is_custom: false },
        { name: 'notes', type: 'textarea', label: 'Notes', is_custom: false }
      ];
    } else if (normalizedType === 'accounts') {
      standardFields = [
        { name: 'account_name', type: 'text', label: 'Account Name', is_custom: false },
        { name: 'account_type', type: 'select', label: 'Account Type', is_custom: false },
        { name: 'edition', type: 'text', label: 'Edition', is_custom: false },
        { name: 'device_name', type: 'text', label: 'Device Name', is_custom: false },
        { name: 'mac_address', type: 'text', label: 'MAC Address', is_custom: false },
        { name: 'license_key', type: 'text', label: 'License Key', is_custom: false },
        { name: 'license_status', type: 'select', label: 'License Status', is_custom: false },
        { name: 'billing_cycle', type: 'select', label: 'Billing Cycle', is_custom: false },
        { name: 'price', type: 'number', label: 'Price', is_custom: false },
        { name: 'currency', type: 'select', label: 'Currency', is_custom: false },
        { name: 'is_trial', type: 'boolean', label: 'Is Trial', is_custom: false },
        { name: 'notes', type: 'textarea', label: 'Notes', is_custom: false }
      ];
    } else if (normalizedType === 'transactions') {
      standardFields = [
        { name: 'transaction_id', type: 'text', label: 'Transaction ID', is_custom: false },
        { name: 'amount', type: 'number', label: 'Amount', is_custom: false },
        { name: 'currency', type: 'select', label: 'Currency', is_custom: false },
        { name: 'payment_method', type: 'select', label: 'Payment Method', is_custom: false },
        { name: 'payment_date', type: 'date', label: 'Payment Date', is_custom: false },
        { name: 'status', type: 'select', label: 'Status', is_custom: false },
        { name: 'term', type: 'select', label: 'Billing Term', is_custom: false },
        { name: 'source', type: 'select', label: 'Source', is_custom: false },
        { name: 'transaction_reference', type: 'text', label: 'Transaction Reference', is_custom: false },
        { name: 'notes', type: 'textarea', label: 'Notes', is_custom: false }
      ];
    } else {
      throw new AppError('Invalid entity type. Must be lead, contact, account, or transaction', 400);
    }

    // Query custom fields for this organization and entity type
    let customFields = [];
    try {
      const customFieldsQuery = `
        SELECT field_name, field_type, field_label
        FROM custom_field_definitions
        WHERE organization_id = $1
          AND entity_type = $2
          AND is_enabled = true
        ORDER BY sort_order, field_label
      `;
      const customFieldsResult = await pool.query(customFieldsQuery, [organization_id, normalizedType]);

      customFields = customFieldsResult.rows.map(cf => ({
        name: cf.field_name,
        type: cf.field_type,
        label: cf.field_label,
        is_custom: true
      }));
    } catch (dbError) {
      // If custom_field_definitions table doesn't exist, just continue with standard fields
      console.log('Custom fields query failed (table may not exist):', dbError.message);
    }

    // Combine standard and custom fields
    const allFields = [...standardFields, ...customFields];

    res.json({
      success: true,
      fields: allFields,
      counts: {
        standard: standardFields.length,
        custom: customFields.length,
        total: allFields.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/field-mappings/preview
 * Generate a preview of the conversion modal with current mappings
 */
exports.previewConversionModal = async (req, res, next) => {
  try {
    const { organization_id } = req.user;
    const { lead_id, template_id } = req.body;

    if (!lead_id) {
      throw new AppError('lead_id is required', 400);
    }

    const preview = await fieldMappingService.generateConversionPreview(
      organization_id,
      lead_id,
      template_id
    );

    res.json({
      success: true,
      data: preview
    });
  } catch (error) {
    next(error);
  }
};
