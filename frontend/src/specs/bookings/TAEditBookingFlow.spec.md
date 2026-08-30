# Feature Spec: [FE] TA Edit Tour Booking Flow & Pending Approval State

> **Subtask**: Subtask 4 of TABookingManagement  
> **Location**: `frontend/src/specs/bookings/TAEditBookingFlow.spec.md`  
> **Depends on**: Slot refactor (MR #1), SideInfo (MR #2), BookingCardActions (MR #4)

---

## 1. Overview
Extend `EditBookingModal` into a role-aware component supporting a Travel Agent
edit mode. TAs can edit bookings assigned to them (status `Booked` only) by
modifying date/duration, guests, and meal plan. Saving changes puts the booking
into a "pending customer approval" state, which disables the `Check & Confirm`
action and surfaces an informational tooltip. The existing Customer edit flow
must remain unchanged (zero regression).

---

## 2. Acceptance Criteria (AC)

### 2.1 Edit Button Visibility
- The `Edit` button appears in `BookingCardActions` ONLY when booking
  status is `Booked`.
- For any other status (`Confirmed`, `Started`, `Finished`, `Canceled`) the
  Edit button MUST NOT render.

### 2.2 Edit Modal — Agent Mode & Guest Editability Rule
When a TA clicks `Edit`, the modal opens containing:

**Non-editable (context):**
- Name of the hotel / tour title
- Place of the tour / destination
- Total price (read-only, but recalculated live on field changes)

**Editable & Guest Editability Rules:**
- Date, with quantity of days
- Number of guests — Adults / Children
- Meal Plan
- **Guest Personal Details Rules:**
  - **First Customer (Primary Guest - Guest 0):** **Read-only / Locked** (Düzenlenemez). Yazım hataları vb. yetkili admin veya müşteri destek talebi üzerinden yapılır.
  - **Additional Guests (Ek Misafirler - Guest 1+):** **Editable / Düzenlenebilir** (TA yeni misafir ekleyebilir, ek misafirlerin ad/soyad bilgilerini güncelleyebilir).

**Action:**
- `Save changes` primary button

### 2.3 Live Total Price
- Total price is NOT editable directly by the TA.
- Total price recalculates automatically when any editable field
  (date/duration, guests, meal plan) changes.

### 2.4 Save Result
- On successful save:
  - Success toast: `All changes have been saved successfully`
  - Modal closes
  - Booking list refreshes (query invalidation)
  - Booking enters "pending customer approval" state (`isPendingApproval: true`)
- On failure:
  - Error toast: `Failed to update booking. Please try again.`
  - Modal remains open

### 2.5 Pending Approval State
- After a successful edit, `Check & Confirm` button in `BookingCardActions` becomes **DISABLED**.
- Hovering the info icon surfaces a tooltip:
  `Waiting for changes approval from customer`
- Handled in `BookingCardActions` via `isPendingApproval` prop.

### 2.6 Zero Regression (Customer Mode)
- Existing Customer edit flow (fields, copy, behavior) remains 1:1 identical.
- Mode is controlled via a `mode: 'customer' | 'agent'` prop (default `'customer'`).

---

## 3. Component Interface

```ts
export type EditMode = 'customer' | 'agent'

export interface EditBookingModalProps {
  isOpen: boolean
  mode?: EditMode                // default 'customer'
  booking: TourBooking
  isLoading?: boolean
  onClose: () => void
  onUpdateBooking: (payload: UpdateBookingPayload) => Promise<void>
}

export interface UpdateBookingPayload {
  duration?: string
  mealPlan?: string
  guests?: {
    adult: number
    children: number
  }
  personalDetails?: {
    firstName: string
    lastName: string
    email?: string
  }[]
  isPendingApproval?: boolean
}
```
