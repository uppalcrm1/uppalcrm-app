const fieldMappingService = require('../services/fieldMappingService');
const { AppError } = require('../utils/errors');

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
      target_entity,
      source_entity = 'leads',
      include_system = true,
      search
    } = req.query;

    const filters = {
      target_entity,
      source_entity,
      include_system: include_system === 'true',
      search
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

    // Check admin permission
    if (role !== 'admin') {
      throw new AppError('Only administrators can create field mappings', 403);
    }

    const mappingData = {
      organization_id,
      ...req.body
    };

    // Validate the mapping configuration
    const validation = await fieldMappingService.validateMappingConfiguration(mappingData);
    if (!validation.valid) {
      throw new AppError(validation.error, 400);
    }

    const newMapping = await fieldMappingService.createMapping(mappingData);

    res.status(201).json({
      success: true,
      data: newMapping,
      message: 'Field mapping created successfully'
    });
  } catch (error) {
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
