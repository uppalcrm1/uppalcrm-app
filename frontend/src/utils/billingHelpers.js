/**
 * Billing Term Helper Functions
 * Fetches term options from API config and caches them
 * Falls back to hardcoded defaults if API is unavailable
 */

import api from '../services/api';

// Cache for term options - loaded once, used everywhere
let termOptionsCache = null;
let fetchPromise = null;

// Hardcoded fallbacks (used only if API fails)
const DEFAULT_TERM_OPTIONS = [
  { label: '1 Month',  value: 1,  is_default: true, sort_order: 1 },
  { label: '3 Months', value: 3,  is_default: true, sort_order: 2 },
  { label: '6 Months', value: 6,  is_default: true, sort_order: 3 },
  { label: '1 Year',   value: 12, is_default: true, sort_order: 4 }
];

/**
 * Load term options from API (cached after first call)
 * @returns {Promise<Array>} Array of term option objects
 */
export const loadTermOptions = async () => {
  // Return cache if already loaded
  if (termOptionsCache) return termOptionsCache;

  // If already fetching, wait for the same promise (prevents duplicate calls)
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const response = await api.get('/custom-fields?entity_type=transactions');
      const data = response.data;

      // Find the term field in system fields
      const systemFields = data.systemFields || data.fields || [];
      const termField = systemFields.find(f => f.field_name === 'term');

      if (termField && termField.field_options && Array.isArray(termField.field_options)) {
        termOptionsCache = termField.field_options.sort((a, b) =>
          (a.value || 0) - (b.value || 0)
        );
      } else {
        termOptionsCache = DEFAULT_TERM_OPTIONS;
      }
    } catch (err) {
      console.error('Failed to load term options from API, using defaults:', err);
      termOptionsCache = DEFAULT_TERM_OPTIONS;
    }

    fetchPromise = null;
    return termOptionsCache;
  })();

  return fetchPromise;
};

/**
 * Get term options synchronously (returns cache or defaults)
 * Call loadTermOptions() first if you need fresh data
 * @returns {Array} Array of term option objects
 */
export const getTermOptions = () => {
  if (!termOptionsCache && !fetchPromise) {
    loadTermOptions(); // trigger background fetch
  }
  return termOptionsCache || DEFAULT_TERM_OPTIONS;
};

/**
 * Clear the cache (useful after admin updates term config)
 */
export const clearTermOptionsCache = () => {
  termOptionsCache = null;
  fetchPromise = null;
};

/**
 * Map numeric billing term months to user-friendly labels
 * @param {number} months - Number of months (1, 3, 6, 12, etc.)
 * @returns {string} Formatted billing term label
 */
export const formatBillingTerm = (months) => {
  const options = getTermOptions();
  const match = options.find(opt => opt.value === parseInt(months));
  if (match) return match.label;

  // Fallback for unknown values
  if (months >= 12 && months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? '1 Year' : `${years} Years`;
  }
  return `${months} Months`;
};

/**
 * Get a short label for billing term (for table columns, badges, etc.)
 * @param {number} months - Number of months
 * @returns {string} Short billing term label
 */
export const getShortBillingTerm = (months) => {
  // Short label is same as the config label in our new format
  return formatBillingTerm(months);
};

/**
 * Format billing term for display in tables and lists
 * @param {number} months - Billing term in months
 * @param {string} format - 'full' (default) or 'short'
 * @returns {string} Formatted billing term
 */
export const formatBillingTermDisplay = (months, format = 'full') => {
  return formatBillingTerm(months);
};

// Auto-load disabled - term options will be loaded on-demand when first needed
// This prevents unnecessary 401 errors on unauthenticated pages like /super-admin/login
// loadTermOptions();
