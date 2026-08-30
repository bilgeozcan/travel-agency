# Feature Specification: Tour Details Page (`EPMTPETA-9966`)

> **Parent Jira Story**: [EPMTPETA-9966] Customer can view in detail selected Tour  
> **Target Scope**: Frontend Subtasks (`EPMTPETA-10254`, `EPMTPETA-10255`, `EPMTPETA-10257`, `EPMTPETA-10260`, `EPMTPETA-10261`, `EPMTPETA-10264`)  
> **Location**: `frontend/src/specs/tours/TourDetailsPage.spec.md`

---

## 1. Overview & Architecture

The Tour Details Page allows users to view comprehensive information about a selected travel package, customize tour parameters (dates, duration, number of tourists, meal plan), see live price recalculations, browse customer reviews with sorting, and proceed to booking.

---

## 2. Subtask Specifications & Acceptance Criteria

### Subtask 1: Layout & Information Sections (`EPMTPETA-10254`)
**Goal**: Implement the page structure, hero section, and detailed info panels.

- **Navigation Rules**:
  - Opened via clicking either the package title OR the "See details" button on any tour card in the Tour Listing page.
  - Includes a "All tours" / "Back to tours" navigation button returning the user to the tour list cleanly.
- **Display Sections**:
  - **Header / Hero**: Trip Name, Hotel Name, Rating Overview, Hero Image Gallery.
  - **Dates & Price**: Start Date, End Date, Price per person.
  - **Tour Info Card**:
    - Cancellation policy + deadline date.
    - Tour duration (days/nights).
    - Accommodation description.
    - Guide languages supported.
    - Transfer information (airport pickup, shuttle details).
    - Maximum participants allowed.

---

### Subtask 2: Reviews Section & Sorting (`EPMTPETA-10255`)
**Goal**: Render customer reviews with full rating metadata, sorting options, and empty state handling.

- **Review Card Elements**:
  - Star rating + numerical score (e.g., `4.8 / 5`).
  - Review date formatted consistently.
  - Reviewer full name & avatar picture.
  - Review text body.
- **Empty State**:
  - When a tour has 0 reviews, display the fallback empty state card with text: `"No reviews about this trip yet"`.
- **Sorting Options**:
  - Dropdown options:
    1. `Top rated first` (Descending rating)
    2. `Low rated first` (Ascending rating)
    3. `Newest first` (Descending date)
    4. `Oldest first` (Ascending date)
  - Selecting an option triggers immediate resort / re-fetch.

---

### Subtask 3: Editable Tour Options (`EPMTPETA-10260`)
**Goal**: Allow customers to adjust tour options prior to booking with client-side validation.

- **1. Start Date Selection**:
  - Datepicker component restricted to selectable future dates with availability.
  - Past dates or unavailable dates are disabled in calendar UI.
- **2. Tour Duration**:
  - Options: `7 days`, `10 days`, `12 days`.
  - Changing duration automatically updates and displays the calculated End Date (`startDate + duration`).
- **3. Number of Tourists**:
  - Stepper / Counter control (`+` / `-`).
  - Cannot exceed `maxParticipants` for the specific tour.
  - Increment button disabled when counter reaches `maxParticipants`.
- **4. Meal Plan Selection**:
  - Options dropdown: `All-inclusive`, `Breakfast`, `Full-board`, `Half-board`.
  - Only meal plans supported by the specific hotel/tour are rendered. Unavailable plans are hidden.

---

### Subtask 4: "Book the Tour" Button States (`EPMTPETA-10257`)
**Goal**: Manage booking call-to-action button states based on tour availability and user session.

- **State 1: Available (Active)**
  - Render active primary CTA button `"Book the tour"`.
  - Clicking opens the booking flow / modal.
- **State 2: Fully Booked**
  - Button is disabled (`disabled` attribute).
  - Helper text rendered underneath: `"Tour is fully booked"`.
- **State 3: Logged-out User**
  - Displays modal popup (`AuthRequiredPopup`) with UI text: `'To book a tour please sign in or create an account'`.
  - Popup contains buttons: `'Sign in'`, `'Create an account'`, and `'X'` (close button).
- **Toast Validation**:
  - Selecting an unavailable date triggers a toast error: `"Please choose sufficient date for this trip"`.

---

### Subtask 5: Live Price Recalculation (`EPMTPETA-10261`)
**Goal**: Update total price instantly upon modifying any editable tour option.

- **Trigger Conditions**: Changing Start Date, Duration, Number of Tourists, or Meal Plan.
- **Behavior & Flow**:
  - Dispatch call to `POST /tours/{id}/price` with updated options payload.
  - Display inline subtle loading spinner / skeleton overlay on the price widget during network transit.
  - On successful response: Update displayed price smoothly.
  - On error response: Keep the last valid price visible on screen and display a transient toast error.

---

### Subtask 6: Backend Endpoints Integration (`EPMTPETA-10264`)
**Goal**: Connect components to real REST API services and handle network states.

- **Endpoints Integrated**:
  - `GET /tours/{id}` -> Full tour detail payload.
  - `GET /tours/{id}/reviews?sort={sort_option}` -> Reviews payload.
  - `POST /tours/{id}/price` -> Live recalculation payload.
- **Error & Loading Handlers**:
  - Global page loading skeleton.
  - Error state if tour ID is invalid or server responds with 404/500 ("Page could not be loaded" fallback banner).
  - Isolated reviews loading & error state ("Reviews could not be loaded").

---

## 3. Data Interface Definitions

```typescript
export interface TourDetail {
  id: string;
  title: string;
  hotelName: string;
  hotelDescription: string;
  rating: number;
  reviewsCount: number;
  heroImages: string[];
  basePricePerPerson: number;
  availableStartDates: string[]; // ISO date strings
  allowedDurations: number[]; // e.g., [7, 10, 12]
  maxParticipants: number;
  availableMealPlans: ('ALL_INCLUSIVE' | 'BREAKFAST' | 'FULL_BOARD' | 'HALF_BOARD')[];
  cancellationPolicy: {
    freeCancellationUntilDays: number;
    description: string;
  };
  accommodationDescription: string;
  guideLanguages: string[];
  transferInfo: string;
  isFullyBooked: boolean;
}

export type ReviewSortOption = 'TOP_RATED' | 'LOW_RATED' | 'NEWEST' | 'OLDEST';

export interface TourReview {
  id: string;
  authorName: string;
  authorAvatar?: string;
  rating: number;
  date: string;
  comment: string;
}

export interface PriceRecalculationRequest {
  startDate: string;
  durationDays: number;
  numberOfTourists: number;
  mealPlan: string;
}

export interface PriceRecalculationResponse {
  totalPrice: number;
  currency: string;
  pricePerPerson: number;
}
```

---

## 4. Definition of Done (DoD) Checklist

- [ ] All 6 subtasks implemented per specification.
- [ ] Responsive design verified at mobile (`<768px`), tablet (`768px-1024px`), and desktop (`>1024px`).
- [ ] Styling uses CSS Variables from `frontend/src/index.css` with 0 inline styles.
- [ ] Unit & Vitest tests written and passing (`npm test`).
- [ ] TypeScript compilation and build succeeds without warnings (`npm run build`).
