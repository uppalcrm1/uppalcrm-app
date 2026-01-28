import { format, parseISO } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Timezone utilities for frontend
 * Handles timezone conversions and formatting with timezone support
 */

/**
 * Format a date/timestamp with timezone awareness
 * Converts server UTC time to user's local timezone
 *
 * @param {string|Date} dateValue - The date to format (ISO string or Date object)
 * @param {string} userTimezone - User's timezone (e.g., 'America/New_York')
 * @param {string} formatStr - Format string for date-fns (default: 'MMM d, yyyy HH:mm')
 * @returns {string} Formatted date in user's timezone
 */
export function formatDateWithTimezone(dateValue, userTimezone, formatStr = 'MMM d, yyyy HH:mm') {
  if (!dateValue || !userTimezone) {
    return '—';
  }

  try {
    // Parse the date
    let dateObj;
    if (typeof dateValue === 'string') {
      dateObj = parseISO(dateValue);
    } else if (dateValue instanceof Date) {
      dateObj = dateValue;
    } else {
      return '—';
    }

    // Convert to user's timezone and format
    const zonedDate = toZonedTime(dateObj, userTimezone);
    return format(zonedDate, formatStr);
  } catch (error) {
    console.warn('Error formatting date with timezone:', error);
    return '—';
  }
}

/**
 * Format time only with timezone
 * @param {string|Date} dateValue - The date to format
 * @param {string} userTimezone - User's timezone
 * @param {string} formatStr - Format string (default: 'HH:mm:ss zzz')
 * @returns {string} Formatted time
 */
export function formatTimeWithTimezone(dateValue, userTimezone, formatStr = 'HH:mm:ss zzz') {
  if (!dateValue || !userTimezone) {
    return '—';
  }

  try {
    let dateObj;
    if (typeof dateValue === 'string') {
      dateObj = parseISO(dateValue);
    } else if (dateValue instanceof Date) {
      dateObj = dateValue;
    } else {
      return '—';
    }

    return formatInTimeZone(dateObj, userTimezone, formatStr);
  } catch (error) {
    console.warn('Error formatting time with timezone:', error);
    return '—';
  }
}

/**
 * Format a timestamp in user's timezone with short format
 * @param {string|Date} dateValue
 * @param {string} userTimezone
 * @returns {string}
 */
export function formatDateTimeShort(dateValue, userTimezone) {
  return formatDateWithTimezone(dateValue, userTimezone, 'MMM d, yyyy HH:mm');
}

/**
 * Format date only (no time)
 * @param {string|Date} dateValue
 * @param {string} userTimezone
 * @returns {string}
 */
export function formatDateOnlyWithTimezone(dateValue, userTimezone) {
  return formatDateWithTimezone(dateValue, userTimezone, 'MMM d, yyyy');
}

/**
 * Convert server UTC time to user's timezone string
 * @param {string|Date} dateValue
 * @param {string} userTimezone
 * @returns {string} e.g., "2025-01-27 14:30:00 EST"
 */
export function formatFullDateTimeWithTimezone(dateValue, userTimezone) {
  return formatDateWithTimezone(dateValue, userTimezone, 'yyyy-MM-dd HH:mm:ss zzz');
}

/**
 * Get current time in user's timezone
 * @param {string} userTimezone
 * @param {string} formatStr
 * @returns {string}
 */
export function getCurrentTimeInTimezone(userTimezone, formatStr = 'HH:mm:ss') {
  return formatInTimeZone(new Date(), userTimezone, formatStr);
}

/**
 * Validate timezone string
 * @param {string} timezone
 * @returns {boolean}
 */
export function isValidTimezone(timezone) {
  // This will throw if timezone is invalid
  try {
    formatInTimeZone(new Date(), timezone, 'HH:mm');
    return true;
  } catch {
    return false;
  }
}
