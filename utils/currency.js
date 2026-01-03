/**
 * Currency conversion utilities for CAD/USD
 * Exchange rate: 1 USD = 1.25 CAD (100 USD = 125 CAD)
 */

class CurrencyHelper {
  /**
   * Convert amount from one currency to another
   * @param {number} amount
   * @param {string} fromCurrency - 'CAD' or 'USD'
   * @param {string} toCurrency - 'CAD' or 'USD'
   * @param {number} exchangeRate - USD to CAD rate (default: 1.25)
   * @returns {number} converted amount
   */
  static convert(amount, fromCurrency, toCurrency, exchangeRate = 1.25) {
    // If same currency, no conversion needed
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // USD to CAD: multiply by rate (1 USD = 1.25 CAD)
    if (fromCurrency === 'USD' && toCurrency === 'CAD') {
      return amount * exchangeRate;
    }

    // CAD to USD: divide by rate (1.25 CAD = 1 USD)
    if (fromCurrency === 'CAD' && toCurrency === 'USD') {
      return amount / exchangeRate;
    }

    // Fallback: return original amount
    return amount;
  }

  /**
   * Convert any amount to CAD (reporting currency)
   * @param {number} amount
   * @param {string} fromCurrency
   * @param {number} exchangeRate
   * @returns {number}
   */
  static toCAD(amount, fromCurrency, exchangeRate = 1.25) {
    return this.convert(amount, fromCurrency, 'CAD', exchangeRate);
  }

  /**
   * Format examples:
   * - 100 USD → 125 CAD
   * - 1000 USD → 1250 CAD
   * - 125 CAD → 100 USD
   */
}

module.exports = CurrencyHelper;
