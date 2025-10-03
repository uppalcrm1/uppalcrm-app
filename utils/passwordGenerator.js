const crypto = require('crypto');

/**
 * Generate a secure random password
 * @param {number} length - Password length (default: 16)
 * @returns {string} Generated password
 */
function generateSecurePassword(length = 16) {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';

  const allChars = lowercase + uppercase + numbers + symbols;

  let password = '';

  // Ensure at least one character from each set
  password += lowercase[crypto.randomInt(0, lowercase.length)];
  password += uppercase[crypto.randomInt(0, uppercase.length)];
  password += numbers[crypto.randomInt(0, numbers.length)];
  password += symbols[crypto.randomInt(0, symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(0, allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => crypto.randomInt(-1, 2)).join('');
}

/**
 * Generate a slug from company name
 * @param {string} companyName - Company name
 * @returns {string} URL-safe slug
 */
function generateSlug(companyName) {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * Generate a unique slug by appending numbers if needed
 * @param {string} baseSlug - Base slug
 * @param {Function} checkExists - Async function to check if slug exists
 * @returns {Promise<string>} Unique slug
 */
async function generateUniqueSlug(baseSlug, checkExists) {
  let slug = baseSlug;
  let counter = 1;

  while (await checkExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

module.exports = {
  generateSecurePassword,
  generateSlug,
  generateUniqueSlug
};
