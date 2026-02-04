# Phase 2: Quick Reference Card 🚀

A one-page summary of Phase 2 changes for quick lookup.

---

## What Changed? 📋

| Aspect | Before | After |
|--------|--------|-------|
| **Field Name** | `billing_cycle` | `billing_term_months` |
| **Data Type** | String `'monthly'` | Number `1` |
| **Display** | Capitalized `MONTHLY` | Formatted `Monthly (1 month)` |
| **Calculation** | Some in frontend ❌ | Backend only ✅ |
| **Consistency** | Inconsistent ❌ | Centralized ✅ |

---

## Import Statement

```javascript
import {
  formatBillingTerm,
  getShortBillingTerm,
  billingCycleToTerm,
  termToBillingCycle,
  formatBillingTermDisplay
} from '../utils/billingHelpers'
```

---

## Quick Function Guide

| Function | Input | Output | Use Case |
|----------|-------|--------|----------|
| `formatBillingTerm(1)` | Number | `"Monthly (1 month)"` | Dropdowns, Tables, Displays |
| `getShortBillingTerm(1)` | Number | `"Monthly"` | Badges, Compact Views |
| `billingCycleToTerm('monthly')` | String | `1` | Legacy Data Conversion |
| `termToBillingCycle(1)` | Number | `"monthly"` | API Compatibility |
| `formatBillingTermDisplay(6, 'short')` | Number + Format | `"Semi-Annual"` | Flexible Display |

---

## Common Patterns

### Pattern 1: Display Billing Term
```javascript
// Display from account data
{formatBillingTerm(account.billing_term_months) || 'N/A'}

// Result: "Monthly (1 month)" or "N/A"
```

### Pattern 2: Fallback to Legacy Field
```javascript
// Prefer clean field, fallback to old field
const term = account.billing_term_months ||
             billingCycleToTerm(account.billing_cycle) ||
             1

{formatBillingTerm(term)}
```

### Pattern 3: Form Submission
```javascript
// Send numeric value to API
const payload = {
  billing_term_months: parseInt(formData.term)  // 1, 3, 6, 12, 24
}
```

### Pattern 4: Dropdown Options
```javascript
{BILLING_TERMS.map(term => (
  <option key={term.value} value={term.value}>
    {formatBillingTerm(parseInt(term.value))}
  </option>
))}
```

---

## Billing Terms Mapping

```
1  → Monthly (1 month)
3  → Quarterly (3 months)
6  → Semi-Annual (6 months)
12 → Annual (12 months)
24 → Biennial (2 years)
```

---

## Components Updated

1. ✅ **AccountDetailsPanel.jsx** - Display billing term
2. ✅ **EditAccountModal.jsx** - Edit form with formatted labels
3. ✅ **AccountDetailsModal.jsx** - Create account modal
4. ✅ **LeadConversionModal.jsx** - Lead conversion
5. ✅ **CreateTransactionModal.jsx** - Transaction creation
6. ✅ **billingHelpers.js** - NEW helper utility

---

## Critical Rules

### ✅ DO THIS
```javascript
// Use clean field with fallback
const term = account.billing_term_months || billingCycleToTerm(account.billing_cycle)

// Format before display
{formatBillingTerm(term)}

// Send numeric values to API
{ billing_term_months: 1 }

// Display dates from backend
{formatDateOnly(account.next_renewal_date)}
```

### ❌ DON'T DO THIS
```javascript
// Don't display raw billing_cycle
{account.billing_cycle}

// Don't calculate dates in frontend
new Date(account.created_at) + months

// Don't send string values
{ billing_term_months: 'monthly' }

// Don't use string comparison
if (term === '1') { }  // Use: if (term === 1)
```

---

## Files to Reference

### For Implementation
- `frontend/src/utils/billingHelpers.js` - Helper functions source

### For Learning
- `BILLING_HELPERS_USAGE_GUIDE.md` - Complete function reference
- `PHASE_2_DETAILED_CHANGES.md` - Before/after code comparisons
- `PHASE_2_FRONTEND_IMPLEMENTATION_SUMMARY.md` - Architecture overview

---

## Testing Checklist

- [ ] `formatBillingTerm(12)` returns `"Annual (12 months)"`
- [ ] Dropdown shows formatted labels
- [ ] Form pre-populates correctly from account
- [ ] Form submits `billing_term_months: 1` (numeric)
- [ ] Legacy `billing_cycle` still works (fallback)
- [ ] No errors in console
- [ ] Display matches backend date (no calculations)

---

## Common Issues & Solutions

### Issue: "Billing term shows as 'undefined'"
**Solution:** Check if account has `billing_term_months` or `billing_cycle`
```javascript
{formatBillingTerm(account?.billing_term_months) || 'N/A'}
```

### Issue: "Form not pre-populating"
**Solution:** Use fallback logic in useEffect
```javascript
const term = account.billing_term_months ||
             billingCycleToTerm(account.billing_cycle) ||
             1
```

### Issue: "API says invalid billing_term_months"
**Solution:** Ensure you're sending numeric value
```javascript
billing_term_months: parseInt(formData.term)  // NOT string!
```

### Issue: "Type error: parseInt is not a function"
**Solution:** Make sure value is a string first
```javascript
parseInt(term.value)  // term.value is a string
```

---

## Migration Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Backend | ✅ DONE | `billing_term_months` table column added |
| Phase 2: Frontend | ✅ DONE | Components updated, helpers created |
| Phase 3: Backend | ⏳ PENDING | API validation, transaction updates |
| Phase 4: Migration | ⏳ PENDING | Populate data for all existing accounts |
| Phase 5: Cleanup | ⏳ PENDING | Remove legacy `billing_cycle` field |

---

## Key Architectural Decision ⚠️

### Frontend Does NOT Calculate Dates
- ❌ Backend calculates `next_renewal_date` when transaction is created
- ❌ Calculation stored in database
- ✅ Frontend displays value from `account.next_renewal_date`
- ✅ No timezone issues, consistent across all clients

---

## When You Need to...

### Add a new billing term
1. Update `billingHelpers.js` label maps
2. Update `BILLING_TERMS` constant
3. Done! No component changes needed

### Change label text
1. Update `formatBillingTerm()` in `billingHelpers.js`
2. Change applies globally

### Handle API response with both fields
1. Use fallback pattern: `billing_term_months || billingCycleToTerm(billing_cycle)`
2. Exists in: CreateTransactionModal, EditAccountModal

---

## Command Reference

### Find all usages
```bash
grep -r "billing_term_months" frontend/src/
grep -r "billingCycleToTerm" frontend/src/
```

### Check helper functions
```javascript
import { formatBillingTerm, getShortBillingTerm } from '../utils/billingHelpers'
```

---

## Version History

| Date | Phase | Status |
|------|-------|--------|
| Feb 4, 2026 | Phase 2 | ✅ COMPLETE |
| Pending | Phase 3 | ⏳ IN QUEUE |
| Pending | Phase 4 | ⏳ IN QUEUE |
| Pending | Phase 5 | ⏳ IN QUEUE |

---

## Related Documentation

- 📖 `BILLING_HELPERS_USAGE_GUIDE.md` - Detailed function reference
- 📋 `PHASE_2_DETAILED_CHANGES.md` - Line-by-line changes
- 🏗️ `PHASE_2_FRONTEND_IMPLEMENTATION_SUMMARY.md` - Architecture overview
- ✅ `PHASE_2_COMPLETION_SUMMARY.md` - Full completion status

---

**Last Updated:** February 4, 2026
**Quick Reference Version:** 1.0

