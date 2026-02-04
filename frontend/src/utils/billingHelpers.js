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
 * Convert old billing_cycle strings to new numeric term values
 * Used for migration/backward compatibility
 * @param {string} billingCycle - Old billing cycle format (monthly, quarterly, etc.)
 * @returns {number} Numeric term value in months
 * @example
 * billingCycleToTerm('monthly') => 1
 * billingCycleToTerm('annual') => 12
 */
export const billingCycleToTerm = (billingCycle) => {
  const cycleMap = {
    'monthly': 1,
    'quarterly': 3,
    'semi-annual': 6,
    'semi_annual': 6,
    'annual': 12,
    'biennial': 24
  };
  return cycleMap[billingCycle?.toLowerCase()] || 1;
};

/**
 * Convert numeric term to old billing_cycle string format
 * Used for backward compatibility
 * @param {number} months - Number of months
 * @returns {string} Old billing cycle format
 * @example
 * termToBillingCycle(1) => 'monthly'
 * termToBillingCycle(12) => 'annual'
 */
export const termToBillingCycle = (months) => {
  const termMap = {
    1: 'monthly',
    3: 'quarterly',
    6: 'semi_annual',
    12: 'annual',
    24: 'biennial'
  };
  return termMap[months] || 'monthly';
};

/**
 * Format billing term for display in tables and lists
 * @param {number|string} term - Billing term in months or old billing_cycle string
 * @param {string} format - 'full' (default) or 'short'
 * @returns {string} Formatted billing term
 * @example
 * formatBillingTermDisplay(6) => 'Semi-Annual (6 months)'
 * formatBillingTermDisplay(6, 'short') => 'Semi-Annual'
 */
export const formatBillingTermDisplay = (term, format = 'full') => {
  // Handle string billing_cycle format (for backward compatibility)
  const months = typeof term === 'string' ? billingCycleToTerm(term) : term;

  return format === 'short' ? getShortBillingTerm(months) : formatBillingTerm(months);
};
