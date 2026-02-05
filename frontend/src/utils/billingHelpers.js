/**
 * Billing Term Helper Functions
 * Converts between numeric month values and readable labels
 */

/**
 * Map numeric billing term months to user-friendly labels
 * @param {number} months - Number of months (1, 3, 6, 12, 24)
 * @returns {string} Formatted billing term label
 * @example
 * formatBillingTerm(1) => 'Monthly (1 month)'
 * formatBillingTerm(6) => 'Semi-Annual (6 months)'
 */
export const formatBillingTerm = (months) => {
  const labels = {
    1: 'Monthly (1 month)',
    3: 'Quarterly (3 months)',
    6: 'Semi-Annual (6 months)',
    12: 'Annual (12 months)',
    24: 'Biennial (2 years)'
  };
  return labels[months] || `${months} months`;
};

/**
 * Get a short label for billing term (for table columns, badges, etc.)
 * @param {number} months - Number of months
 * @returns {string} Short billing term label
 * @example
 * getShortBillingTerm(1) => 'Monthly'
 * getShortBillingTerm(12) => 'Annual'
 */
export const getShortBillingTerm = (months) => {
  const labels = {
    1: 'Monthly',
    3: 'Quarterly',
    6: 'Semi-Annual',
    12: 'Annual',
    24: 'Biennial'
  };
  return labels[months] || `${months}mo`;
};

/**
 * Format billing term for display in tables and lists
 * @param {number} months - Billing term in months (1, 3, 6, 12, 24)
 * @param {string} format - 'full' (default) or 'short'
 * @returns {string} Formatted billing term
 * @example
 * formatBillingTermDisplay(6) => 'Semi-Annual (6 months)'
 * formatBillingTermDisplay(6, 'short') => 'Semi-Annual'
 */
export const formatBillingTermDisplay = (months, format = 'full') => {
  return format === 'short' ? getShortBillingTerm(months) : formatBillingTerm(months);
};
