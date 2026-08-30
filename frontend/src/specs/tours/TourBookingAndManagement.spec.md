# Feature Specification: Tour Booking & My Tours Management (`EPMTPETA-9967`)

> **Parent Jira Story**: [EPMTPETA-9967] Customers can book Tours, including selecting preferred travel dates, destinations, and accommodations  
> **Target Scope**: Customer Tour Booking, Booking Creation Modal, Confirmation Popup, My Tours Dashboard Page, Booking Edition, and Booking Cancellation  
> **Location**: `frontend/src/specs/tours/TourBookingAndManagement.spec.md`

---

## 1. Overview & Architecture

This specification covers the complete user lifecycle for Customer Tour Bookings in the Travel Agency frontend application:
1. **Tour Booking Creation (`US_6.1.1` & `US_6.1.2`)**: Unauthenticated auth-guard popup (`AuthRequiredPopup`), dynamic guest info inputs per tourist count, live recalculations, overbooking prevention, backend API submission (`POST /bookings`), and success confirmation modal with Travel Agent info.
2. **My Tours Dashboard Page (`US_6.1.2`)**: Tabbed status filtering (`All`, `Booked`, `Confirmed`, `Started`, `Finished`, `Canceled`), customer booking cards, assigned Travel Agent contact info, status-dependent action buttons, and empty state notification.
3. **Tour Booking Edition (`US_6.2`)**: Modifying active bookings (`Booked` / `Confirmed` status only) via edit modal with attendee names, tourist count adjustment (within max capacity limits), meal plan selection, live price recalculation, and backend update (`PUT /bookings/{id}`).
4. **Tour Booking Cancellation (`US_6.3`)**: Triggered cancellation modal calculating 10-day policy (Free cancellation >10 days vs Non-refundable ≤10 days), modal controls ("Cancel the booking", "Keep the booking", "X"), backend cancellation (`DELETE /bookings/{id}`), and UI status transition to `Canceled`.

---

## 2. Role-Based Access Control (RBAC) & Scope Matrix

| Role | Access Level & Permissions in this Feature (`EPMTPETA-9967`) |
|---|---|
| **Guest / Unauthenticated** | Can view tours & tour details. Clicking "Book the tour" triggers `AuthRequiredPopup` (asking to Sign In or Create Account). Cannot open booking form or submit bookings. |
| **Customer (Logged-in)** | **Primary actor for this story**. Can create new tour bookings, view personal bookings on `/my-tours`, edit active bookings (`Booked`/`Confirmed`), cancel active bookings (`Booked`/`Confirmed`), and view assigned Travel Agent contact details. |
| **Travel Agent (TA)** | Assigned to specific tours. TA contact details (Name, Email, Phone, Messenger) are automatically attached to bookings and displayed on Customer booking cards. (TA agent dashboard management is covered in separate TA stories). |
| **Admin** | Has full system access. Can view `/my-tours` and manage bookings. |

---

## 3. Planned Directory & Component Structure

To maintain clean modular architecture, components and services for this feature will be structured as follows:

```
frontend/src/
├── api/
│   ├── services/
│   │   ├── bookings.service.ts
│   │   └── bookings.service.test.ts
│   └── mappers/
│       └── bookings.mapper.ts
├── features/
│   └── bookings/
│       ├── components/
│       │   ├── BookingCard/
│       │   ├── BookingConfirmationModal/
│       │   ├── EditBookingModal/
│       │   └── CancelBookingModal/
│       ├── pages/
│       │   └── MyToursPage/
│       ├── types/
│       │   └── bookings.ts
│       └── utils/
│           └── bookingsValidation.ts
└── routes/
    └── paths.ts (Add MY_TOURS = '/my-tours')
```

---

## 4. Subtask Specifications & Acceptance Criteria

### Subtask 1: Auth-Guard Popup & Booking Form (`US_6.1.1`)
**Goal**: Handle unauthenticated booking attempts and render dynamic guest input sections.

- **Unauthenticated Flow**:
  - If a user clicks "Book the tour" while logged out (no active user session):
  - Do NOT open the reservation form.
  - Display modal popup (`AuthRequiredPopup`) with header/message: `'To book a tour please sign in or create an account'`.
  - Buttons: `'Sign in'` (navigates/opens login), `'Create an account'` (navigates/opens register), and `'X'` (dismiss popup).
- **Reservation Form / Modal**:
  - Accessible from Tour Details Page (`TourBookingForm`) or Tour Listing card.
  - **Dynamic Guest Inputs**: Render separate First Name and Last Name fields for each guest matching `quantity of guests` selected (e.g. 3 guests = 3 sets of First/Last Name inputs). *(Note: Frontend validates and collects per-guest names in client state; payload formatted to backend DTO structure).*
  - **Summary Display**: Destination name, Hotel Name + Star Rating, Quantity of guests, Tour Start Date, Duration (days), Total Price.
  - **Overbooking Prevention**: Client-side & server-side validation ensuring booking is blocked if `isFullyBooked` is true or capacity exceeded. Displays error message and does NOT submit if overbooked.
  - **Submission API (`POST /bookings`)**:
    - Payload shape:
      ```json
      {
        "tourId": "string",
        "date": "YYYY-MM-DD",
        "duration": "7 days",
        "mealPlan": "BB",
        "guests": { "adult": 2, "children": 1 }
      }
      ```

---

### Subtask 2: Booking Success Confirmation Modal (`US_6.1.2`)
**Goal**: Display comprehensive post-booking details and assigned Travel Agent contact info.

- **Trigger**: Appears immediately after successful `POST /bookings` API response.
- **Backend Response Structure**:
  ```json
  {
    "freeCancelation": "YYYY-MM-DD",
    "details": "You have successfully booked a tour at..."
  }
  ```
- **Modal Content**:
  - **Cancellation Policy Info**: UI text: `'Free cancellation is possible until [Formatted Date].'` (Calculated as `startDate - 10 days` or from backend `freeCancelation`).
  - **Booking Summary Text**: UI text: `'You have successfully booked a tour at [Hotel Name], starting date [Start Date] ([Duration] days), [Meal Plan] for [Guests Count] adult(s).'`.
  - **Travel Documents Notice**: Instructions to upload travel documents (passports/payment confirmations) on the 'My Tours' page and wait for assigned Travel Agent to reach out.
  - **Travel Agent (TA) Contact Data**: Travel Agent contact info automatically attached to the tour/booking context:
    - TA Full Name (First Name / Last Name)
    - Email address
    - Phone number
    - Messenger contact handle
  - **Action Button**: Button navigating to `'My Tours'` page (`/my-tours`).

---

### Subtask 3: 'My Tours' Page & Status Filtering (`US_6.1.2`)
**Goal**: Render authenticated customer's booked tours with status filters and assigned TA info.

- **Page Header & Navigation**:
  - Route: `/my-tours` (`PATHS.MY_TOURS`). Protected route for `'Customer'`, `'Travel Agent'`, `'Admin'` roles.
  - Agency Logo, Top Navigation ('All tours' / 'My tours'), User profile icon with role badge.
- **Status Filter Tabs**:
  - Options: `All`, `Booked`, `Confirmed`, `Started`, `Finished`, `Canceled`.
  - Active tab filters displayed booking cards by `status`.
- **Empty State**:
  - If user has 0 bookings (or 0 bookings in selected filter), display empty state UI text: `'You haven't booked a tour yet'`.
- **Tour Card Structure**:
  - **Status Badge**: Visual status indicator (`Booked`, `Confirmed`, `Started`, `Finished`, `Canceled`).
  - **Tour Summary**: Tour Title, Location, Hero image, Start-End Dates, Duration, Meal plan, Guest names & count, Total price, Document upload status.
  - **Assigned Travel Agent Section**: TA Name, Email, Phone, Messenger link.
  - **Action Buttons by Status**:
    - `Booked` / `Confirmed`: Display `Edit`, `Cancel`, and `Upload documents` (if not uploaded).
    - `Started` / `Finished`: Display `Give feedback` (or `Update feedback` - stubbed for future US).
    - `Canceled`: Hide `Edit`/`Cancel`. Display cancellation meta: `Canceled by` (Customer/TA) and `Reason`.
- **System Rule**:
  - System automatically treats/displays tours with past end dates as `Finished`.

---

### Subtask 4: Edit Tour Booking Modal (`US_6.2`)
**Goal**: Enable customers to modify active bookings (`Booked` / `Confirmed` status only).

- **Visibility Rule**: "Edit" button is ONLY rendered for tours with status `Booked` or `Confirmed`. Hidden for `Started`, `Finished`, or `Canceled`.
- **Modal Fields**:
  - Editable First Name / Last Name for each attendee (stored in client state).
  - Read-only Hotel Name, Place/Destination, Star rating.
  - **Duration**: Quantity of days (End date recalculates automatically).
  - **Number of Tourists**: Stepper control; cannot exceed maximum tour capacity.
  - **Meal Plan**: Dropdown containing ONLY valid/available meal plans (`'BB' | 'HB' | 'FB' | 'AI'`) for the selected tour (unavailable options hidden).
  - **Live Price Recalculation**: Modifying any field (duration, guests, meal plan) instantly recalculates and updates total trip price in UI.
- **Submission API (`PUT /bookings/{id}`)**:
  - Payload shape:
    ```json
    {
      "duration": "7 days",
      "mealPlan": "BB",
      "guests": { "adult": 2, "children": 0 }
    }
    ```
  - On success: Display popup message UI text: `'All changes have been saved successfully'`. Refresh booking details.
  - Close control: `'X'` icon closes modal without saving changes.

---

### Subtask 5: Cancel Tour Booking Modal (`US_6.3`)
**Goal**: Allow customers to cancel active bookings with policy fee warnings based on start date.

- **Trigger**: Clicking "Cancel" button on a `Booked` or `Confirmed` tour card in 'My Tours'.
- **Policy Fee Calculation**:
  - System checks difference between current date and tour `startDate`.
  - **> 10 Days Before Start Date**: Displays notice UI text: `'Free cancellation is possible. No charges will apply.'`
  - **≤ 10 Days Before Start Date**: Displays notice UI text: `'Cancellation charges are non-refundable.'`
- **Modal Controls**:
  - Confirmation question: `'Are you sure you want to cancel your booking?'`
  - Button 1: `'Cancel the booking'` (Confirms cancellation).
  - Button 2: `'Keep the booking'` (Dismisses modal without changes).
  - Icon: `'X'` close button (Dismisses modal without changes).
- **Execution & State Update (`DELETE /bookings/{id}`)**:
  - Clicking `'Cancel the booking'` triggers backend cancellation request `DELETE /bookings/{id}`.
  - Backend response shape:
    ```json
    {
      "message": "Booking cancelled successfully",
      "refundEligible": true
    }
    ```
  - Updates tour status in UI to `Canceled`, notifies assigned Travel Agent, and refreshes 'My Tours' card view.

---

## 5. Data Interface & Mapper Definitions

### Backend Raw Schema (`BackendBookingItem`)
```typescript
export interface BackendBookingItem {
  id: string;
  userId: string;
  tourId: string;
  state: 'BOOKED' | 'CONFIRMED' | 'STARTED' | 'FINISHED' | 'CANCELED';
  name: string;
  destination: string;
  tourImageUrl: string;
  tourDetails: {
    date: string; // e.g. "2025-01-15 (7 days)"
    mealPlan: string;
    guests: string; // e.g. "2 adults, 1 children"
    totalPrice: string; // e.g. "$1500"
    documents: string;
  };
  travelAgent?: {
    name: string;
    email: string;
    phone: string;
    messenger: string;
  };
  canceledBy?: string | null;
  cancelReason?: string | null;
}
```

### Frontend Normalized Schema (`TourBooking`) & Requests
```typescript
export type BookingStatus = 'BOOKED' | 'CONFIRMED' | 'STARTED' | 'FINISHED' | 'CANCELED';
export type MealPlanCode = 'BB' | 'HB' | 'FB' | 'AI';

export interface GuestInfo {
  firstName: string;
  lastName: string;
}

export interface TravelAgentContact {
  name: string;
  email: string;
  phone: string;
  messenger: string;
}

export interface TourBooking {
  id: string;
  tourId: string;
  tourTitle: string;
  destination: string;
  hotelName: string;
  hotelRating: number;
  heroImage: string;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  durationDays: number;
  adultsCount: number;
  childrenCount: number;
  guestsCount: number;
  guests: GuestInfo[];
  mealPlan: MealPlanCode;
  totalPrice: number;
  currency: string;
  status: BookingStatus;
  freeCancellationUntilDate: string;
  documentsUploaded: boolean;
  travelAgent: TravelAgentContact;
  canceledBy?: string;
  cancellationReason?: string;
}

export interface CreateBookingRequest {
  tourId: string;
  date: string;
  duration: string;
  mealPlan: MealPlanCode;
  guests: {
    adult: number;
    children: number;
  };
}

export interface CreateBookingResponse {
  freeCancelation: string;
  details: string;
}

export interface UpdateBookingRequest {
  duration: string;
  mealPlan: MealPlanCode;
  guests: {
    adult: number;
    children: number;
  };
}

export interface CancelBookingResponse {
  message: string;
  refundEligible: boolean;
}
```

---

## 6. Definition of Done (DoD) Checklist

- [x] Spec document aligned with backend API contracts & RBAC roles in `frontend/src/specs/tours/TourBookingAndManagement.spec.md`.
- [ ] Router updated with `PATHS.MY_TOURS` and `/my-tours` protected route.
- [ ] End-to-end booking flow, unauthenticated auth popup, and confirmation modal implemented.
- [ ] 'My Tours' dashboard implemented with status tab filters, empty state, and card actions.
- [ ] Booking edition modal implemented with capacity restriction and live price recalculation.
- [ ] Booking cancellation modal implemented with 10-day policy warning notice and `DELETE /bookings/{id}` call.
- [ ] Data mapper (`bookings.mapper.ts`) converts backend DTOs to `TourBooking` cleanly.
- [ ] Styling strictly adheres to `frontend/src/index.css` CSS design tokens.
- [ ] Vitest unit/component spec tests written and passing (`npm test`).
- [ ] Production build passes cleanly with 0 TypeScript errors (`npm run build`).
