/**
 * Shared Transaction Constants
 * Used across all transaction-related components for consistency
 */

// Payment Methods
export const PAYMENT_METHODS = [
  'Credit Card',
  'Debit Card',
  'PayPal',
  'Bank Transfer',
  'Cash',
  'Check'
];

// Transaction Sources
// DEPRECATED: Source options are now loaded from custom_field_definitions table
// Use customFieldsAPI.getFields('transactions') to get source field configuration
// Keeping empty array for backward compatibility during migration
export const TRANSACTION_SOURCES = [];

// Transaction Statuses
export const TRANSACTION_STATUSES = [
  {
    value: 'pending',
    label: 'Pending',
    color: 'yellow',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-800'
  },
  {
    value: 'completed',
    label: 'Completed',
    color: 'green',
    bgClass: 'bg-green-100',
    textClass: 'text-green-800'
  },
  {
    value: 'failed',
    label: 'Failed',
    color: 'red',
    bgClass: 'bg-red-100',
    textClass: 'text-red-800'
  },
  {
    value: 'refunded',
    label: 'Refunded',
    color: 'blue',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800'
  }
];

// Billing Terms
// DEPRECATED (Phase 1-3 billing term scalability, Feb 2026):
// Billing term options are now dynamically configurable per organization.
// Use getTermOptions() from utils/billingHelpers to get billing term configuration.
// Use formatBillingTerm() from utils/billingHelpers to format display labels.
// This empty array is kept only to prevent import errors in any remaining references.
export const BILLING_TERMS = [];

// DEPRECATED: Use formatBillingTerm from utils/billingHelpers instead
export const formatBillingTerm = (term) => {
  return String(term);
};

/**
 * Format source to display-friendly label
 * @param {string} source - The source value
 * @returns {string} Formatted source label
 */
export const formatSource = (source) => {
  if (!source) return 'Unknown';

  const sourceObj = TRANSACTION_SOURCES.find(s => s.value === source);
  return sourceObj ? sourceObj.label : source;
};

/**
 * Format payment method to display-friendly format
 * @param {string} method - The payment method
 * @returns {string} Formatted payment method
 */
export const formatPaymentMethod = (method) => {
  if (!method) return 'Unknown';

  // Handle various formats
  const methodMap = {
    'credit_card': 'Credit Card',
    'credit card': 'Credit Card',
    'debit_card': 'Debit Card',
    'debit card': 'Debit Card',
    'paypal': 'PayPal',
    'bank_transfer': 'Bank Transfer',
    'bank transfer': 'Bank Transfer',
    'cash': 'Cash',
    'check': 'Check'
  };

  return methodMap[method.toLowerCase()] || method;
};

/**
 * Get status configuration by value
 * @param {string} status - The status value
 * @returns {object} Status configuration object
 */
export const getStatusConfig = (status) => {
  return TRANSACTION_STATUSES.find(s => s.value === status) || TRANSACTION_STATUSES[1]; // Default to completed
};
