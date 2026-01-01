/**
 * UUID Sanitization Utility
 * Prevents "invalid input syntax for type uuid" errors
 *
 * This utility ensures that:
 * 1. Empty strings are converted to NULL
 * 2. Invalid UUIDs are rejected early
 * 3. Consistent handling across the entire application
 */

/**
 * Sanitize a single UUID value
 * Converts empty strings, undefined, and invalid values to NULL
 *
 * @param {string|null|undefined} value - The UUID value to sanitize
 * @returns {string|null} - Valid UUID string or NULL
 */
function sanitizeUUID(value) {
  // Handle null, undefined, empty string
  if (!value || value === '' || value === 'null' || value === 'undefined') {
    return null;
  }

  // Trim whitespace
  const trimmed = String(value).trim();

  // Check if empty after trim
  if (trimmed === '') {
    return null;
  }

  // Basic UUID format validation (8-4-4-4-12)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(trimmed)) {
    console.warn(`Invalid UUID format: "${value}" - converting to NULL`);
    return null;
  }

  return trimmed;
}

/**
 * Sanitize an object containing UUID fields
 * Useful for sanitizing request bodies before database operations
 *
 * @param {Object} obj - Object containing UUID fields
 * @param {string[]} uuidFields - Array of field names that should be UUIDs
 * @returns {Object} - Sanitized object
 */
function sanitizeUUIDs(obj, uuidFields) {
  const sanitized = { ...obj };

  uuidFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = sanitizeUUID(sanitized[field]);
    }
  });

  return sanitized;
}

/**
 * Sanitize an array of values that should be UUIDs
 *
 * @param {Array} values - Array of UUID values
 * @returns {Array} - Array with sanitized UUIDs
 */
function sanitizeUUIDArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map(sanitizeUUID).filter(v => v !== null);
}

/**
 * Validate that a value is a valid UUID (not NULL)
 * Throws error if invalid - use for required UUID fields
 *
 * @param {string} value - UUID to validate
 * @param {string} fieldName - Name of field for error message
 * @throws {Error} If UUID is invalid or missing
 * @returns {string} - Valid UUID
 */
function requireUUID(value, fieldName = 'UUID') {
  const sanitized = sanitizeUUID(value);

  if (!sanitized) {
    throw new Error(`${fieldName} is required and must be a valid UUID`);
  }

  return sanitized;
}

module.exports = {
  sanitizeUUID,
  sanitizeUUIDs,
  sanitizeUUIDArray,
  requireUUID
};
