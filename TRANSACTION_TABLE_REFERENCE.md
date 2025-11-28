# Transaction Page - 8 Column Table Reference

## Visual Table Structure

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  TRANSACTIONS PAGE                                                                                   [Export Report]        │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                                          │
│  │ Total Revenue  │  │ Total Trans    │  │ This Month     │  │ Avg Transaction│                                          │
│  │ $15,840.00     │  │ 42             │  │ $3,240.00      │  │ $377.14        │                                          │
│  └────────────────┘  └────────────────┘  └────────────────┘  └────────────────┘                                          │
│                                                                                                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [Search...]  [All Status ▼]  [All Methods ▼]  [All Sources ▼]                                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                             │
│  ┌─────────────┬──────────────────────┬─────────────────┬─────────────────┬──────────┬──────────┬──────────────┬─────────┐ │
│  │ Payment     │ Transaction ID       │ Account Name    │ Contact Name    │ Amount   │ Source   │ Pay Method   │ Actions │ │
│  │ Date        │                      │                 │                 │          │          │              │         │ │
│  ├─────────────┼──────────────────────┼─────────────────┼─────────────────┼──────────┼──────────┼──────────────┼─────────┤ │
│  │ 📅 2025-11-27│ manjit singh tv -   │ 🔗 manjit singh│ 🔗 manjit singh │ $120.00  │ Website  │ 💳 Credit    │ 👁️ ✏️ 🗑️ │ │
│  │             │ 1 year               │ tv              │                 │          │          │ Card         │         │ │
│  ├─────────────┼──────────────────────┼─────────────────┼─────────────────┼──────────┼──────────┼──────────────┼─────────┤ │
│  │ 📅 2025-11-26│ john doe device -   │ 🔗 john doe    │ 🔗 john doe     │ $360.00  │ Phone    │ 💳 PayPal    │ 👁️ ✏️ 🗑️ │ │
│  │             │ 3 months             │ device          │                 │          │          │              │         │ │
│  ├─────────────┼──────────────────────┼─────────────────┼─────────────────┼──────────┼──────────┼──────────────┼─────────┤ │
│  │ 📅 2025-11-25│ sarah lee laptop -  │ 🔗 sarah lee   │ 🔗 sarah lee    │ $600.00  │ Referral │ 💳 Bank      │ 👁️ ✏️ 🗑️ │ │
│  │             │ 6 months             │ laptop          │                 │          │          │ Transfer     │         │ │
│  ├─────────────┼──────────────────────┼─────────────────┼─────────────────┼──────────┼──────────┼──────────────┼─────────┤ │
│  │ 📅 2025-11-24│ mike brown pc -     │ 🔗 mike brown  │ 🔗 mike brown   │ $40.00   │ Email    │ 💳 Cash      │ 👁️ ✏️ 🗑️ │ │
│  │             │ 1 month              │ pc              │                 │          │          │              │         │ │
│  └─────────────┴──────────────────────┴─────────────────┴─────────────────┴──────────┴──────────┴──────────────┴─────────┘ │
│                                                                                                                             │
│  Showing 4 of 42 transaction(s)                                                                                            │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Column Breakdown

### 📋 Column 1: Payment Date
```
Format:     YYYY-MM-DD
Example:    2025-11-27
Icon:       📅 Calendar
Font:       Monospace
Color:      Gray-900
Width:      ~120px
Purpose:    Record date tracking
```

### 🔢 Column 2: Transaction ID
```
Format:     Account Name - Term
Examples:
  - "manjit singh tv - 1 year"
  - "john doe device - 3 months"
  - "sarah lee laptop - 6 months"
  - "mike brown pc - 1 month"

Generation: Backend SQL CONCAT(account_name, ' - ', formatted_term)
Font:       Regular, medium weight
Color:      Gray-900
Width:      ~220px
Purpose:    Human-readable identifier
```

### 🏢 Column 3: Account Name
```
Format:     Clickable link (blue)
Example:    manjit singh tv
Link To:    /accounts/{account_id}
Source:     transactions.account_id → accounts.account_name
Hover:      Underline + darker blue
Color:      Blue-600 (hover: Blue-800)
Width:      ~180px
Purpose:    Navigate to account details
```

### 👤 Column 4: Contact Name
```
Format:     Clickable link (blue)
Example:    manjit singh
Link To:    /contacts/{contact_id}
Source:     transactions → accounts → contacts (2-step JOIN)
Hover:      Underline + darker blue
Color:      Blue-600 (hover: Blue-800)
Width:      ~180px
Purpose:    Navigate to contact details
```

### 💰 Column 5: Amount
```
Format:     $XXX.XX (US currency)
Examples:   $120.00, $360.00, $600.00, $40.00
Decimals:   Always 2 decimal places
Font:       Bold, semibold
Color:      Green-600
Width:      ~100px
Purpose:    Show payment amount / revenue
```

### 📍 Column 6: Source
```
Format:     Capitalized text
Examples:   Website, Phone, Email, Referral
Options:
  - Website
  - Phone
  - Email
  - Referral
  - Walk-in
  - Partner
  - Social Media
  - Other

Font:       Regular
Color:      Gray-700
Width:      ~120px
Purpose:    Track lead/payment origin for marketing analytics
```

### 💳 Column 7: Pay Method
```
Format:     Formatted text with icon
Examples:   💳 Credit Card, 💳 PayPal, 💳 Bank Transfer, 💳 Cash
Options:
  - Credit Card
  - Debit Card
  - PayPal
  - Bank Transfer
  - Cash
  - Check

Icon:       Credit card icon (gray-400)
Font:       Regular
Color:      Gray-700
Width:      ~150px
Purpose:    Track payment method distribution
```

### ⚙️ Column 8: Actions
```
Format:     3 icon buttons (horizontal)
Buttons:
  1. 👁️ View    (Blue-600, hover: Blue-800 + bg-blue-50)
  2. ✏️ Edit    (Gray-600, hover: Gray-800 + bg-gray-100)
  3. 🗑️ Delete  (Red-600, hover: Red-800 + bg-red-50)

Size:       16px icons
Spacing:    2px gap between buttons
Tooltips:   "View Details", "Edit Transaction", "Delete Transaction"
Width:      ~100px
Purpose:    Quick transaction management actions
```

---

## Summary Cards (Top of Page)

### Card 1: Total Revenue 💰
```
Label:      Total Revenue
Value:      $15,840.00
Icon:       Dollar sign (green)
Color:      Green-600
Background: Green-100
Calculation: SUM(amount) WHERE status = 'completed'
```

### Card 2: Total Transactions 📊
```
Label:      Total Transactions
Value:      42
Icon:       Check circle (blue)
Color:      Blue-600
Background: Blue-100
Calculation: COUNT(*)
```

### Card 3: This Month 📅
```
Label:      This Month
Value:      $3,240.00
Icon:       Calendar (purple)
Color:      Purple-600
Background: Purple-100
Calculation: SUM(amount) WHERE payment_date >= first_day_of_month AND status = 'completed'
```

### Card 4: Average Transaction 📈
```
Label:      Average Transaction
Value:      $377.14
Icon:       Trending up (orange)
Color:      Orange-600
Background: Orange-100
Calculation: Total Revenue / Count of completed transactions
```

---

## Filter Options

### 🔍 Search Box
```
Placeholder: "Search transactions..."
Searches:
  - Transaction ID
  - Account Name
  - Contact Name
Type:       Text input with search icon
Real-time:  Yes (filters as you type)
```

### 📊 Status Filter
```
Options:
  - All Status
  - Completed   (green badge)
  - Pending     (yellow badge)
  - Failed      (red badge)
  - Refunded    (blue badge)
```

### 💳 Payment Method Filter
```
Options:
  - All Methods
  - Credit Card
  - PayPal
  - Bank Transfer
  - Cash
  - Check
```

### 📍 Source Filter
```
Options:
  - All Sources
  - Website
  - Phone
  - Email
  - Referral
  - Walk-in
  - Partner
```

---

## Action Button Behaviors

### 👁️ View Button (Blue)
```
Action:     View transaction details
onClick:    handleView(transaction.id)
Navigate:   To transaction details page/modal
Tooltip:    "View Details"
Hover:      Blue-800 background + darker text
```

### ✏️ Edit Button (Gray)
```
Action:     Edit transaction
onClick:    handleEdit(transaction.id)
Opens:      Edit modal or form
Tooltip:    "Edit Transaction"
Hover:      Gray-100 background + darker text
Fields:     Amount, payment method, source, status, notes
```

### 🗑️ Delete Button (Red)
```
Action:     Delete transaction
onClick:    handleDelete(transaction.id)
Confirm:    "Are you sure you want to delete this transaction?"
API Call:   DELETE /api/transactions/:id
Tooltip:    "Delete Transaction"
Hover:      Red-50 background + darker text
After:      Refresh transaction list
```

---

## Data Flow Diagram

```
USER INPUT (Lead Conversion)
│
├─ Account ID          → transactions.account_id
├─ Amount              → transactions.amount
├─ Payment Date        → transactions.transaction_date (or payment_date)
├─ Source              → transactions.source
├─ Payment Method      → transactions.payment_method
└─ Term                → transactions.term
   │
   ↓
DATABASE
   │
   ↓
BACKEND API (GET /api/transactions)
   │
   ├─ JOIN accounts ON transaction.account_id
   ├─ JOIN contacts ON account.contact_id
   └─ GENERATE transaction_id = account_name + " - " + formatted_term
   │
   ↓
API RESPONSE
   {
     payment_date: "2025-11-27",
     transaction_id: "manjit singh tv - 1 year",
     account_id: "uuid",
     account_name: "manjit singh tv",
     contact_id: "uuid",
     contact_name: "manjit singh",
     amount: 120.00,
     source: "website",
     payment_method: "Credit Card"
   }
   │
   ↓
FRONTEND
   │
   ├─ formatCurrency(amount)         → "$120.00"
   ├─ formatSource(source)           → "Website"
   └─ formatPaymentMethod(method)    → "Credit Card"
   │
   ↓
DISPLAY IN TABLE (8 COLUMNS)
```

---

## Example Data Samples

### Transaction 1:
```json
{
  "id": "trans-1-uuid",
  "payment_date": "2025-11-27",
  "transaction_id": "manjit singh tv - 1 year",
  "account_id": "acc-1-uuid",
  "account_name": "manjit singh tv",
  "contact_id": "con-1-uuid",
  "contact_name": "manjit singh",
  "amount": 120.00,
  "source": "website",
  "payment_method": "Credit Card",
  "status": "completed"
}
```

**Displays As:**
| Payment Date | Transaction ID | Account Name | Contact Name | Amount | Source | Pay Method | Actions |
|--------------|----------------|--------------|--------------|---------|---------|------------|---------|
| 📅 2025-11-27 | manjit singh tv - 1 year | 🔗 manjit singh tv | 🔗 manjit singh | **$120.00** | Website | 💳 Credit Card | 👁️ ✏️ 🗑️ |

### Transaction 2:
```json
{
  "id": "trans-2-uuid",
  "payment_date": "2025-11-26",
  "transaction_id": "john doe device - 3 months",
  "account_id": "acc-2-uuid",
  "account_name": "john doe device",
  "contact_id": "con-2-uuid",
  "contact_name": "john doe",
  "amount": 360.00,
  "source": "phone",
  "payment_method": "paypal",
  "status": "completed"
}
```

**Displays As:**
| Payment Date | Transaction ID | Account Name | Contact Name | Amount | Source | Pay Method | Actions |
|--------------|----------------|--------------|--------------|---------|---------|------------|---------|
| 📅 2025-11-26 | john doe device - 3 months | 🔗 john doe device | 🔗 john doe | **$360.00** | Phone | 💳 PayPal | 👁️ ✏️ 🗑️ |

---

## Responsive Behavior

### Desktop (≥1024px):
- All 8 columns visible
- Summary cards in 4-column grid
- Filters in 4-column grid
- Full table width

### Tablet (768px - 1023px):
- Horizontal scroll for table
- Summary cards in 2-column grid
- Filters in 2-column grid
- Maintain all column visibility

### Mobile (< 768px):
- Horizontal scroll for table
- Summary cards stacked (1 column)
- Filters stacked (1 column)
- Consider card view instead of table

---

## Color Palette

```
Primary Colors:
- Blue-600:   #2563eb (Links, primary actions)
- Green-600:  #16a34a (Revenue, amounts)
- Red-600:    #dc2626 (Delete, failed)
- Yellow-600: #ca8a04 (Pending, warnings)
- Purple-600: #9333ea (This month metric)
- Orange-600: #ea580c (Average transaction)

Background Colors:
- Gray-50:    #f9fafb (Table header, hover)
- Gray-100:   #f3f4f6 (Borders, subtle backgrounds)
- Blue-50:    #eff6ff (Button hover)
- Green-50:   #f0fdf4 (Success states)
- Red-50:     #fef2f2 (Danger states)

Text Colors:
- Gray-900:   #111827 (Primary text)
- Gray-700:   #374151 (Secondary text)
- Gray-600:   #4b5563 (Tertiary text)
- Gray-400:   #9ca3af (Disabled, placeholders)
```

---

## Typography

```
Headers:
- Page Title:     2xl, font-bold (text-2xl font-bold)
- Card Labels:    sm, text-gray-600 (text-sm text-gray-600)
- Card Values:    2xl, font-bold (text-2xl font-bold)

Table:
- Headers:        sm, font-semibold, gray-700 (text-sm font-semibold text-gray-700)
- Regular Text:   sm, text-gray-900 (text-sm text-gray-900)
- Links:          sm, text-blue-600 (text-sm text-blue-600)
- Amount:         sm, font-semibold, green-600 (text-sm font-semibold text-green-600)
- Date:           sm, font-mono (text-sm font-mono)
```

---

## Implementation Checklist

### ✅ Backend:
- [x] Added `source` column to transactions table
- [x] Updated GET /api/transactions with all fields
- [x] Generated `transaction_id` in SQL query
- [x] Included account_id and account_name
- [x] Included contact_id and contact_name (2-step JOIN)
- [x] Cast payment_date to DATE format
- [x] Updated validation schemas

### ✅ Frontend:
- [x] Created 8-column table structure
- [x] Implemented formatCurrency helper
- [x] Implemented formatSource helper
- [x] Implemented formatPaymentMethod helper
- [x] Added clickable links for Account and Contact
- [x] Added action buttons (View/Edit/Delete)
- [x] Created 4 summary cards
- [x] Added search functionality
- [x] Added filter dropdowns
- [x] Implemented loading state
- [x] Implemented empty state
- [x] Added hover effects

---

**Quick Reference Document**
**Created:** November 28, 2025
**Status:** ✅ Complete
**Frontend Running:** http://localhost:3001
