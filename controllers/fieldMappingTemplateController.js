const fieldMappingTemplateService = require('../services/fieldMappingTemplateService');
const { AppError } = require('../utils/errors');

/**
 * Field Mapping Template Controller
 * Handles HTTP requests for field mapping templates
 */

/**
 * GET /api/field-mapping-templates
 * Get all available templates (system + organization templates)
 */
exports.getAllTemplates = async (req, res, next) => {
  try {
    const { organization_id } = req.user;
    const {
      template_type,
      applies_to_entity,
      search
    } = req.query;

    const filters = {
      template_type,
      applies_to_entity,
      search
    };

    const templates = await fieldMappingTemplateService.getAllTemplates(
      organization_id,
      filters
    );

    res.json({
      success: true,
      data: templates,
      count: templates.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/field-mapping-templates/:id
 * Get template details including all field mappings
 */
exports.getTemplateById = async (req, res, next) => {
  try {
    const { organization_id } = req.user;
    const { id } = req.params;

    const template = await fieldMappingTemplateService.getTemplateById(
      organization_id,
      id
    );

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/field-mapping-templates
 * Create a custom template from current mappings
 * Requires admin role
 */
exports.createTemplate = async (req, res, next) => {
  try {
    const { organization_id, role } = req.user;

    // Check admin permission
    if (role !== 'admin') {
      throw new AppError('Only administrators can create templates', 403);
    }

    const templateData = {
      organization_id,
      ...req.body
    };

    // Validate that source_mappings exist
    if (!Array.isArray(templateData.source_mappings) || templateData.source_mappings.length === 0) {
      throw new AppError('source_mappings array is required and must not be empty', 400);
    }

    const newTemplate = await fieldMappingTemplateService.createTemplate(templateData);

    res.status(201).json({
      success: true,
      data: newTemplate,
      message: 'Template created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/field-mapping-templates/:id/apply
 * Apply a template to the current organization
 * Requires admin role
 */
exports.applyTemplate = async (req, res, next) => {
  try {
    const { organization_id, role } = req.user;
    const { id } = req.params;
    const {
      override_existing = false,
      field_mappings_to_include = null
    } = req.body;

    // Check admin permission
    if (role !== 'admin') {
      throw new AppError('Only administrators can apply templates', 403);
    }

    // Check if template exists and is accessible
    const template = await fieldMappingTemplateService.getTemplateById(
      organization_id,
      id
    );

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    // Apply the template
    const result = await fieldMappingTemplateService.applyTemplate(
      organization_id,
      id,
      {
        override_existing,
        field_mappings_to_include
      }
    );

    res.json({
      success: true,
      data: result,
      message: `Template applied successfully. ${result.created} mapping(s) created, ${result.skipped} skipped.`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/field-mapping-templates/:id
 * Delete a custom template (cannot delete system templates)
 * Requires admin role
 */
exports.deleteTemplate = async (req, res, next) => {
  try {
    const { organization_id, role } = req.user;
    const { id } = req.params;

    // Check admin permission
    if (role !== 'admin') {
      throw new AppError('Only administrators can delete templates', 403);
    }

    // Check if template exists
    const template = await fieldMappingTemplateService.getTemplateById(
      organization_id,
      id
    );

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    // Cannot delete system templates
    if (template.is_system_template) {
      throw new AppError('System templates cannot be deleted', 400);
    }

    // Check if it belongs to the organization
    if (template.organization_id !== organization_id) {
      throw new AppError('You can only delete templates belonging to your organization', 403);
    }

    await fieldMappingTemplateService.deleteTemplate(organization_id, id);

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
