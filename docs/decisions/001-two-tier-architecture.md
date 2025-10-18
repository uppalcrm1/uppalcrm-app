# ADR 001: Two-Tier Architecture Separation

## Status
**Accepted** - October 18, 2025

## Context
The Uppal CRM system serves two distinct purposes:
1. Managing the CRM platform as a SaaS business (super admin)
2. Providing CRM functionality to subscribing organizations (multi-tenant)

Initial development mixed these concerns, leading to:
- Security vulnerability: Organizations could access platform billing via `/licenses`
- Confusion: "Accounts" meant different things in different contexts
- Unclear routing structure

## Decision
We will maintain strict separation between super admin and organization features:

### Super Admin Platform
- Routes: `/super-admin/*`
- Layout: `SuperAdminLayout.jsx`
- Purpose: Manage the CRM business
- Files: `pages/` (with SuperAdmin prefix)

### Organization CRM
- Routes: `/*` (root)
- Layout: `DashboardLayout.jsx`
- Purpose: Manage customer data
- Files: `pages/` (root level)

### Disambiguation
- **Platform Accounts**: Organizations subscribing to Uppal CRM
  - Route: `/super-admin/accounts`
  - Component: `AccountManagement.jsx`
  - Shows: $15/user/month billing

- **Customer Accounts**: Software licenses sold to end customers
  - Route: `/accounts`
  - Component: `AccountsPage.jsx`
  - Shows: Gold/Smart/Jio editions, devices, MAC addresses

## Consequences

### Positive
- Clear separation of concerns
- Security: Platform billing protected
- Easier to reason about features
- Scalable architecture
- Clear file organization

### Negative
- Need to specify "platform" vs "customer" explicitly
- Two navigation systems to maintain
- Potential confusion with "Accounts" terminology

### Mitigation
- Comprehensive documentation (this file + ARCHITECTURE.md)
- Quick reference guide
- Code review checklist
- Naming conventions enforced

## Implementation
- Moved `/licenses` → `/super-admin/accounts`
- Added "Accounts" to super admin navigation
- Created `AccountsPage.jsx` for customer licenses
- Verified access control
- Documented thoroughly

## Alternatives Considered

### Alternative 1: Single Unified System
- Pros: Simpler navigation
- Cons: Security risks, mixed concerns, harder to scale
- **Rejected**: Security and clarity are paramount

### Alternative 2: Completely Separate Applications
- Pros: Complete isolation
- Cons: Code duplication, higher costs, more complex deployment
- **Rejected**: Over-engineering for current scale

### Alternative 3: Role-Based Navigation Only
- Pros: Single codebase, dynamic menus
- Cons: Complex permission logic, security risks
- **Rejected**: Route-based separation is clearer

## Related Decisions
- None (first major architectural decision recorded)

## References
- `docs/ARCHITECTURE.md` - Complete architecture documentation
- `docs/QUICK-REFERENCE.md` - Quick decision guide
- Commit `9d176e1` - Security fix implementation

## Notes
This decision should be referenced whenever:
- Adding new features (determine which tier)
- Discussing "accounts" (qualify which type)
- Modifying routing structure
- Onboarding new developers

---

**For questions, always refer to ARCHITECTURE.md first.**
