const transformationRuleService = require('./transformationRuleService');

/**
 * Transformation Engine
 * Applies field transformations (predefined and custom)
 */

/**
 * Apply a transformation to a value
 */
exports.applyTransformation = async (value, transformationType, transformationRuleId = null, leadData = {}) => {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle predefined transformations
  if (transformationType && transformationType !== 'none' && transformationType !== 'custom') {
    return applyPredefinedTransformation(value, transformationType);
  }

  // Handle custom transformations
  if (transformationType === 'custom' && transformationRuleId) {
    try {
      const rule = await transformationRuleService.getRuleById(
        leadData.organization_id,
        transformationRuleId
      );

      if (!rule || !rule.is_validated) {
        console.error('Invalid or unvalidated transformation rule:', transformationRuleId);
        return value; // Return original value if rule is invalid
      }

      const result = await transformationRuleService.executeTransformation(
        rule.transformation_code,
        value,
        leadData,
        rule.max_execution_time_ms
      );

      if (result.success) {
        return result.output;
      } else {
        console.error('Transformation failed:', result.error);
        return value; // Return original value on error
      }
    } catch (error) {
      console.error('Error applying custom transformation:', error);
      return value;
    }
  }

  // No transformation
  return value;
};

/**
 * Apply predefined transformation
 */
function applyPredefinedTransformation(value, type) {
  const stringValue = String(value);

  switch (type) {
    case 'lowercase':
      return stringValue.toLowerCase();

    case 'uppercase':
      return stringValue.toUpperCase();

    case 'titlecase':
      return stringValue
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    case 'sentencecase':
      return stringValue.charAt(0).toUpperCase() + stringValue.slice(1).toLowerCase();

    case 'trim':
      return stringValue.trim();

    case 'remove_special_chars':
      return stringValue.replace(/[^a-zA-Z0-9\s]/g, '');

    case 'replace':
      // For replace, we'd need additional parameters (search, replace)
      // This is a simplified version
      return stringValue;

    case 'concatenate':
      // For concatenate, we'd need additional parameters
      // This is a simplified version
      return stringValue;

    default:
      return value;
  }
}

/**
 * Validate that a value matches the expected type
 */
exports.validateValueType = (value, expectedType) => {
  if (value === null || value === undefined) {
    return true; // Nulls are allowed
  }

  switch (expectedType) {
    case 'text':
    case 'varchar':
    case 'string':
      return typeof value === 'string';

    case 'number':
    case 'integer':
    case 'decimal':
    case 'float':
      return typeof value === 'number' && !isNaN(value);

    case 'boolean':
    case 'bool':
      return typeof value === 'boolean';

    case 'date':
    case 'datetime':
    case 'timestamp':
      return value instanceof Date || !isNaN(Date.parse(value));

    case 'object':
    case 'json':
      return typeof value === 'object' && !Array.isArray(value);

    case 'array':
      return Array.isArray(value);

    case 'any':
      return true;

    default:
      return true;
  }
};

/**
 * Convert value to expected type
 */
exports.convertToType = (value, targetType) => {
  if (value === null || value === undefined) {
    return value;
  }

  try {
    switch (targetType) {
      case 'text':
      case 'varchar':
      case 'string':
        return String(value);

      case 'number':
      case 'integer':
      case 'decimal':
      case 'float':
        const num = Number(value);
        return isNaN(num) ? null : num;

      case 'boolean':
      case 'bool':
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (lower === 'true' || lower === '1' || lower === 'yes') return true;
          if (lower === 'false' || lower === '0' || lower === 'no') return false;
        }
        return Boolean(value);

      case 'date':
      case 'datetime':
      case 'timestamp':
        if (value instanceof Date) return value;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;

      case 'object':
      case 'json':
        if (typeof value === 'object') return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return null;
          }
        }
        return null;

      case 'array':
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [value];
          } catch {
            return [value];
          }
        }
        return [value];

      default:
        return value;
    }
  } catch (error) {
    console.error('Type conversion error:', error);
    return value;
  }
};

/**
 * Get list of available predefined transformations
 */
exports.getAvailableTransformations = () => {
  return [
    {
      type: 'none',
      label: 'None',
      description: 'No transformation applied'
    },
    {
      type: 'lowercase',
      label: 'Lowercase',
      description: 'Convert text to lowercase',
      example: 'HELLO → hello'
    },
    {
      type: 'uppercase',
      label: 'Uppercase',
      description: 'Convert text to uppercase',
      example: 'hello → HELLO'
    },
    {
      type: 'titlecase',
      label: 'Title Case',
      description: 'Capitalize first letter of each word',
      example: 'hello world → Hello World'
    },
    {
      type: 'sentencecase',
      label: 'Sentence Case',
      description: 'Capitalize first letter only',
      example: 'HELLO WORLD → Hello world'
    },
    {
      type: 'trim',
      label: 'Trim Whitespace',
      description: 'Remove leading and trailing whitespace',
      example: '  hello  → hello'
    },
    {
      type: 'remove_special_chars',
      label: 'Remove Special Characters',
      description: 'Keep only letters, numbers, and spaces',
      example: 'hello@123! → hello123'
    },
    {
      type: 'custom',
      label: 'Custom Transformation',
      description: 'Use a custom JavaScript transformation rule'
    }
  ];
};
