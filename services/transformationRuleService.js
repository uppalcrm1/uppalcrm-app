const { pool } = require('../database/connection');
const { VM } = require('vm2');
const { AppError } = require('../utils/errors');

/**
 * Transformation Rule Service
 * Handles custom transformation rules with sandboxed execution
 */

/**
 * Get all transformation rules for an organization
 */
exports.getAllRules = async (organizationId, filters = {}) => {
  const { search, input_type, output_type } = filters;

  let query = `
    SELECT *
    FROM field_transformation_rules
    WHERE organization_id = $1 AND is_active = true
  `;

  const params = [organizationId];
  let paramIndex = 2;

  if (search) {
    query += ` AND (rule_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (input_type) {
    query += ` AND input_type = $${paramIndex}`;
    params.push(input_type);
    paramIndex++;
  }

  if (output_type) {
    query += ` AND output_type = $${paramIndex}`;
    params.push(output_type);
    paramIndex++;
  }

  query += ` ORDER BY rule_name ASC`;

  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Get a specific transformation rule by ID
 */
exports.getRuleById = async (organizationId, ruleId) => {
  const query = `
    SELECT * FROM field_transformation_rules
    WHERE id = $1 AND organization_id = $2
  `;

  const result = await pool.query(query, [ruleId, organizationId]);
  return result.rows[0];
};

/**
 * Create a new transformation rule
 */
exports.createRule = async (ruleData) => {
  const {
    organization_id,
    rule_name,
    description,
    transformation_code,
    input_type = 'any',
    output_type = 'text',
    max_execution_time_ms = 1000,
    is_validated = false,
    validation_error = null
  } = ruleData;

  const query = `
    INSERT INTO field_transformation_rules (
      organization_id, rule_name, description, transformation_code,
      input_type, output_type, max_execution_time_ms,
      is_validated, validation_error
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const params = [
    organization_id, rule_name, description, transformation_code,
    input_type, output_type, max_execution_time_ms,
    is_validated, validation_error
  ];

  const result = await pool.query(query, params);
  return result.rows[0];
};

/**
 * Update a transformation rule
 */
exports.updateRule = async (organizationId, ruleId, updates) => {
  const allowedFields = [
    'rule_name', 'description', 'transformation_code',
    'input_type', 'output_type', 'max_execution_time_ms',
    'is_validated', 'validation_error'
  ];

  const setClauses = [];
  const params = [ruleId, organizationId];
  let paramIndex = 3;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClauses.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  const query = `
    UPDATE field_transformation_rules
    SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND organization_id = $2
    RETURNING *
  `;

  const result = await pool.query(query, params);
  return result.rows[0];
};

/**
 * Delete a transformation rule
 */
exports.deleteRule = async (organizationId, ruleId) => {
  const query = `
    UPDATE field_transformation_rules
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND organization_id = $2
    RETURNING id
  `;

  const result = await pool.query(query, [ruleId, organizationId]);
  return result.rows[0];
};

/**
 * Check if a transformation rule is being used by any field mappings
 */
exports.isRuleInUse = async (organizationId, ruleId) => {
  const query = `
    SELECT COUNT(*) as count
    FROM field_mapping_configurations
    WHERE organization_id = $1
      AND transformation_rule_id = $2
      AND is_active = true
  `;

  const result = await pool.query(query, [organizationId, ruleId]);
  return parseInt(result.rows[0].count) > 0;
};

/**
 * Validate transformation code
 */
exports.validateTransformationCode = async (code, inputType = 'any') => {
  try {
    // Basic syntax validation
    if (!code || code.trim().length === 0) {
      return { valid: false, error: 'Transformation code cannot be empty' };
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /require\s*\(/,
      /import\s+/,
      /eval\s*\(/,
      /Function\s*\(/,
      /process\./,
      /child_process/,
      /fs\./,
      /__dirname/,
      /__filename/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          valid: false,
          error: `Dangerous pattern detected: ${pattern.toString()}`
        };
      }
    }

    // Try to execute with sample data
    const sampleInputs = {
      text: 'Sample Text',
      number: 42,
      date: new Date().toISOString(),
      boolean: true,
      object: { key: 'value' },
      array: [1, 2, 3],
      any: 'test'
    };

    const testInput = sampleInputs[inputType] || sampleInputs.any;
    const testResult = await exports.executeTransformation(code, testInput, {});

    if (!testResult.success) {
      return { valid: false, error: testResult.error };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

/**
 * Execute a transformation with sandboxed VM
 */
exports.executeTransformation = async (code, inputValue, leadData = {}, maxExecutionTime = 1000) => {
  const startTime = Date.now();

  try {
    // Create sandboxed VM
    const vm = new VM({
      timeout: maxExecutionTime,
      sandbox: {
        value: inputValue,
        lead: leadData,
        console: {
          log: () => {} // Disable console.log
        },
        // Provide safe utility functions
        String: String,
        Number: Number,
        Boolean: Boolean,
        Array: Array,
        Object: Object,
        Date: Date,
        Math: Math,
        JSON: JSON
      }
    });

    // Wrap the code in a function that returns the result
    const wrappedCode = `
      (function() {
        ${code}
      })()
    `;

    const result = vm.run(wrappedCode);
    const executionTime = Date.now() - startTime;

    return {
      success: true,
      output: result,
      execution_time_ms: executionTime
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;

    return {
      success: false,
      output: null,
      error: error.message,
      execution_time_ms: executionTime
    };
  }
};

/**
 * Get usage statistics for a transformation rule
 */
exports.getRuleUsageStats = async (organizationId, ruleId) => {
  const query = `
    SELECT
      COUNT(DISTINCT fmc.id) as mapping_count,
      COUNT(cfh.id) as conversion_count,
      AVG(cfh.execution_time_ms) as avg_execution_time_ms
    FROM field_transformation_rules ftr
    LEFT JOIN field_mapping_configurations fmc
      ON ftr.id = fmc.transformation_rule_id
      AND fmc.organization_id = $1
      AND fmc.is_active = true
    LEFT JOIN conversion_field_history cfh
      ON fmc.id = cfh.field_mapping_id
      AND cfh.was_transformed = true
    WHERE ftr.id = $2
      AND ftr.organization_id = $1
    GROUP BY ftr.id
  `;

  const result = await pool.query(query, [organizationId, ruleId]);
  return result.rows[0] || {
    mapping_count: 0,
    conversion_count: 0,
    avg_execution_time_ms: null
  };
};
