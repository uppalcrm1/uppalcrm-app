/**
 * Utility functions to convert between snake_case (database) and camelCase (API/frontend)
 */

/**
 * Convert a single snake_case string to camelCase
 * @param {string} str - The string to convert
 * @returns {string} The camelCase string
 */
function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

/**
 * Convert all keys in an object from snake_case to camelCase (recursively)
 * @param {object} obj - The object to convert
 * @returns {object} New object with camelCase keys
 */
function convertSnakeToCamel(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Don't recurse into Date objects - keep them as-is
  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertSnakeToCamel(item));
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  const camelObj = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const camelKey = snakeToCamel(key);
      camelObj[camelKey] = convertSnakeToCamel(obj[key]);
    }
  }

  return camelObj;
}

/**
 * Convert a single camelCase string to snake_case
 * @param {string} str - The string to convert
 * @returns {string} The snake_case string
 */
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert all keys in an object from camelCase to snake_case (recursively)
 * @param {object} obj - The object to convert
 * @returns {object} New object with snake_case keys
 */
function convertCamelToSnake(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Don't recurse into Date objects - keep them as-is
  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertCamelToSnake(item));
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  const snakeObj = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const snakeKey = camelToSnake(key);
      snakeObj[snakeKey] = convertCamelToSnake(obj[key]);
    }
  }

  return snakeObj;
}

/**
 * Add computed "name" field to lead objects by concatenating firstName and lastName
 * @param {object|array} data - Lead object or array of leads
 * @returns {object|array} Lead(s) with added "name" field
 */
function addComputedNameField(data) {
  if (!data) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => addComputedNameField(item));
  }

  if (typeof data === 'object' && data.firstName !== undefined && data.lastName !== undefined) {
    return {
      ...data,
      name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unnamed'
    };
  }

  return data;
}

module.exports = {
  snakeToCamel,
  convertSnakeToCamel,
  camelToSnake,
  convertCamelToSnake,
  addComputedNameField
};
