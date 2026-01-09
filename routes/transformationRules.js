const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const transformationRuleController = require('../controllers/transformationRuleController');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

// Validation schemas
const transformationRuleSchema = Joi.object({
  rule_name: Joi.string().required().max(100),
  description: Joi.string().allow(null, ''),
  transformation_code: Joi.string().required(),
  input_type: Joi.string().valid('text', 'number', 'date', 'boolean', 'object', 'array', 'any'),
  output_type: Joi.string().valid('text', 'number', 'date', 'boolean', 'object', 'array'),
  max_execution_time_ms: Joi.number().integer().min(100).max(5000).default(1000)
});

const testTransformationSchema = Joi.object({
  test_value: Joi.any().required(),
  sample_lead_data: Joi.object().default({})
});

/**
 * GET /api/transformation-rules
 * Get all transformation rules for the organization
 */
router.get(
  '/',
  authenticateToken,
  transformationRuleController.getAllRules
);

/**
 * GET /api/transformation-rules/:id
 * Get a specific transformation rule by ID
 */
router.get(
  '/:id',
  authenticateToken,
  transformationRuleController.getRuleById
);

/**
 * POST /api/transformation-rules
 * Create a new transformation rule
 * Requires admin role
 */
router.post(
  '/',
  authenticateToken,
  validate({ body: transformationRuleSchema }),
  transformationRuleController.createRule
);

/**
 * PUT /api/transformation-rules/:id
 * Update a transformation rule
 * Requires admin role
 */
router.put(
  '/:id',
  authenticateToken,
  validate({ body: transformationRuleSchema }),
  transformationRuleController.updateRule
);

/**
 * DELETE /api/transformation-rules/:id
 * Delete a transformation rule
 * Requires admin role
 */
router.delete(
  '/:id',
  authenticateToken,
  transformationRuleController.deleteRule
);

/**
 * POST /api/transformation-rules/:id/test
 * Test a transformation rule with sample data
 */
router.post(
  '/:id/test',
  authenticateToken,
  validate({ body: testTransformationSchema }),
  transformationRuleController.testRule
);

module.exports = router;
