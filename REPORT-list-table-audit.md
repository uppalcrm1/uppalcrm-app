# List Table Implementation Audit Report

**Generated:** March 5, 2026  
**Scope:** Leads, Contacts, Accounts, Transactions modules  
**Purpose:** Deep audit and comparison of all list table implementations

---

## Section A: Per-Module Breakdown

---

### A1. LEADS MODULE

#### Architecture

The Leads module uses a **3-tier component hierarchy**:

```
Leads.jsx (page shell — modals & actions)
  └── LeadViews.jsx (data fetching, filters, view switching)
        ├── LeadFilters.jsx (search & filter panel)
        ├── LeadListTable.jsx (table view)
        │     ├── ColumnSelector.jsx (column manager dropdown)
        │     ├── InlineEditCell.jsx (click-to-edit cells)
        │     └── PaginationControls (internal sub-component)
        └── KanbanBoard.jsx (kanban view with drag-and-drop)
```

#### Frontend — Page & Components

| File | Lines | Purpose |
|------|-------|---------|
| [frontend/src/pages/Leads.jsx](frontend/src/pages/Leads.jsx) | 197 | Top-level page; manages modal state (create, edit, delete, convert) |
| [frontend/src/pages/LeadViews.jsx](frontend/src/pages/LeadViews.jsx) | 318 | Data fetching, pagination/filter state, view toggle, bulk/export handlers |
| [frontend/src/components/LeadListTable.jsx](frontend/src/components/LeadListTable.jsx) | 934 | Table rendering, column definitions, sorting, inline editing, row actions |
| [frontend/src/components/LeadFilters.jsx](frontend/src/components/LeadFilters.jsx) | 308 | Search input + collapsible advanced filter panel |
| [frontend/src/components/KanbanBoard.jsx](frontend/src/components/KanbanBoard.jsx) | 406 | Drag-and-drop Kanban board using @dnd-kit |
| [frontend/src/components/ColumnSelector.jsx](frontend/src/components/ColumnSelector.jsx) | 165 | Shared column visibility dropdown |
| [frontend/src/components/DynamicLeadForm.jsx](frontend/src/components/DynamicLeadForm.jsx) | 679 | Config-driven create/edit form |

**Table Rendering:** Native HTML `<table>` with Tailwind CSS — no table library. ([LeadListTable.jsx L470–L515](frontend/src/components/LeadListTable.jsx#L470-L515))

**Data Fetching:** React Query (`useQuery`) with query key `['leads', debouncedFilters, pagination, view]`. Two fetch paths: list view → `leadsAPI.getLeads(params)`, Kanban → `leadsAPI.getLeadsByStatus(params)`. `staleTime: 5min`, `cacheTime: 10min`. ([LeadViews.jsx L62–L87](frontend/src/pages/LeadViews.jsx#L62-L87))

**Pagination:** Server-side. State: `{page, limit}` defaults to `page=1, limit=20`. Page size options: 10/20/50/100. Previous/Next buttons with "Showing X to Y of Z" text. `PaginationControls` sub-component at [LeadListTable.jsx L326–L395](frontend/src/components/LeadListTable.jsx#L326-L395).

**Sorting:** Client-side, single-column toggle (asc/desc). `SortableHeader` components with `ChevronUp`/`ChevronDown` icons. Sort applied via `useMemo` on fetched data. ([LeadListTable.jsx L160–L184](frontend/src/components/LeadListTable.jsx#L160-L184))

**Searching:** Debounced server-side. `LeadFilters` has a 300ms debounce ([L18–L24](frontend/src/components/LeadFilters.jsx#L18-L24)), and `LeadViews` applies a second 300ms debounce via `useDebouncedValue` ([L48](frontend/src/pages/LeadViews.jsx#L48)). Searches: name, email, company.

**Filters:** Collapsible advanced filter panel with 8 filter types: Status (select from API), Priority (Low/Medium/High), Assigned To (user select + "Unassigned"), Source (8 hardcoded options), Date From, Date To, Min Value, Max Value. All synced to URL via `useSearchParams`. Active filter count badge. "Clear all" button. ([LeadFilters.jsx](frontend/src/components/LeadFilters.jsx))

**Column Management:** `ColumnSelector` dropdown showing "Columns (X/Y)". 13 system columns defined in `SYSTEM_COLUMN_DEFINITIONS` ([L35–L49](frontend/src/components/LeadListTable.jsx#L35-L49)). Custom field columns fetched from API and appended ([L112–L135](frontend/src/components/LeadListTable.jsx#L112-L135)). Visibility persisted to `localStorage` key `'leads_visible_columns'` ([L82–L85](frontend/src/components/LeadListTable.jsx#L82-L85)). Reset to defaults supported.

**Inline Editing:** All editable cells use `InlineEditCell` with optimistic updates and server rollback on error. Supports text, email, select, number, date, textarea, user-select. ([LeadListTable.jsx L254–L290](frontend/src/components/LeadListTable.jsx#L254-L290))

**Row Actions:** Tasks/Activities (opens modal with tabs), Convert Lead (modal), Edit (modal), Delete (confirm modal). ([LeadListTable.jsx L858–L891](frontend/src/components/LeadListTable.jsx#L858-L891))

**Bulk Actions:** Checkbox selection per row + "select all" header checkbox. Bulk Export and Bulk Delete buttons appear when rows selected. ([LeadListTable.jsx L186–L200](frontend/src/components/LeadListTable.jsx#L186-L200), [L445–L466](frontend/src/components/LeadListTable.jsx#L445-L466))

**Export:** CSV via `leadsAPI.exportLeads()`, creates Blob download. Available both as header button and bulk action. ([LeadViews.jsx L199–L214](frontend/src/pages/LeadViews.jsx#L199-L214))

**Kanban/Alternate View:** `ViewToggle` component switches between `'list'` and `'kanban'` views. KanbanBoard uses `@dnd-kit/core` + `@dnd-kit/sortable`. Columns per status with lead count, total value, and "Add" button. Drag-and-drop updates status via API. ([KanbanBoard.jsx](frontend/src/components/KanbanBoard.jsx))

**Custom/Dynamic Fields:** Fetched from `/custom-fields?entity_type=leads`. Shown as additional table columns, inline-editable. Values read from `lead.custom_fields[col.key]`. Field labels fetched dynamically for admin label customization. ([LeadListTable.jsx L96–L135](frontend/src/components/LeadListTable.jsx#L96-L135), [L789–L843](frontend/src/components/LeadListTable.jsx#L789-L843))

#### Backend — `GET /api/leads`

| Aspect | Detail |
|--------|--------|
| **Route file** | [routes/leads.js](routes/leads.js#L651-L815) — inline handler |
| **Pagination** | `page` (default 1), `limit` (default 20, max 100). SQL: `LIMIT/OFFSET` |
| **Total count** | Yes. Separate `COUNT(*)` query with same WHERE filters |
| **Sorting** | `sort` (default `created_at`), `order` (default `desc`). Valid: created_at, updated_at, first_name, last_name, company, value, status |
| **Search** | `search` param → ILIKE on: first_name, last_name, email, company |
| **Filters** | status (exact), priority (exact), assigned_to (UUID), source (exact), dateFrom/dateTo (created_at range) |
| **JOINs** | None — queries only the `leads` table |
| **RLS** | WHERE `organization_id = $1` only; `set_config` NOT called |
| **Custom fields** | `custom_fields` JSONB column selected and returned |
| **N+1 risk** | None |

---

### A2. CONTACTS MODULE

#### Architecture

Two versions exist — only the newer one is routed:

| File | Lines | Status |
|------|-------|--------|
| [frontend/src/pages/Contacts.jsx](frontend/src/pages/Contacts.jsx) | 856 | **Active** — routed at `/contacts` |
| [frontend/src/pages/ContactsPage.jsx](frontend/src/pages/ContactsPage.jsx) | 494 | **Legacy** — imported but NOT routed |

#### Frontend — Primary Page ([Contacts.jsx](frontend/src/pages/Contacts.jsx))

**Table Rendering:** Native HTML `<table>` with Tailwind CSS. Dynamic column rendering loops over `COLUMN_DEFINITIONS` array with conditional rendering via `visibleColumns[column.key]`. ([L697–L786](frontend/src/pages/Contacts.jsx#L697-L786))

**Data Fetching:** React Query (`useQuery`) with query key `['contacts', currentFilters]`. `keepPreviousData: true`, `staleTime: 30000`. ([L248–L254](frontend/src/pages/Contacts.jsx#L248-L254))

**Pagination:** Server-side. API returns `{ page, pages, limit, total, hasPrev, hasNext }`. Default `limit: 20`. Previous/Next buttons updating URL search params. "Showing X to Y of Z contacts" text. ([L791–L811](frontend/src/pages/Contacts.jsx#L791-L811))

**Sorting:** **NOT IMPLEMENTED.** Table headers are plain `<th>` text, not clickable.

**Searching:** Debounced server-side. `useDebouncedValue(searchTerm, 300)` synced to URL params. ([L96–L98](frontend/src/pages/Contacts.jsx#L96-L98), [L224–L237](frontend/src/pages/Contacts.jsx#L224-L237))

**Filters:** Expandable panel with 4 dropdown filters: Status (active, inactive, prospect, customer), Type (customer, prospect, partner, vendor), Priority (low, medium, high), Source (8 options). All stored in URL `searchParams`. Active filter count badge. "Clear all filters" button. ([L598–L670](frontend/src/pages/Contacts.jsx#L598-L670))

**Column Management:** `COLUMN_DEFINITIONS` built dynamically from `useFieldVisibility('contacts')` hook via `React.useMemo`. Special hardcoded columns: `accounts`, `transactions`, `actions`. `ColumnSelector` dropdown with checkboxes. Visibility persisted to `localStorage` key `'contacts_visible_columns'`. Reset restores defaults from field config. ([L101–L170](frontend/src/pages/Contacts.jsx#L101-L170))

**Inline Editing:** **NOT in active page** (only present in legacy `ContactsPage.jsx`).

**Row Actions:** Edit (fetches full contact then opens `ContactForm` modal), Delete (`window.confirm()` then mutation), View (clicking name navigates to `/contacts/:id`). ([L764–L785](frontend/src/pages/Contacts.jsx#L764-L785))

**Bulk Actions:** **NOT IMPLEMENTED.** No checkboxes, no select-all.

**Export:** **NOT IMPLEMENTED.** No export button.

**Kanban/Alternate View:** **NOT IMPLEMENTED.**

**Custom/Dynamic Fields:** Fully supported via `useFieldVisibility` hook + `customFieldsAPI`. Custom fields rendered dynamically with type-aware formatting. Values accessed via `contact.custom_fields[fieldName]`. ([L341–L461](frontend/src/pages/Contacts.jsx#L341-L461))

#### Backend — `GET /api/contacts`

| Aspect | Detail |
|--------|--------|
| **Route file** | [routes/contacts.js](routes/contacts.js#L220) → [models/Contact-Safe.js](models/Contact-Safe.js) |
| **Pagination** | `page` (default 1), `limit` (default 10000, max 10000!). SQL: `LIMIT/OFFSET` |
| **Total count** | Yes. `COUNT(DISTINCT c.id)` |
| **Sorting** | `sort` (default `created_at`), `order` (default `desc`). Valid: created_at, updated_at, first_name, last_name, company, status |
| **Search** | `search` → ILIKE on: first_name, last_name, name (computed), email |
| **Filters** | status (exact), source (ILIKE fuzzy). type, priority, assigned_to accepted by Joi but **silently ignored** in query |
| **JOINs** | Complex: LEFT JOIN accounts + transactions; aggregates accounts_count, transactions_count, total_revenue, customer_since, next_renewal_date. Fallback: no JOINs |
| **RLS** | WHERE `organization_id = $1` + `set_config` IS called |
| **Custom fields** | `custom_fields` JSONB returned (defaults to `{}`) |
| **N+1 risk** | OR-join performance risk: `t.contact_id = c.id OR t.account_id = a.id` can cause cartesian product |

---

### A3. ACCOUNTS MODULE

#### Architecture

Single-page implementation with modals:

| File | Lines | Purpose |
|------|-------|---------|
| [frontend/src/pages/AccountsPage.jsx](frontend/src/pages/AccountsPage.jsx) | 953 | Primary list page with stats, table, modals |
| [frontend/src/components/accounts/AccountActions.jsx](frontend/src/components/accounts/AccountActions.jsx) | 214 | Soft delete/restore with reason selection |
| [frontend/src/components/CreateAccountModal.jsx](frontend/src/components/CreateAccountModal.jsx) | 547 | Full account creation form |
| [frontend/src/components/EditAccountModal.jsx](frontend/src/components/EditAccountModal.jsx) | 431 | Account edit form (billing fields read-only) |

#### Frontend — Page ([AccountsPage.jsx](frontend/src/pages/AccountsPage.jsx))

**Table Rendering:** Native HTML `<table>` with Tailwind CSS. ([L636–L749](frontend/src/pages/AccountsPage.jsx#L636-L749))

**Data Fetching:** `useEffect` + `useCallback` calling `accountsAPI.getAccounts(params)` via Axios. **NOT React Query.** Response mapped from `response.accounts || response.subscriptions`. ([L270–L295](frontend/src/pages/AccountsPage.jsx#L270-L295))

**Pagination:** Server-side. State: `currentPage`, `pageSize` (default 50), `totalCount`, `totalPages`. Offset-based: `(page-1)*size`. Page size options: 25/50/100/200. Numbered page buttons (up to 5 shown) with Previous/Next. ([L120–L127](frontend/src/pages/AccountsPage.jsx#L120-L127), [L825–L892](frontend/src/pages/AccountsPage.jsx#L825-L892))

**Sorting:** Server-side, limited. `sortColumn` (default `created_date`) and `sortDirection` (default `desc`) sent as `orderBy`/`orderDirection` params. Only 2 clickable column headers: "Created Date" and "Next Renewal". `SortIndicator` component shows ▲/▼. ([L96–L100](frontend/src/pages/AccountsPage.jsx#L96-L100), [L660–L675](frontend/src/pages/AccountsPage.jsx#L660-L675))

**Searching:** Debounced server-side (300ms via `useDebouncedValue`). Search term sent as `params.search`. ([L28](frontend/src/pages/AccountsPage.jsx#L28), [L133](frontend/src/pages/AccountsPage.jsx#L133), [L546–L554](frontend/src/pages/AccountsPage.jsx#L546-L554))

**Filters:** Client-side status dropdown (All/Active/Expiring Soon/Expired) + "Show deleted" checkbox. Status filter applied in `useMemo` on `filteredAccounts`. ([L555–L569](frontend/src/pages/AccountsPage.jsx#L555-L569), [L249–L259](frontend/src/pages/AccountsPage.jsx#L249-L259))

**Column Management:** `ColumnSelector` popup with 10 columns defined in `COLUMN_DEFINITIONS`. Visibility stored in `localStorage` under key `'accounts_visible_columns'`. ([L33–L66](frontend/src/pages/AccountsPage.jsx#L33-L66), [L594](frontend/src/pages/AccountsPage.jsx#L594))

**Inline Editing:** `InlineEditCell` imported and `handleFieldUpdate` function exists with optimistic update + rollback — but **NOT wired** to any cells in the current table rendering. ([L197–L227](frontend/src/pages/AccountsPage.jsx#L197-L227))

**Row Actions:** Create Task (ClipboardList), Create Transaction (+), Record Payment ($), View Details (Eye), Edit (Edit2), Delete/Restore (via `AccountActions`). ([L753–L816](frontend/src/pages/AccountsPage.jsx#L753-L816))

**Bulk Actions:** **NOT IMPLEMENTED.**

**Export:** **NOT IMPLEMENTED.**

**Kanban/Alternate View:** **NOT IMPLEMENTED.**

**Custom/Dynamic Fields:** `useFieldVisibility` hook exists for accounts but is **NOT used** by AccountsPage. Columns are hardcoded in `COLUMN_DEFINITIONS`. ([L33–L44](frontend/src/pages/AccountsPage.jsx#L33-L44))

#### Backend — `GET /api/accounts`

| Aspect | Detail |
|--------|--------|
| **Route file** | [routes/accounts-simple.js](routes/accounts-simple.js#L17-L163) — inline handler |
| **Pagination** | `limit` (default 100), `offset` (default 0). Direct limit/offset, NOT page-based |
| **Total count** | Yes. Separate `COUNT(*)` via `Promise.all` |
| **Sorting** | `orderBy` (default `created_date`), `orderDirection` (default `desc`). Valid: next_renewal, created_date, account_name |
| **Search** | `search` → ILIKE on: account_name, mac_address, first_name, last_name, email, company, edition (7 columns) |
| **Filters** | status (exact), includeDeleted toggle |
| **JOINs** | LEFT JOIN contacts + products. Correlated subqueries for total_accounts_for_contact and transaction_count |
| **RLS** | WHERE `organization_id = $1` + `set_config` IS called |
| **Custom fields** | Via `a.*` select — not explicitly handled |
| **N+1 risk** | Correlated subqueries per row (within single SQL execution) |

---

### A4. TRANSACTIONS MODULE

#### Architecture

Single-page implementation with modals:

| File | Lines | Purpose |
|------|-------|---------|
| [frontend/src/pages/TransactionsPage.jsx](frontend/src/pages/TransactionsPage.jsx) | 741 | Primary list page |
| [frontend/src/components/transactions/TransactionActions.jsx](frontend/src/components/transactions/TransactionActions.jsx) | 238 | Void/restore with audit trail (not used in list) |
| [frontend/src/components/CreateTransactionModal.jsx](frontend/src/components/CreateTransactionModal.jsx) | 870 | Transaction creation form |
| [frontend/src/components/EditTransactionModal.jsx](frontend/src/components/EditTransactionModal.jsx) | 833 | Transaction edit form |
| [frontend/src/constants/transactions.js](frontend/src/constants/transactions.js) | 111 | Status/method/source constants |

#### Frontend — Page ([TransactionsPage.jsx](frontend/src/pages/TransactionsPage.jsx))

**Table Rendering:** Native HTML `<table>` with Tailwind CSS. ([L468–L475](frontend/src/pages/TransactionsPage.jsx#L468-L475))

**Data Fetching:** `useEffect` + `useCallback` calling `transactionsAPI.getTransactions()`. **NOT React Query for list** (but modals use `useMutation`). Revenue stats fetched separately via `transactionsAPI.getRevenueStats()`. ([L113–L145](frontend/src/pages/TransactionsPage.jsx#L113-L145))

**Pagination:** Server-side. State: `currentPage`, `pageSize` (default 50), `totalCount`, `totalPages`. Offset-based: `(page-1)*size`. Page size options: 25/50/100/200. Numbered page buttons (up to 5) with Previous/Next. ([L87–L91](frontend/src/pages/TransactionsPage.jsx#L87-L91), [L673–L733](frontend/src/pages/TransactionsPage.jsx#L673-L733))

**Sorting:** Client-side, single column only (Payment Date). `sortDirection` state toggles asc/desc. Sort applied on already-fetched page data. No multi-column sort. No server-side sort. ([L85](frontend/src/pages/TransactionsPage.jsx#L85), [L193–L201](frontend/src/pages/TransactionsPage.jsx#L193-L201))

**Searching:** Debounced server-side (300ms via `useDebouncedValue`). `debouncedSearch` passed as `search` param to API. ([L78](frontend/src/pages/TransactionsPage.jsx#L78), [L93](frontend/src/pages/TransactionsPage.jsx#L93))

**Filters:** Client-side dropdowns (NOT URL params): Status (Completed/Pending/Failed/Refunded), Payment Method (6 options), Source (7 hardcoded options). Filtering done client-side on current page data only. **Filters reset on page navigation.** ([L376–L418](frontend/src/pages/TransactionsPage.jsx#L376-L418), [L175–L192](frontend/src/pages/TransactionsPage.jsx#L175-L192))

**Column Management:** `ColumnSelector` with 11 columns defined in `COLUMN_DEFINITIONS`. Required columns: payment_date, transaction_id, amount, actions. Visibility persisted to `localStorage` key `'transactions_visible_columns'`. ([L33–L60](frontend/src/pages/TransactionsPage.jsx#L33-L60))

**Inline Editing:** **NOT IMPLEMENTED.**

**Row Actions:** View (Eye icon — **no-op/TODO**), Edit (opens `EditTransactionModal`), Delete (`window.confirm()` then hard delete). ([L641–L665](frontend/src/pages/TransactionsPage.jsx#L641-L665))

**Bulk Actions:** **NOT IMPLEMENTED.**

**Export:** "Export Report" button exists but has **no onClick handler** — purely decorative. ([L289–L292](frontend/src/pages/TransactionsPage.jsx#L289-L292))

**Kanban/Alternate View:** **NOT IMPLEMENTED.**

**Custom/Dynamic Fields:** `ColumnSelector` supports `isCustom` flag but `COLUMN_DEFINITIONS` has no custom fields. Modal forms dynamically load payment_method and source options from `custom_field_definitions` API. Table filter source options are hardcoded separately (mismatch risk). ([L33–L45](frontend/src/pages/TransactionsPage.jsx#L33-L45))

#### Backend — `GET /api/transactions`

| Aspect | Detail |
|--------|--------|
| **Route file** | [routes/transactions.js](routes/transactions.js#L309-L475) — inline handler |
| **Pagination** | `limit` (default 100), `offset` (default 0). Direct limit/offset |
| **Total count** | Yes. Separate `COUNT(*)` query |
| **Sorting** | **Hardcoded**: `ORDER BY t.transaction_date DESC, t.created_at DESC` — no user sorting |
| **Search** | `search` → ILIKE on: transaction_reference, account_name, first_name, last_name, email, product name |
| **Filters** | status (exact), contact_id (UUID) |
| **JOINs** | LEFT JOIN accounts + contacts + products + users |
| **Post-processing** | Loads billing term options from `default_field_configurations`, maps term values to labels, constructs synthetic `transaction_id` |
| **RLS** | WHERE `organization_id = $1` only; `set_config` NOT called |
| **Custom fields** | Not included — specific columns selected |
| **N+1 risk** | None (extra query for billing terms config is 1 total, not per-row) |

---

## Section B: Comparison Matrix

| Feature | Leads | Contacts | Accounts | Transactions |
|---------|-------|----------|----------|--------------|
| **Data fetching method** | React Query `useQuery` | React Query `useQuery` | `useEffect` + `useCallback` | `useEffect` + `useCallback` |
| **Pagination type** | Server-side (page/limit) | Server-side (page/limit) | Server-side (offset/limit) | Server-side (offset/limit) |
| **Default page size** | 20 | 20 | 50 | 50 |
| **Page size options** | 10/20/50/100 | None (fixed at 20) | 25/50/100/200 | 25/50/100/200 |
| **Sorting approach** | Client-side, multi-column clickable | **None** | Server-side, 2 columns only | Client-side, 1 column only |
| **Search implementation** | Debounced 300ms×2, server-side | Debounced 300ms, server-side | Debounced 300ms, server-side | Debounced 300ms, server-side |
| **Filter UI pattern** | Collapsible panel (8 filters), URL params | Expandable panel (4 filters), URL params | Status dropdown + deleted checkbox, **no URL params** | 3 dropdowns, **no URL params** |
| **Filter execution** | Server-side | Server-side | Mixed (search server; status client) | Client-side on current page only |
| **Column management** | ColumnSelector + localStorage | ColumnSelector + localStorage + field config API | ColumnSelector + localStorage | ColumnSelector + localStorage |
| **Column definitions source** | Hardcoded system + API custom fields | Dynamic from `useFieldVisibility` hook | Hardcoded only | Hardcoded only |
| **Inline editing** | Yes (`InlineEditCell`) | No (only in legacy page) | Imported but NOT wired | No |
| **Bulk actions** | Yes (select, bulk delete, bulk export) | No | No | No |
| **Row actions** | Edit, Delete, Convert, Tasks/Activities | Edit, Delete, View (navigate) | Create Task, Create Tx, Record Payment, View, Edit, Delete/Restore | View (no-op), Edit, Delete |
| **Export** | Yes (CSV, both single + bulk) | No | No | Button exists, no handler |
| **Kanban/Alternate view** | Yes (@dnd-kit) | No | No | No |
| **Dynamic fields in table** | Yes (fetched + displayed + inline editable) | Yes (via useFieldVisibility) | No (hook exists but unused) | No |
| **Shared components used** | ColumnSelector, InlineEditCell, ViewToggle, DeleteConfirmModal | ColumnSelector, useFieldVisibility | ColumnSelector (InlineEditCell imported but unused) | ColumnSelector |
| **Backend pagination style** | page/limit (default 20, max 100) | page/limit (default 10000!) | limit/offset (default 100) | limit/offset (default 100) |
| **Backend sorting** | 7 sort columns, user-configurable | 6 sort columns, user-configurable | 3 sort options | Hardcoded, no user sorting |
| **Backend search columns** | 4 (name, email, company) | 3–4 (name, email) | 7 (name, mac, contact, company, edition) | 6 (ref, account, contact, product) |
| **Backend JOINs** | None | LEFT JOIN accounts + transactions (complex) | LEFT JOIN contacts + products + subqueries | LEFT JOIN accounts + contacts + products + users |
| **Backend RLS set_config** | No | Yes | Yes | No |
| **Backend custom_fields** | Yes | Yes | Via `a.*` (implicit) | No |
| **Delete mechanism** | Hard delete | Hard delete (`window.confirm`) | Soft delete with reason | Hard delete (`window.confirm`) |
| **Form library** | Custom `DynamicLeadForm` (manual state) | `react-hook-form` (ContactForm) | Manual state (CreateAccountModal) | Manual state |

---

## Section C: Inconsistencies Found

### C1. Data Fetching Pattern Mismatch
- **Leads & Contacts** use React Query (`useQuery`) for data fetching with automatic cache management, `staleTime`, `keepPreviousData`, and `invalidateQueries`.
- **Accounts & Transactions** use raw `useEffect` + `useCallback` + `useState` with manual loading/error states and manual re-fetch triggers.
- This means Accounts and Transactions don't benefit from query deduplication, background refetch, or cache invalidation patterns.

### C2. Pagination Parameter Inconsistency
- **Leads & Contacts** backend uses `page`/`limit` parameters (page-based).
- **Accounts & Transactions** backend uses `limit`/`offset` parameters (offset-based).
- Frontend handles this by computing offset from page, but the API contracts differ.

### C3. Default Page Size Varies Wildly
- **Leads**: default 20, max 100
- **Contacts**: backend default 10,000 (effectively fetches all), frontend default 20
- **Accounts**: default 50 (frontend), 100 (backend)
- **Transactions**: default 50 (frontend), 100 (backend)
- The Contacts backend default of 10,000 is a performance hazard for orgs with thousands of contacts.

### C4. Sorting is Completely Inconsistent
- **Leads**: Client-side sorting on any clickable column header (but backend supports server-side sort)
- **Contacts**: No sorting at all (frontend headers aren't clickable, though backend supports it)
- **Accounts**: Server-side sorting on 2 columns only
- **Transactions**: Client-side sorting on 1 column only (Payment Date), backend has hardcoded sort
- No module implements server-side multi-column sorting despite being the most scalable approach.

### C5. Filter Persistence Split
- **Leads & Contacts** persist filters in URL search params (shareable, back-button aware).
- **Accounts & Transactions** use local state only — filters reset on page navigation.

### C6. Filter Execution Location
- **Leads**: All filters sent to server (truly server-side).
- **Contacts**: Status and source sent to server; type and priority **accepted by route validator but silently ignored** in the actual SQL query.
- **Accounts**: Search is server-side, but status filter is applied client-side after fetch.
- **Transactions**: Search is server-side, but status/method/source filters are applied client-side **on the current page only** — meaning filter results are incomplete.

### C7. Column Definitions Source
- **Leads**: Hardcoded system columns + dynamically fetched custom field columns from API.
- **Contacts**: All columns dynamically generated from `useFieldVisibility('contacts')` hook.
- **Accounts**: All columns hardcoded — `useFieldVisibility` exists but is NOT used.
- **Transactions**: All columns hardcoded — no dynamic field support.

### C8. Inline Editing Support
- **Leads**: Full inline editing with `InlineEditCell`, optimistic updates, and rollback.
- **Contacts (active page)**: No inline editing (only present in the unused legacy `ContactsPage.jsx`).
- **Accounts**: `InlineEditCell` imported and handler coded, but never connected to table cells.
- **Transactions**: No inline editing at all.

### C9. Bulk Actions
- **Leads**: Full bulk support (checkboxes, select all, bulk delete, bulk export).
- **Contacts, Accounts, Transactions**: No bulk actions whatsoever.

### C10. Export Feature
- **Leads**: Fully working CSV export via `leadsAPI.exportLeads()`.
- **Contacts**: No export feature.
- **Accounts**: No export feature.
- **Transactions**: Export button exists in the UI but has no `onClick` handler (decorative).

### C11. Kanban/Alternate Views
- **Leads**: Has a Kanban board view with drag-and-drop status updates.
- **Contacts, Accounts, Transactions**: List view only.

### C12. Delete Mechanism
- **Leads**: Hard delete via `DeleteConfirmModal` (shared component with title/message).
- **Contacts**: Hard delete via `window.confirm()` (browser native dialog).
- **Accounts**: Soft delete with reason selection (9 predefined reasons), restore capability.
- **Transactions**: Hard delete via `window.confirm()` on list page, but separate `TransactionActions` component supports void/restore with audit trail (not used on list page).

### C13. Form Libraries
- **Leads**: Custom `DynamicLeadForm` with manual `useState` for form state and validation.
- **Contacts**: `ContactForm` uses `react-hook-form` for state management and validation.
- **Accounts**: `CreateAccountModal` uses manual `useState`.
- **Transactions**: `CreateTransactionModal` and `EditTransactionModal` use manual `useState`.

### C14. Backend RLS Inconsistency
- **Contacts & Accounts**: Pass `organizationId` as 3rd argument to `db.query()`, triggering `set_config('app.current_organization_id', ...)` for PostgreSQL RLS.
- **Leads & Transactions**: Do NOT pass 3rd argument — rely only on WHERE clause filtering. If RLS policies exist, they may not function correctly.

### C15. Search Double-Debounce in Leads
- **Leads**: Search is debounced twice — once in `LeadFilters.jsx` (300ms) and again via `useDebouncedValue` in `LeadViews.jsx` (300ms), resulting in up to 600ms total delay.
- **All others**: Single 300ms debounce.

### C16. Legacy Page Dead Code
- **Contacts**: `ContactsPage.jsx` (494 lines) is imported in App.jsx but NOT assigned to any route — dead code with divergent implementation (client-side search, no pagination, inline editing that the active page lacks).

### C17. Stats Cards Inconsistency
- **Leads**: Stats fetched via `leadsAPI.getStats()` with React Query.
- **Contacts**: Stats via `ContactStats.jsx` component with React Query.
- **Accounts**: Stats fetched via separate `useEffect` + `accountsAPI.getStats()`.
- **Transactions**: Revenue stats via separate `useEffect` + `transactionsAPI.getRevenueStats()`.

### C18. Filter Source Options Hardcoded vs Dynamic
- **Transactions**: Filter dropdown source options are hardcoded (Website, Phone, Email, etc.), but modal forms dynamically load source options from the `custom_field_definitions` API. These can diverge if admin customizes options.

### C19. Detail Page Navigation Pattern
- **Leads**: Name column is a clickable link to `/leads/:id`.
- **Contacts**: Name column is a clickable link to `/contacts/:id`.
- **Accounts**: Separate "View Details" (Eye) icon button navigates to `/accounts/:id`.
- **Transactions**: "View" icon button is a no-op (TODO).

### C20. Page Component Line Count Disparity
- **Leads**: Split across 4 components totaling ~1,757 lines (well-separated concerns).
- **Contacts**: Single 856-line page component (all-in-one).
- **Accounts**: Single 953-line page component (all-in-one).
- **Transactions**: Single 741-line page component (all-in-one).

---

## Section D: Recommendations

### D1. Standardize Data Fetching on React Query

**Best current example: Leads (LeadViews.jsx)**

All 4 modules should use React Query (`@tanstack/react-query`) with `useQuery` for list fetching. Benefits:
- Automatic caching, deduplication, and background refetch
- `keepPreviousData: true` for smooth pagination transitions
- Cache invalidation via `queryClient.invalidateQueries()` on mutations
- Consistent loading/error states
- Recommend `staleTime: 30000` (30s) and `cacheTime: 300000` (5min) as defaults

**Migration effort:** Accounts and Transactions need conversion from `useEffect` to `useQuery`.

### D2. Standardize Server-Side Pagination

**Best current example: Leads backend (page/limit with max)**

All backend endpoints should use:
- `page` (default 1) and `limit` (default 25, max 100) parameters
- Return `{ data: [...], pagination: { page, limit, total, totalPages, hasNext, hasPrev } }`
- Fix Contacts backend default of 10,000 — this defeats the purpose of pagination

### D3. Implement Server-Side Sorting Everywhere

**Best current example: Leads backend (7 sortable columns)**

All backend endpoints should accept `sort` and `order` query params with validated column lists. Frontend should send sort params to API instead of sorting client-side on the current page (which gives incorrect results with pagination).

### D4. Make All Filters Server-Side and URL-Persisted

**Best current example: Leads (LeadFilters.jsx + URL sync)**

- All filters should be sent as query params to the backend
- All filter state should be synced to URL search params (shareable, back-button aware)
- Fix Contacts: `type`, `priority`, `assigned_to` filters are accepted by the route but silently ignored
- Fix Accounts: Move status filter to server-side
- Fix Transactions: Move all 3 filters to server-side (currently filters only the current page)

### D5. Standardize Column Management

**Best current example: Contacts (useFieldVisibility + ColumnSelector)**

Recommended approach for all modules:
1. System columns defined in a constant array
2. Custom field columns fetched dynamically from `customFieldsAPI.getFields(entityType)`
3. `useFieldVisibility` hook to determine which fields are visible
4. `ColumnSelector` component (already shared) for user toggle
5. Visibility persisted to `localStorage` with consistent key naming

**Migration effort:** Accounts and Transactions need `useFieldVisibility` integration.

### D6. Build a Shared `<DataTable>` Component

Given that all 4 modules render nearly identical `<table>` structures with Tailwind, a shared component would eliminate ~2,500+ lines of duplicated code.

**Recommended API:**

```jsx
<DataTable
  // Data
  data={items}
  loading={isLoading}
  error={error}
  emptyMessage="No records found"
  
  // Columns
  columns={columnDefinitions}           // [{key, label, type, required, isCustom, sortable, render}]
  visibleColumns={visibleColumns}       // {key: boolean}
  onColumnToggle={handleColumnToggle}
  onColumnsReset={handleColumnsReset}
  
  // Sorting
  sortColumn={sortColumn}
  sortDirection={sortDirection}
  onSort={handleSort}                   // (columnKey) => void
  
  // Pagination
  pagination={pagination}              // {page, limit, total, totalPages, hasNext, hasPrev}
  onPageChange={handlePageChange}
  onPageSizeChange={handlePageSizeChange}
  pageSizeOptions={[10, 25, 50, 100]}
  
  // Selection & Bulk Actions
  selectable={true}
  selectedIds={selectedIds}
  onSelectionChange={setSelectedIds}
  bulkActions={[
    { label: 'Delete', icon: Trash2, onClick: handleBulkDelete, variant: 'danger' },
    { label: 'Export', icon: Download, onClick: handleBulkExport },
  ]}
  
  // Row Actions
  rowActions={(row) => [
    { label: 'Edit', icon: Edit, onClick: () => handleEdit(row) },
    { label: 'Delete', icon: Trash2, onClick: () => handleDelete(row), variant: 'danger' },
  ]}
  
  // Inline Editing
  inlineEditable={true}
  onInlineEdit={handleFieldUpdate}     // (recordId, fieldName, value, isCustom) => Promise
  
  // Search & Filters (rendered externally, but DataTable provides toolbar slot)
  toolbarLeft={<SearchInput />}
  toolbarRight={<FilterPanel />}
  
  // Export
  onExport={handleExport}
/>
```

**Phase 1:** Extract `LeadListTable.jsx` into a generic `DataTable` component (it's the most feature-complete).  
**Phase 2:** Migrate Contacts, Accounts, Transactions to use `<DataTable>`.  
**Phase 3:** Add missing features (inline editing to Contacts, bulk actions to all, export to all).

### D7. Normalize Delete Patterns

Recommend standardizing on:
- **Soft delete** with reason for Accounts and Transactions (financial records should never be hard-deleted)
- **Hard delete** with `DeleteConfirmModal` (not `window.confirm()`) for Leads and Contacts
- Replace all `window.confirm()` calls with the existing `DeleteConfirmModal` shared component

### D8. Fix Backend RLS Consistency

All backend list routes should consistently pass `organizationId` as the 3rd argument to `db.query()` to activate PostgreSQL RLS policies. Currently Leads and Transactions skip this.

### D9. Clean Up Dead Code

- Remove or deprecate [frontend/src/pages/ContactsPage.jsx](frontend/src/pages/ContactsPage.jsx) (494 lines of unused code)
- Remove deprecated empty arrays (`TRANSACTION_SOURCES`, `BILLING_TERMS`) from [frontend/src/constants/transactions.js](frontend/src/constants/transactions.js)
- Implement or remove the Transactions "Export Report" button
- Implement or remove the Transactions "View" row action

### D10. Standardize Form Libraries

Pick one approach for all create/edit forms:
- **Recommended:** `react-hook-form` (already used in ContactForm) — provides clean validation, field registration, and form state management
- Migrate DynamicLeadForm, CreateAccountModal, CreateTransactionModal, and EditTransactionModal to `react-hook-form`

### D11. Priority Roadmap

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Fix Contacts backend default limit (10000 → 25) | 1 line | High (performance) |
| **P0** | Fix Transactions client-side-only filtering (filters miss data on other pages) | Medium | High (correctness) |
| **P0** | Fix backend RLS consistency (Leads, Transactions) | Small | High (security) |
| **P1** | Convert Accounts & Transactions to React Query | Medium | Medium (reliability) |
| **P1** | Move all filters to server-side + URL params | Medium | Medium (UX) |
| **P1** | Add sorting to Contacts frontend | Small | Medium (UX) |
| **P2** | Build shared `<DataTable>` component | Large | High (maintainability) |
| **P2** | Add inline editing to Contacts & Transactions | Medium | Medium (UX) |
| **P2** | Add bulk actions to Contacts, Accounts, Transactions | Medium | Medium (UX) |
| **P2** | Add export to Contacts, Accounts, Transactions | Medium | Medium (UX) |
| **P3** | Standardize on react-hook-form for all forms | Large | Medium (consistency) |
| **P3** | Remove dead code (ContactsPage.jsx, no-op handlers) | Small | Low (cleanliness) |
| **P3** | Consider Kanban views for other modules | Medium | Low (feature parity) |

---

## Appendix: Files Referenced

### Frontend Pages
| File | Lines |
|------|-------|
| [frontend/src/pages/Leads.jsx](frontend/src/pages/Leads.jsx) | 197 |
| [frontend/src/pages/LeadViews.jsx](frontend/src/pages/LeadViews.jsx) | 318 |
| [frontend/src/pages/Contacts.jsx](frontend/src/pages/Contacts.jsx) | 856 |
| [frontend/src/pages/ContactsPage.jsx](frontend/src/pages/ContactsPage.jsx) | 494 (legacy, unused) |
| [frontend/src/pages/AccountsPage.jsx](frontend/src/pages/AccountsPage.jsx) | 953 |
| [frontend/src/pages/TransactionsPage.jsx](frontend/src/pages/TransactionsPage.jsx) | 741 |

### Frontend Components
| File | Lines |
|------|-------|
| [frontend/src/components/LeadListTable.jsx](frontend/src/components/LeadListTable.jsx) | 934 |
| [frontend/src/components/LeadFilters.jsx](frontend/src/components/LeadFilters.jsx) | 308 |
| [frontend/src/components/KanbanBoard.jsx](frontend/src/components/KanbanBoard.jsx) | 406 |
| [frontend/src/components/ColumnSelector.jsx](frontend/src/components/ColumnSelector.jsx) | 165 |
| [frontend/src/components/InlineEditCell.jsx](frontend/src/components/InlineEditCell.jsx) | 439 |
| [frontend/src/components/ViewToggle.jsx](frontend/src/components/ViewToggle.jsx) | 50 |
| [frontend/src/components/DeleteConfirmModal.jsx](frontend/src/components/DeleteConfirmModal.jsx) | 85 |
| [frontend/src/components/DynamicLeadForm.jsx](frontend/src/components/DynamicLeadForm.jsx) | 679 |
| [frontend/src/components/ContactForm.jsx](frontend/src/components/ContactForm.jsx) | 269 |
| [frontend/src/components/CreateAccountModal.jsx](frontend/src/components/CreateAccountModal.jsx) | 547 |
| [frontend/src/components/EditAccountModal.jsx](frontend/src/components/EditAccountModal.jsx) | 431 |
| [frontend/src/components/CreateTransactionModal.jsx](frontend/src/components/CreateTransactionModal.jsx) | 870 |
| [frontend/src/components/EditTransactionModal.jsx](frontend/src/components/EditTransactionModal.jsx) | 833 |
| [frontend/src/components/accounts/AccountActions.jsx](frontend/src/components/accounts/AccountActions.jsx) | 214 |
| [frontend/src/components/transactions/TransactionActions.jsx](frontend/src/components/transactions/TransactionActions.jsx) | 238 |

### Frontend Hooks
| File | Lines |
|------|-------|
| [frontend/src/hooks/useDebouncedValue.js](frontend/src/hooks/useDebouncedValue.js) | 32 |
| [frontend/src/hooks/useFieldVisibility.js](frontend/src/hooks/useFieldVisibility.js) | 168 |
| [frontend/src/hooks/useTwilioConfig.js](frontend/src/hooks/useTwilioConfig.js) | 27 |

### Frontend Services & Constants
| File | Key Sections |
|------|-------------|
| [frontend/src/services/api.js](frontend/src/services/api.js) | leadsAPI (~L262–L450), contactsAPI (~L452–L600), accountsAPI (~L610–L680), transactionsAPI (~L682–L740), customFieldsAPI (~L832–L870) |
| [frontend/src/constants/transactions.js](frontend/src/constants/transactions.js) | PAYMENT_METHODS, TRANSACTION_STATUSES, formatters |

### Backend Routes
| File | Key Endpoint |
|------|-------------|
| [routes/leads.js](routes/leads.js#L651-L815) | GET /api/leads |
| [routes/contacts.js](routes/contacts.js#L220) | GET /api/contacts → Contact-Safe.js |
| [routes/accounts-simple.js](routes/accounts-simple.js#L17-L163) | GET /api/accounts |
| [routes/transactions.js](routes/transactions.js#L309-L475) | GET /api/transactions |

### Backend Models
| File | Purpose |
|------|---------|
| [models/Contact-Safe.js](models/Contact-Safe.js) | Contact query logic with complex/simple fallback |

### Server Entry
| File | Mount Points |
|------|-------------|
| [server.js](server.js#L348-L357) | Route mounting for all 4 modules |
