# Billing Helpers Usage Guide 📚

A quick reference for using the new `billingHelpers.js` utility in frontend components.

---

## 🎯 Import Statement

```javascript
import {
  formatBillingTerm,           // Main function - use most often
  getShortBillingTerm,         // For compact displays
  billingCycleToTerm,          // Convert old format to numeric
  termToBillingCycle,          // Convert numeric to old format
  formatBillingTermDisplay     // Flexible multi-purpose function
} from '../utils/billingHelpers'
```

---

## 📖 Function Reference

### 1. `formatBillingTerm(months)` ⭐ Most Common

Converts numeric billing months to readable labels.

**Usage:**
```javascript
formatBillingTerm(1)   // → "Monthly (1 month)"
formatBillingTerm(3)   // → "Quarterly (3 months)"
formatBillingTerm(6)   // → "Semi-Annual (6 months)"
formatBillingTerm(12)  // → "Annual (12 months)"
formatBillingTerm(24)  // → "Biennial (2 years)"
formatBillingTerm(99)  // → "99 months" (unknown value)
```

**Best For:**
- Dropdown labels
- Display in tables
- Form field labels
- Status messages
- Billing information panels

**Example in Component:**
```javascript
{BILLING_TERMS.map(term => (
  <option key={term.value} value={term.value}>
    {formatBillingTerm(parseInt(term.value))}
  </option>
))}
```

---

### 2. `getShortBillingTerm(months)`

Compact billing term labels (no parentheses, shorter format).

**Usage:**
```javascript
getShortBillingTerm(1)   // → "Monthly"
getShortBillingTerm(3)   // → "Quarterly"
getShortBillingTerm(6)   // → "Semi-Annual"
getShortBillingTerm(12)  // → "Annual"
getShortBillingTerm(24)  // → "Biennial"
getShortBillingTerm(99)  // → "99mo" (unknown value)
```

**Best For:**
- Table columns
- Badge labels
- Compact displays
- Mobile views
- Header labels

**Example in Component:**
```javascript
<td className="px-4 py-2">
  <span className="badge">
    {getShortBillingTerm(account.billing_term_months)}
  </span>
</td>
```

---

### 3. `billingCycleToTerm(billingCycle)`

Converts old `billing_cycle` string format to numeric term value.

**Usage:**
```javascript
billingCycleToTerm('monthly')      // → 1
billingCycleToTerm('quarterly')    // → 3
billingCycleToTerm('semi-annual')  // → 6
billingCycleToTerm('semi_annual')  // → 6 (both formats work)
billingCycleToTerm('annual')       // → 12
billingCycleToTerm('biennial')     // → 24
billingCycleToTerm('yearly')       // → 12 (alias)
billingCycleToTerm('MONTHLY')      // → 1 (case insensitive)
billingCycleToTerm('invalid')      // → 1 (default fallback)
```

**Best For:**
- Migrating from old `billing_cycle` field
- Backward compatibility fallback
- Converting legacy data

**Example in Component:**
```javascript
// Fallback to old field if new field not available
const term = account.billing_term_months ||
             billingCycleToTerm(account.billing_cycle)
```

---

### 4. `termToBillingCycle(months)`

Converts numeric term value to old `billing_cycle` string format.

**Usage:**
```javascript
termToBillingCycle(1)   // → "monthly"
termToBillingCycle(3)   // → "quarterly"
termToBillingCycle(6)   // → "semi_annual"
termToBillingCycle(12)  // → "annual"
termToBillingCycle(24)  // → "biennial"
termToBillingCycle(99)  // → "monthly" (default fallback)
```

**Best For:**
- Sending legacy field values to old APIs
- Backward compatibility
- Data format conversion

**Example in Component:**
```javascript
// If API still expects old field
const payload = {
  billing_term_months: formData.term,
  billing_cycle: termToBillingCycle(formData.term) // For backward compat
}
```

---

### 5. `formatBillingTermDisplay(term, format)`

Flexible function that handles both numeric and string inputs.

**Usage:**
```javascript
// With numeric input
formatBillingTermDisplay(6)              // → "Semi-Annual (6 months)"
formatBillingTermDisplay(6, 'full')      // → "Semi-Annual (6 months)" (default)
formatBillingTermDisplay(6, 'short')     // → "Semi-Annual"

// With string input (old format)
formatBillingTermDisplay('annual')       // → "Annual (12 months)"
formatBillingTermDisplay('annual', 'short') // → "Annual"

// Mixed usage
formatBillingTermDisplay(account.billing_term_months || 'monthly')
formatBillingTermDisplay(term, isMobileView ? 'short' : 'full')
```

**Best For:**
- When you don't know if input is numeric or string
- Responsive layouts (short on mobile, full on desktop)
- Flexible components

---

## ✅ Common Patterns

### Pattern 1: Display Account Billing Cycle
```javascript
// ❌ OLD WAY (corrupted field)
<p>{account.billing_cycle}</p>

// ✅ NEW WAY (clean field with formatting)
<p>{formatBillingTerm(account.billing_term_months) || 'N/A'}</p>
```

### Pattern 2: Populate Form from Account
```javascript
// When loading account for edit
const form = {
  // Use clean field with fallback to legacy field
  term: account.billing_term_months?.toString() ||
        billingCycleToTerm(account.billing_cycle)?.toString() ||
        '1'
}
```

### Pattern 3: Submit Form to Backend
```javascript
// Make sure to send the clean field name
const submitData = {
  account_name: formData.account_name,
  billing_term_months: parseInt(formData.term),  // Numeric!
  // ... other fields
}

await api.put(`/accounts/${id}`, submitData)
```

### Pattern 4: Responsive Display
```javascript
// Short on mobile, full on desktop
const isMobile = window.innerWidth < 768

<span>
  {formatBillingTermDisplay(
    account.billing_term_months,
    isMobile ? 'short' : 'full'
  )}
</span>
```

### Pattern 5: Dropdown with Formatted Options
```javascript
{BILLING_TERMS.map(term => (
  <option key={term.value} value={term.value}>
    {formatBillingTerm(parseInt(term.value))}
  </option>
))}
```

### Pattern 6: Backward Compatibility
```javascript
// Read from either clean or legacy field, prefer clean
const getTerm = (account) => {
  if (account.billing_term_months !== undefined) {
    return account.billing_term_months  // Clean field
  } else if (account.billing_cycle) {
    return billingCycleToTerm(account.billing_cycle)  // Legacy field
  } else {
    return 1  // Default
  }
}

// Use it
const term = getTerm(account)
console.log(formatBillingTerm(term))
```

---

## 🚨 Common Mistakes

### ❌ Don't do this:
```javascript
// WRONG: Displaying raw billing_cycle
<p>{account.billing_cycle}</p>

// WRONG: String comparison with numeric value
if (account.billing_term_months === '1') { }  // Should be === 1

// WRONG: Forgetting to parseInt
{formatBillingTerm(term.value)}  // If value is string!

// WRONG: Calculating next_renewal_date in frontend
const nextRenewal = new Date(account.created_at)  // NO!
```

### ✅ Do this instead:
```javascript
// RIGHT: Format the value before displaying
<p>{formatBillingTerm(account.billing_term_months)}</p>

// RIGHT: Compare as same type
if (account.billing_term_months === 1) { }

// RIGHT: Convert to number first
{formatBillingTerm(parseInt(term.value))}

// RIGHT: Use value from backend
<p>{formatDateOnly(account.next_renewal_date)}</p>
```

---

## 📊 Billing Terms Reference

| Numeric Value | Full Label | Short Label |
|---|---|---|
| 1 | Monthly (1 month) | Monthly |
| 3 | Quarterly (3 months) | Quarterly |
| 6 | Semi-Annual (6 months) | Semi-Annual |
| 12 | Annual (12 months) | Annual |
| 24 | Biennial (2 years) | Biennial |

---

## 💡 Tips & Tricks

**Tip 1: Use optional chaining for safety**
```javascript
{formatBillingTerm(account?.billing_term_months) || 'N/A'}
```

**Tip 2: Combine with constants**
```javascript
{BILLING_TERMS.map(term => (
  <option key={term.value} value={term.value}>
    {formatBillingTerm(parseInt(term.value))}
  </option>
))}
```

**Tip 3: Add help text**
```javascript
<label>
  Billing Term
  <select value={term} onChange={handleChange}>
    {/* options */}
  </select>
  <small>{formatBillingTerm(parseInt(term))}</small>
</label>
```

**Tip 4: Use in validation messages**
```javascript
if (!formData.term) {
  errors.term = 'Billing term is required'
} else {
  console.log(`Selected: ${formatBillingTerm(parseInt(formData.term))}`)
}
```

---

## 🔧 When to Update/Extend

If you need to:
- **Add new billing terms** (e.g., 36 months): Update the label objects in `billingHelpers.js`
- **Change labels** (e.g., "Monthly" → "Month-to-Month"): Update `formatBillingTerm()` and `getShortBillingTerm()`
- **Support new formats**: Add a new conversion function in `billingHelpers.js`

---

## 📚 Related Documentation

- `PHASE_2_FRONTEND_IMPLEMENTATION_SUMMARY.md` - Full implementation details
- `frontend/src/utils/billingHelpers.js` - Source code with JSDoc comments
- Account Management Agent definition - Business logic context

---

**Last Updated:** February 4, 2026
**Version:** 1.0

