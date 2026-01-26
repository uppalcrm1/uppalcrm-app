/**
 * Convert camelCase object keys to snake_case
 * Handles nested objects but preserves customFields as-is
 */
export const convertCamelToSnake = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj;
  }

  const converted = {};

  Object.keys(obj).forEach(key => {
    // Don't convert customFields - keep it as-is with its dynamic key names
    if (key === 'customFields' || key === 'custom_fields') {
      converted.customFields = obj[key] || {};
      return;
    }

    // Convert camelCase to snake_case
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    converted[snakeKey] = obj[key];
  });

  return converted;
};
