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
export const TRANSACTION_SOURCES = [
  { value: 'manual', label: 'Manual Entry' },
  { value: 'website', label: 'Website' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'referral', label: 'Referral' },
  { value: 'walk-in', label: 'Walk-in' },
  { value: 'partner', label: 'Partner' }
];

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
export const BILLING_TERMS = [
  { value: '1', label: 'Monthly (1 month)' },
  { value: '3', label: 'Quarterly (3 months)' },
  { value: '6', label: 'Semi-Annual (6 months)' },
  { value: '12', label: 'Annual (12 months)' }
];

/**
 * Format billing term number to human-readable string
 * @param {string|number} term - The term value (1, 3, 6, or 12)
 * @returns {string} Formatted term string
 */
export const formatBillingTerm = (term) => {
  const termMap = {
    '1': '1 month',
    '3': '3 months',
    '6': '6 months',
    '12': '1 year'
  };
  return termMap[String(term)] || term;
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
