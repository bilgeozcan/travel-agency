# ADR-007: Booking Start-Date State Transition — Pending Product Decision

- **Status:** Pending product-owner decision
- **Date:** August 21, 2026
- **Scope:** Tour booking lifecycle

## Context

The booking lifecycle currently supports these status transitions:

```text
BOOKED / CONFIRMED -> STARTED -> FINISHED
```

The scheduled booking-status updater changes both `BOOKED` and `CONFIRMED`
bookings to `STARTED` when the tour start date is reached.

This leaves an unresolved product rule: a booking can begin even if the Travel
Agent has not completed the document-check and confirmation step.

## Problem

The product requirements state that a Travel Agent checks customer documents
and confirms the booking. They do not explicitly define the outcome when the
tour start date is reached while the booking is still `BOOKED`.

Without a decision, customers and Travel Agents may see a trip as `STARTED`
even though it was never confirmed.

## Options

### Option A — Start both booked and confirmed bookings

```text
BOOKED -> STARTED
CONFIRMED -> STARTED
```

- This is the current behavior.
- It is operationally simple.
- It permits an unconfirmed booking to start.

### Option B — Start only confirmed bookings

```text
CONFIRMED -> STARTED
BOOKED -> CANCELED
```

- Best matches a mandatory document-review and confirmation workflow.
- Requires a product decision for refunds, penalties, and customer
  communication when a booking is canceled because it was not confirmed.

### Option C — Start only confirmed bookings; retain booked bookings for review

```text
CONFIRMED -> STARTED
BOOKED -> BOOKED
```

- Avoids automatic cancellation.
- Requires an operational/manual-review process for overdue booked bookings.

## Recommendation

Choose **Option B** if Travel Agent confirmation is mandatory before travel.
Otherwise, explicitly accept Option A as the product rule.

## Deferred work

No implementation change is being made until the Product Owner selects an
option. Once selected, update:

1. The scheduled booking-status updater.
2. Lifecycle tests.
3. Customer and Travel Agent status labels/toasts, if required.
4. The booking lifecycle documentation and acceptance criteria.
