/**
 * Format phone number to consistent format: +1 (647) 642-4742
 * Works with 10-digit, 11-digit (starting with 1), and international numbers
 */
export function formatPhoneNumber(phone) {
  if (!phone) return ''

  // Strip everything except digits
  const digits = phone.replace(/\D/g, '')

  // Handle North American numbers (10 digits)
  if (digits.length === 10) {
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // Handle North American numbers (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }

  // For other international numbers, just add + if missing
  if (digits.length > 11) {
    return `+${digits}`
  }

  // If less than 10 digits, return as-is (partial number)
  return phone
}
