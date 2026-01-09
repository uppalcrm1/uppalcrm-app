const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const templateController = require('../controllers/fieldMappingTemplateController');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

// Validation schemas
const createTemplateSchema = Joi.object({
  template_name: Joi.string().required().max(100),
  description: Joi.string().allow(null, ''),
  template_type: Joi.string().valid('custom', 'industry').default('custom'),
  applies_to_entities: Joi.array().items(
    Joi.string().valid('contacts', 'accounts', 'transactions')
  ).default(['contacts', 'accounts', 'transactions']),
  icon: Joi.string().max(50).allow(null),
  color: Joi.string().max(20).allow(null),
  source_mappings: Joi.array().items(Joi.string().uuid()).required()
});

const applyTemplateSchema = Joi.object({
  override_existing: Joi.boolean().default(false),
  field_mappings_to_include: Joi.array().items(Joi.string()).allow(null)
});

/**
 * GET /api/field-mapping-templates
 * Get all available templates (system + organization templates)
 */
router.get(
  '/',
  authenticateToken,
  templateController.getAllTemplates
);

/**
 * GET /api/field-mapping-templates/:id
 * Get template details including all field mappings
 */
router.get(
  '/:id',
  authenticateToken,
  templateController.getTemplateById
);

/**
 * POST /api/field-mapping-templates
 * Create a custom template from current mappings
 * Requires admin role
 */
router.post(
  '/',
  authenticateToken,
  validate({ body: createTemplateSchema }),
  templateController.createTemplate
);

/**
 * POST /api/field-mapping-templates/:id/apply
 * Apply a template to the current organization
 * Requires admin role
 */
router.post(
  '/:id/apply',
  authenticateToken,
  validate({ body: applyTemplateSchema }),
  templateController.applyTemplate
);

/**
 * DELETE /api/field-mapping-templates/:id
 * Delete a custom template (cannot delete system templates)
 * Requires admin role
 */
router.delete(
  '/:id',
  authenticateToken,
  templateController.deleteTemplate
);

module.exports = router;
