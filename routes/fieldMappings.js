const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const fieldMappingController = require('../controllers/fieldMappingController');
const { validate, schemas } = require('../middleware/validation');
const Joi = require('joi');

// Validation schemas
const fieldMappingSchema = Joi.object({
  source_entity_type: Joi.string().valid('lead', 'leads', 'contact', 'contacts', 'account', 'accounts').required(),
  target_entity_type: Joi.string().valid('lead', 'leads', 'contact', 'contacts', 'account', 'accounts').required(),
  source_field_name: Joi.string().required().max(100),
  target_field_name: Joi.string().required().max(100),
  transformation_rule: Joi.string().valid('none', 'uppercase', 'lowercase', 'trim', 'capitalize').allow(null, ''),
  priority: Joi.number().integer().min(0).default(100),
  is_active: Joi.boolean().default(true)
});

const updateFieldMappingSchema = fieldMappingSchema.fork(
  ['source_entity_type', 'target_entity_type', 'source_field_name', 'target_field_name'],
  (schema) => schema.optional()
);

const bulkUpdateSchema = Joi.object({
  updates: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().required(),
      display_order: Joi.number().integer().min(0),
      is_visible_on_convert: Joi.boolean(),
      is_editable_on_convert: Joi.boolean(),
      is_required_on_convert: Joi.boolean()
    })
  ).required()
});

const validateMappingSchema = Joi.object({
  source_field: Joi.string().required(),
  source_field_type: Joi.string().required(),
  target_entity: Joi.string().valid('contacts', 'accounts', 'transactions').required(),
  target_field: Joi.string().required(),
  target_field_type: Joi.string().required(),
  transformation_type: Joi.string().valid(
    'none', 'lowercase', 'uppercase', 'titlecase', 'sentencecase',
    'trim', 'remove_special_chars', 'replace', 'concatenate', 'custom'
  ).default('none')
});

// ============================================================================
// FIELD MAPPING CONFIGURATION ROUTES
// ============================================================================

/**
 * GET /api/field-mappings
 * Get all field mappings for the organization
 */
router.get(
  '/',
  authenticateToken,
  fieldMappingController.getAllMappings
);

/**
 * GET /api/field-mappings/:id
 * Get a specific field mapping by ID
 */
router.get(
  '/:id',
  authenticateToken,
  fieldMappingController.getMappingById
);

/**
 * POST /api/field-mappings
 * Create a new field mapping
 * Requires admin role
 */
router.post(
  '/',
  authenticateToken,
  validate({ body: fieldMappingSchema }),
  fieldMappingController.createMapping
);

/**
 * PUT /api/field-mappings/:id
 * Update an existing field mapping
 * Requires admin role
 */
router.put(
  '/:id',
  authenticateToken,
  validate({ body: updateFieldMappingSchema }),
  fieldMappingController.updateMapping
);

/**
 * DELETE /api/field-mappings/:id
 * Delete a field mapping
 * Requires admin role
 */
router.delete(
  '/:id',
  authenticateToken,
  fieldMappingController.deleteMapping
);

/**
 * PATCH /api/field-mappings/bulk
 * Bulk update field mappings (e.g., reordering)
 * Requires admin role
 */
router.patch(
  '/bulk',
  authenticateToken,
  validate({ body: bulkUpdateSchema }),
  fieldMappingController.bulkUpdateMappings
);

/**
 * POST /api/field-mappings/validate
 * Validate a field mapping configuration before saving
 */
router.post(
  '/validate',
  authenticateToken,
  validate({ body: validateMappingSchema }),
  fieldMappingController.validateMapping
);

// ============================================================================
// FIELD DISCOVERY ROUTES
// ============================================================================

/**
 * GET /api/field-mappings/fields/:entityType
 * Get available fields for an entity type (simplified for frontend)
 */
router.get(
  '/fields/:entityType',
  authenticateToken,
  fieldMappingController.getEntityFields
);

/**
 * GET /api/field-mappings/available-sources
 * Get available source fields that can be mapped
 */
router.get(
  '/available-sources',
  authenticateToken,
  fieldMappingController.getAvailableSourceFields
);

/**
 * GET /api/field-mappings/available-targets
 * Get available target fields for a given entity
 */
router.get(
  '/available-targets',
  authenticateToken,
  fieldMappingController.getAvailableTargetFields
);

// ============================================================================
// PREVIEW ROUTES
// ============================================================================

/**
 * POST /api/field-mappings/preview
 * Generate a preview of the conversion modal with current mappings
 */
router.post(
  '/preview',
  authenticateToken,
  fieldMappingController.previewConversionModal
);

module.exports = router;
