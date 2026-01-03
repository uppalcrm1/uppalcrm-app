/**
 * Currency formatting and conversion utilities
 * Supports CAD and USD only
 * Exchange rate: 1 USD = 1.25 CAD
 */

/**
 * Format currency with proper symbol and locale
 * @param {number} amount
 * @param {string} currency - 'CAD' or 'USD' (default: 'CAD')
 * @returns {string} formatted currency string
 */
export const formatCurrency = (amount, currency = 'CAD') => {
  if (!amount && amount !== 0) return formatCurrency(0, currency);

  // Use Canadian locale for CAD, US locale for USD
  const locale = currency === 'CAD' ? 'en-CA' : 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Get currency symbol
 * @param {string} currency
 * @returns {string}
 */
export const getCurrencySymbol = (currency) => {
  return currency === 'CAD' ? 'C$' : '$';
};

/**
 * Get currency name
 * @param {string} currency
 * @returns {string}
 */
export const getCurrencyName = (currency) => {
  const names = {
    'CAD': 'Canadian Dollar',
    'USD': 'US Dollar'
  };
  return names[currency] || currency;
};

/**
 * Convert amount between CAD and USD
 * @param {number} amount
 * @param {string} from - 'CAD' or 'USD'
 * @param {string} to - 'CAD' or 'USD'
 * @param {number} exchangeRate - USD to CAD rate (default: 1.25)
 * @returns {number}
 */
export const convertCurrency = (amount, from, to, exchangeRate = 1.25) => {
  if (from === to) return amount;

  // USD to CAD: multiply (1 USD = 1.25 CAD)
  if (from === 'USD' && to === 'CAD') {
    return amount * exchangeRate;
  }

  // CAD to USD: divide (1.25 CAD = 1 USD)
  if (from === 'CAD' && to === 'USD') {
    return amount / exchangeRate;
  }

  return amount;
};

/**
 * Convert any amount to CAD (reporting currency)
 * @param {number} amount
 * @param {string} fromCurrency
 * @param {number} exchangeRate
 * @returns {number}
 */
export const toCAD = (amount, fromCurrency, exchangeRate = 1.25) => {
  return convertCurrency(amount, fromCurrency, 'CAD', exchangeRate);
};
