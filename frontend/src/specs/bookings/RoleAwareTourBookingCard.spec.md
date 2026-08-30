# Feature Spec: [FE] Role-aware TourBookingCard structure

## 1. Overview
Adapt `TourBookingCard` into a pure, role-agnostic layout shell that accepts `sideInfo` and `actions` React node slots. This allows seamless reuse across both Customer ("My Tours") and Travel Agent ("Bookings") views without layout duplication or static prop drilling.

## 2. Acceptance Criteria (AC)
1. **Slot Architecture**: `TourBookingCard` renders `sideInfo` slot in the card header/side area and `actions` slot in the bottom action bar.
2. **Zero Visual Regression**: Existing Customer view retains 1:1 visual fidelity (Google Font 'Nunito', exact tokens `var(--color-blue-09)`, `var(--radius-3xl)`).
3. **Role-Aware Action Sets**:
   - Customer view: Cancel and Edit buttons for `BOOKED`/`CONFIRMED` statuses.
   - Travel Agent view: Cancel, Edit, and primary **Check & Confirm** buttons for `BOOKED`/`CONFIRMED` statuses.
4. **Type Isolation**: Component props and slot interfaces are strictly isolated in `TourBookingCard.types.ts` and `BookingCardActions.types.ts`.
5. **Centralized Logic & Helpers**:
   - Pure role helpers: `isTravelAgent`, `isCustomer`, `isAdmin` in `src/utils/authUtils.ts`.
   - Status mapper: `isCanceledStatus` in `src/features/bookings/utils/bookingStatusMapper.ts`.
6. **Automated Testing**: 100% test coverage for slot rendering, role variations, and status variations in `TourBookingCard.test.tsx` and `BookingCardActions.test.tsx`.

## 3. Component Hierarchy
```
TourBookingCard (Pure Shell)
├── BookingStepper
├── Tour Header & Details (Name, Location, Dates, Guests, Price, Docs)
├── sideInfo Slot (TravelAgentInfoSection for Customer / CustomerInfo for TA)
└── actions Slot (BookingCardActions: Cancel, Edit, Check & Confirm)
```
