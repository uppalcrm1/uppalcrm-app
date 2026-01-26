import { format, isValid, parseISO } from 'date-fns';

/**
 * Safely format a date value to a string
 * Handles null, undefined, empty strings, and invalid dates gracefully
 * @param {string|Date|null} dateValue - The date to format
 * @param {string} formatStr - The format string (default: 'MMM d, yyyy')
 * @param {string} fallback - Fallback text if date is invalid (default: '—')
 * @returns {string} Formatted date or fallback text
 */
export const formatDate = (dateValue, formatStr = 'MMM d, yyyy', fallback = '—') => {
  if (!dateValue) {
    return fallback;
  }

  try {
    let dateObj;

    // Handle string dates (ISO format from database)
    if (typeof dateValue === 'string') {
      // Skip empty strings
      if (dateValue.trim() === '') {
        return fallback;
      }
      dateObj = parseISO(dateValue);
    } else if (dateValue instanceof Date) {
      dateObj = dateValue;
    } else {
      return fallback;
    }

    // Check if the date is valid
    if (!isValid(dateObj)) {
      return fallback;
    }

    return format(dateObj, formatStr);
  } catch (error) {
    console.warn('Date formatting error:', error, 'for value:', dateValue);
    return fallback;
  }
};

/**
 * Format a date relative to now (e.g., "2 days ago")
 * @param {string|Date|null} dateValue - The date to format
 * @param {string} fallback - Fallback text if date is invalid
 * @returns {string} Relative date string or fallback
 */
export const formatDateRelative = (dateValue, fallback = '—') => {
  if (!dateValue) {
    return fallback;
  }

  try {
    let dateObj;

    if (typeof dateValue === 'string') {
      if (dateValue.trim() === '') {
        return fallback;
      }
      dateObj = parseISO(dateValue);
    } else if (dateValue instanceof Date) {
      dateObj = dateValue;
    } else {
      return fallback;
    }

    if (!isValid(dateObj)) {
      return fallback;
    }

    const now = new Date();
    const diffMs = now - dateObj;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return format(dateObj, 'MMM d, yyyy');
  } catch (error) {
    console.warn('Relative date formatting error:', error, 'for value:', dateValue);
    return fallback;
  }
};

/**
 * Check if a date value is valid and not null
 * @param {*} dateValue - The value to check
 * @returns {boolean} True if date is valid
 */
export const isValidDate = (dateValue) => {
  if (!dateValue) {
    return false;
  }

  try {
    let dateObj;

    if (typeof dateValue === 'string') {
      if (dateValue.trim() === '') {
        return false;
      }
      dateObj = parseISO(dateValue);
    } else if (dateValue instanceof Date) {
      dateObj = dateValue;
    } else {
      return false;
    }

    return isValid(dateObj);
  } catch (error) {
    return false;
  }
};
