/**
 * Date utility functions to handle DATE fields without timezone conversion
 */

/**
 * Format a DATE string (YYYY-MM-DD or ISO timestamp) to localized date string
 * without timezone conversion.
 *
 * This prevents the common issue where DATE fields stored as "2025-12-15T00:00:00.000Z"
 * get converted to local timezone and display as "12/14/2025" instead of "12/15/2025".
 *
 * @param {string} dateString - Date string in YYYY-MM-DD or ISO format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDateOnly(dateString, options = {}) {
  if (!dateString) return 'N/A';

  // Extract just the date part (YYYY-MM-DD) from any format
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);

  // Create date using local timezone (not UTC) to prevent shifting
  const date = new Date(year, month - 1, day);

  // Format with default US locale
  const defaultOptions = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    ...options
  };

  return date.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Format a DATE string to MM/DD/YYYY format
 *
 * @param {string} dateString - Date string in YYYY-MM-DD or ISO format
 * @returns {string} Date in MM/DD/YYYY format
 */
export function formatDateShort(dateString) {
  if (!dateString) return 'N/A';

  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-');

  return `${month}/${day}/${year}`;
}

/**
 * Format a DATE string to "Month DD, YYYY" format
 *
 * @param {string} dateString - Date string in YYYY-MM-DD or ISO format
 * @returns {string} Date in "Month DD, YYYY" format
 */
export function formatDateLong(dateString) {
  if (!dateString) return 'N/A';

  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);

  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
