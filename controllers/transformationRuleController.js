const transformationRuleService = require('../services/transformationRuleService');
const { AppError } = require('../utils/errors');

/**
 * Transformation Rule Controller
 * Handles HTTP requests for custom transformation rules
 */

/**
 * GET /api/transformation-rules
 * Get all transformation rules for the organization
 */
exports.getAllRules = async (req, res, next) => {
  try {
    const { organization_id } = req.user;
    const { search, input_type, output_type } = req.query;

    const filters = {
      search,
      input_type,
      output_type
    };

    const rules = await transformationRuleService.getAllRules(organization_id, filters);

    res.json({
      success: true,
      data: rules,
      count: rules.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/transformation-rules/:id
 * Get a specific transformation rule by ID
 */
exports.getRuleById = async (req, res, next) => {
  try {
    const { organization_id } = req.user;
    const { id } = req.params;

    const rule = await transformationRuleService.getRuleById(organization_id, id);

    if (!rule) {
      throw new AppError('Transformation rule not found', 404);
    }

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/transformation-rules
 * Create a new transformation rule
 * Requires admin role
 */
exports.createRule = async (req, res, next) => {
  try {
    const { organization_id, role } = req.user;

    // Check admin permission
    if (role !== 'admin') {
      throw new AppError('Only administrators can create transformation rules', 403);
    }

    const ruleData = {
      organization_id,
      ...req.body
    };

    // Validate the transformation code
    const validation = await transformationRuleService.validateTransformationCode(
      ruleData.transformation_code,
      ruleData.input_type
    );

    if (!validation.valid) {
      throw new AppError(`Invalid transformation code: ${validation.error}`, 400);
    }

    // Mark as validated if code passed validation
    ruleData.is_validated = validation.valid;
    ruleData.validation_error = validation.error || null;

    const newRule = await transformationRuleService.createRule(ruleData);

    res.status(201).json({
      success: true,
      data: newRule,
      message: 'Transformation rule created successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/transformation-rules/:id
 * Update a transformation rule
 * Requires admin role
 */
exports.updateRule = async (req, res, next) => {
  try {
    const { organization_id, role } = req.user;
    const { id } = req.params;

    // Check admin permission
    if (role !== 'admin') {
      throw new AppError('Only administrators can update transformation rules', 403);
    }

    // Check if rule exists and belongs to organization
    const existing = await transformationRuleService.getRuleById(organization_id, id);
    if (!existing) {
      throw new AppError('Transformation rule not found', 404);
    }

    // If transformation_code is being updated, validate it
    if (req.body.transformation_code) {
      const validation = await transformationRuleService.validateTransformationCode(
        req.body.transformation_code,
        req.body.input_type || existing.input_type
      );

      if (!validation.valid) {
        throw new AppError(`Invalid transformation code: ${validation.error}`, 400);
      }

      req.body.is_validated = validation.valid;
      req.body.validation_error = validation.error || null;
    }

    const updatedRule = await transformationRuleService.updateRule(organization_id, id, req.body);

    res.json({
      success: true,
      data: updatedRule,
      message: 'Transformation rule updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/transformation-rules/:id
 * Delete a transformation rule
 * Requires admin role
 */
exports.deleteRule = async (req, res, next) => {
  try {
    const { organization_id, role } = req.user;
    const { id } = req.params;

    // Check admin permission
    if (role !== 'admin') {
      throw new AppError('Only administrators can delete transformation rules', 403);
    }

    // Check if rule exists and belongs to organization
    const existing = await transformationRuleService.getRuleById(organization_id, id);
    if (!existing) {
      throw new AppError('Transformation rule not found', 404);
    }

    // Check if rule is being used by any field mappings
    const isInUse = await transformationRuleService.isRuleInUse(organization_id, id);
    if (isInUse) {
      throw new AppError(
        'Cannot delete transformation rule because it is currently being used by one or more field mappings',
        400
      );
    }

    await transformationRuleService.deleteRule(organization_id, id);

    res.json({
      success: true,
      message: 'Transformation rule deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/transformation-rules/:id/test
 * Test a transformation rule with sample data
 */
exports.testRule = async (req, res, next) => {
  try {
    const { organization_id } = req.user;
    const { id } = req.params;
    const { test_value, sample_lead_data = {} } = req.body;

    if (test_value === undefined || test_value === null) {
      throw new AppError('test_value is required', 400);
    }

    // Get the rule
    const rule = await transformationRuleService.getRuleById(organization_id, id);
    if (!rule) {
      throw new AppError('Transformation rule not found', 404);
    }

    // Execute the transformation
    const result = await transformationRuleService.executeTransformation(
      rule.transformation_code,
      test_value,
      sample_lead_data
    );

    res.json({
      success: true,
      data: {
        input: test_value,
        output: result.output,
        execution_time_ms: result.execution_time_ms,
        success: result.success,
        error: result.error
      }
    });
  } catch (error) {
    next(error);
  }
};
