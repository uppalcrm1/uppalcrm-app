# Billing Helpers Usage Guide

## Overview

Billing term options are **dynamically configurable per organization** through Admin Settings → Field Configuration → Transactions → Billing Term.

Term options are loaded from the `default_field_configurations` database table and cached in the frontend for performance.

## Key Functions (from `frontend/src/utils/billingHelpers.js`)

### `loadTermOptions()` (async)
Fetches term options from the API and caches them. Called automatically on app load.
```js
import { loadTermOptions } from '../utils/billingHelpers';
const options = await loadTermOptions();
// Returns: [{ label: "1 Month", value: 1 }, { label: "3 Months", value: 3 }, ...]
```

### `getTermOptions()` (sync)
Returns cached term options. If cache is empty, triggers a background fetch and returns defaults.
```js
import { getTermOptions } from '../utils/billingHelpers';
const options = getTermOptions();
// Use in dropdowns:
options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)
```

### `formatBillingTerm(months)` (sync)
Converts integer months to display label using cached options.
```js
import { formatBillingTerm } from '../utils/billingHelpers';
formatBillingTerm(1)   // → "1 Month"
formatBillingTerm(12)  // → "1 Year"
formatBillingTerm(24)  // → "2 Years" (if configured)
```

### `clearTermOptionsCache()`
Clears the cache so next call fetches fresh data from API. Called automatically after admin saves field config changes.
```js
import { clearTermOptionsCache } from '../utils/billingHelpers';
clearTermOptionsCache(); // Next getTermOptions() call will re-fetch
```

## How It Works

1. **App starts** → `loadTermOptions()` auto-runs, fetches from `/api/custom-fields?entity_type=transactions`
2. **Options cached** → `getTermOptions()` returns cached array, sorted by months value ascending
3. **Admin adds/edits term** → `clearTermOptionsCache()` runs, next page load gets fresh data
4. **API unavailable** → Falls back to defaults: 1 Month, 3 Months, 6 Months, 1 Year

## Option Format

Each term option has this structure:
```json
{
  "label": "1 Year",
  "value": 12,
  "is_default": true,
  "sort_order": 4
}
```

- `label` — Display text shown in dropdowns and tables
- `value` — Integer months, used for all calculations (monthly cost, renewal dates)
- `is_default` — System defaults (1, 3, 6, 12) cannot be removed
- `sort_order` — Display order (options sorted by `value` ascending in practice)

## Backend Calculations

All backend billing calculations use simple math with `billing_term_months` integer:

- **Monthly cost:** `price / billing_term_months`
- **Renewal date:** `created_at + (billing_term_months * INTERVAL '1 month')`
- **Transaction ID:** Looks up label from `default_field_configurations` table

No hardcoded CASE statements — works with any integer value.

## DEPRECATED

The following are deprecated and should NOT be used:
- `BILLING_TERMS` constant in `frontend/src/constants/transactions.js` — replaced by `getTermOptions()`
- `formatBillingTerm()` in `frontend/src/constants/transactions.js` — replaced by `formatBillingTerm()` in `billingHelpers.js`
- `BILLING_CYCLE_OPTIONS` in `AccountsPage.jsx` — removed (was unused dead code)
