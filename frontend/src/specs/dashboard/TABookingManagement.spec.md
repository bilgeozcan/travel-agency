# Feature Specification: Travel Agent Dashboard & Booking Management

> **Target Scope**: Role-based Header Navigation ("Bookings" Tab for Travel Agent), Dumb Dashboard Component Registry, Auth Guards, URL Query Sync, TA Dashboard Booking List, Document Verification ('Check & Confirm'), Booking Edition, and Booking Cancellation.  
> **Location**: `frontend/src/specs/dashboard/TABookingManagement.spec.md`

---

## 1. Subtask Inventory & Progress Matrix

| Subtask ID | Title / Scope | Status | Spec Location |
|---|---|---|---|
| **Subtask 1** | `[FE] Hardening & Refactoring Dashboard Tab Architecture, Auth Guard & URL Sync` | ✅ Completed | Section 3 |
| **Subtask 2** | `[FE] TA Dashboard Booking List, Status Filters & Document Popups` | ⏳ Up Next | Section 4 |
| **Subtask 3** | `[FE] Document Verification & 'Check and Confirm' Flow` | 📋 Planned | Section 5 |
| **Subtask 4** | `[FE] TA Edit Tour Booking Flow & Pending Approval Tooltip` | 📋 Planned | Section 6 |
| **Subtask 5** | `[FE] TA Cancel Tour Booking Flow with Reason Dropdown` | 📋 Planned | Section 7 |

---

## 2. Role-Based Access Control (RBAC) & Navigation Matrix

| Role | Access Level & Permissions | Top Header Tabs Rendered | Tab Target ID |
|---|---|---|---|
| **Guest / Unauthenticated** | Public tours view only | `['All tours']` | `'main'` |
| **Customer (Logged-in)** | View & manage personal bookings on `/my-tours` | `['All tours', 'My tours']` | `'main'`, `'my-tours'` |
| **Travel Agent (Logged-in)** | Primary actor for TA Dashboard. View & manage assigned bookings | `['All tours', 'Bookings']` | `'main'`, `'bookings'` |
| **Admin** | Full system administration | `['All tours', 'Bookings']` | `'main'`, `'bookings'` |

---

## 3. Subtask 1 Specification: Hardening & Refactoring Dashboard Tab Architecture, Auth Guard & URL Sync

### Goal
Refactor and harden existing role-based navigation header ("Bookings" tab for Travel Agent vs "My tours" for Customer) and Dashboard tab switching logic to production-grade standards.

### Acceptance Criteria (AC):
1. **Header Role Navigation (`headerNavConfig.ts`)**:
   - `getHeaderTabs(isLoggedIn, userRole)` evaluates user session and role.
   - For `role === 'Travel Agent'` or `role === 'TRAVEL_AGENT'`: Navigation item label MUST be `"Bookings"` (`id: 'bookings'`).
   - For `role === 'Customer'`: Navigation item label MUST be `"My tours"` (`id: 'my-tours'`).
2. **Dumb Dashboard Container & OCP Component Registry (`dashboardTabRegistry.tsx`)**:
   - `TAB_COMPONENT_REGISTRY` maps `NavTab` IDs (`main`, `my-tours`, `bookings`, `tours`) to pure page renderers.
   - Adding new tabs requires 0 code changes to `DashboardPage.tsx` (OCP Compliance).
3. **Defense-in-Depth Auth Guard**:
   - Protected tabs (`my-tours`, `bookings`, `tours`) explicitly verify `ctx.isAuthenticated`.
   - Unauthenticated requests to protected tabs safely fall back to `AllToursPage` with `isAuthenticated: false`.
4. **Whitelist Type Guard (`isValidTab`)**:
   - Pure `isValidTab(tab: unknown): tab is NavTab` type guard validates tab string inputs.
   - Invalid tab strings (e.g. `?tab=hack-tab`) default to `'main'`, preserving Header active indicator styling (`.active-bar`).
5. **URL Search Parameter Synchronization (`useSearchParams`)**:
   - Tab state is URL-driven via `useSearchParams()` (`?tab=bookings` / `?tab=my-tours`).
   - URL is shareable, deep-linkable, persistent across F5 reloads, and synchronized with browser Back/Forward history.
6. **Automated Vitest TDD Suite**:
   - TDD unit and component tests passing with 100% green suite (388/388 tests passing, 0 build errors).
