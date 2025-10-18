# Quick Reference: Platform vs Organization

## 🎯 Quick Decision Tree

```
New Feature Needed
       ↓
    WHO uses it?
       ↓
  ┌────┴────┐
  │         │
Super     Org
Admin     Users
  │         │
  ↓         ↓
Platform  Customer
Feature   Feature
  │         │
  ↓         ↓
/super-   Root
admin/*   routes
  │         │
  ↓         ↓
Super     Dashboard
Admin     Layout
Layout
```

## 📋 Cheat Sheet

### "Accounts" Disambiguation

| If you mean... | Use this term | Location | Route |
|----------------|---------------|----------|-------|
| Organizations paying US | Platform Accounts | `AccountManagement.jsx` | `/super-admin/accounts` |
| Customers paying THEM | Customer Accounts | `AccountsPage.jsx` | `/accounts` |

### Route Prefixes

| Prefix | For | Example |
|--------|-----|---------|
| `/super-admin/*` | Platform management | `/super-admin/accounts` |
| `/*` (root) | Organization CRM | `/accounts` |

### Component Naming

| Feature Type | File Location | Example |
|--------------|---------------|---------|
| Super Admin | `pages/` (with SuperAdmin prefix) | `SuperAdminSignups.jsx` |
| Organization | `pages/` (root) | `AccountsPage.jsx` |

### Navigation Layouts

| User Type | Uses | File |
|-----------|------|------|
| Super Admin | SuperAdminLayout | `components/SuperAdminLayout.jsx` |
| Org Users | DashboardLayout | `components/DashboardLayout.jsx` |

## 🔍 Search & Replace Guide

When you see this in old code → Replace with this:
- "Accounts" (ambiguous) → "Platform Accounts" or "Customer Accounts"
- `/licenses` route → `/super-admin/accounts`
- `AccountManagement` in org routes → Move to super-admin routes

## ⚠️ Red Flags

If you see these, stop and review:
- [ ] Super-admin route without `/super-admin` prefix
- [ ] Organization feature accessing super-admin data
- [ ] "Accounts" used without clarification
- [ ] Missing `organization_id` in query (RLS bypass)
- [ ] New route added to wrong section

## ✅ Safety Checklist

Before committing new code:
- [ ] Is the route in the correct section?
- [ ] Does it use the correct layout component?
- [ ] Is access control properly implemented?
- [ ] Is "Accounts" properly qualified?
- [ ] Does it respect tenant isolation?
- [ ] Is it documented?

---

**When in doubt, ask: "Is this managing the PLATFORM or managing CUSTOMERS?"**
