/**
 * Timezone utility functions for backend
 * Handles timezone conversions and validations
 */

const TIMEZONE_LIST = require('./timezones.json');

/**
 * Validate if a timezone string is valid
 * @param {string} timezone - Timezone string (e.g., 'America/New_York')
 * @returns {boolean} True if valid timezone
 */
function isValidTimezone(timezone) {
  return TIMEZONE_LIST.some(tz => tz.value === timezone);
}

/**
 * Get all available timezones
 * @returns {Array} Array of timezone objects {value, label, offset}
 */
function getTimezoneList() {
  return TIMEZONE_LIST;
}

/**
 * Get timezone by value
 * @param {string} timezone - Timezone value
 * @returns {Object|null} Timezone object or null if not found
 */
function getTimezone(timezone) {
  return TIMEZONE_LIST.find(tz => tz.value === timezone) || null;
}

/**
 * Get user timezone with fallback
 * @param {Object} user - User object
 * @param {string} defaultTz - Default timezone fallback
 * @returns {string} Valid timezone string
 */
function getUserTimezone(user, defaultTz = 'America/New_York') {
  if (!user || !user.timezone) {
    return defaultTz;
  }

  return isValidTimezone(user.timezone) ? user.timezone : defaultTz;
}

module.exports = {
  isValidTimezone,
  getTimezoneList,
  getTimezone,
  getUserTimezone
};
