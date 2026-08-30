# Feature Spec: [FE] TA Cancel Tour Booking Flow with Reason Dropdown

> **Subtask**: Subtask 5 of TABookingManagement  
> **Location**: `frontend/src/specs/bookings/TACancelBookingFlow.spec.md`  
> **Depends on**: Slot refactor (MR #1), SideInfo (MR #2), BookingCardActions (MR #4)

---

## 1. Overview
Extend `CancelBookingModal` into a role-aware component supporting a Travel Agent cancellation mode. TAs can cancel bookings assigned to them (status `Booked` or `Confirmed`) by selecting a mandatory cancellation reason from a dropdown. The existing Customer cancellation flow remains unchanged with zero visual regression.

---

## 2. Acceptance Criteria (AC)

### 2.1 Cancel Button Visibility
- The `Cancel` button appears in `BookingCardActions` ONLY when booking status is `Booked` or `Confirmed`.
- For any other status (`Started`, `Finished`, `Canceled`) the Cancel button MUST NOT render.

### 2.2 Cancel Modal — Agent Mode
When a TA clicks `Cancel`, the modal opens with:
- `X` icon to close the modal
- Booking details grid:
  - **Customer:** First Name / Last Name / guest summary
  - **Contact email:** Customer email
  - **Tour name:** Tour title
  - **Location:** Tour destination
  - **Start date:** Formatted start date
  - **Duration:** Duration in days
  - **Tour type:** Tour type classification
  - **Meal plan:** Meal plan label
- **Cancellation reason dropdown (required)** with options:
  - `Customer's Emergency`
  - `Hotel Emergency`
  - `Safety Concerns`
  - `Insufficient bookings`
- Buttons:
  - `Keep the booking` → closes the modal, no changes
  - `Cancel the booking` → confirms cancellation with selected reason

### 2.3 Reason Validation
- `Cancel the booking` button is **DISABLED** until a reason is selected.
- Selecting a valid reason **ENABLES** the button.

### 2.4 Cancellation Result
- On successful cancel:
  - Success toast: `Booking cancelled successfully`
  - Booking list refreshes via query invalidation
  - Modal closes
  - Booking appears under the `Canceled` tab
- On failure:
  - Error toast: `Failed to cancel booking. Please try again.`
  - Modal remains open

### 2.5 Zero Regression (Customer Mode)
- Existing Customer cancellation flow (free cancellation policy banner, body text, button variants) remains 1:1 identical.
- Mode is controlled via `mode: 'customer' | 'agent'` prop (default `'customer'`).

---

## 3. Component Hierarchy & Architecture

```
CancelBookingModal (Adapter & Shell)
├── CustomerCancelModalBody (Customer Mode: Policy Banner + Confirmation Text)
└── AgentCancelModalBody (Agent Mode: Details Grid + Reason Select Dropdown)
```
