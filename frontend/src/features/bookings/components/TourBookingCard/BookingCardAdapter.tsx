import React from 'react'
import type { BookingCardAdapterProps } from './BookingCardAdapter.types'
import { TourBookingCard } from './TourBookingCard'
import { TravelAgentInfoSection } from './TravelAgentInfoSection'
import { CustomerInfoSection } from './CustomerInfoSection'
import { BookingCardActions } from './BookingCardActions'
import { useTourBookingCard } from '../../hooks/useTourBookingCard'

export type { BookingCardAdapterProps }

/**
 * Pure/Dumb Composition Adapter for TourBookingCard.
 * Uses useTourBookingCard hook for slot calculation without data-fetching or state side-effects.
 */
export const BookingCardAdapter: React.FC<BookingCardAdapterProps> = ({
  booking,
  userRole,
  handlers = {},
  onOpenDocuments,
  onOpenGuests,
}) => {
  const { isAgent, normalizedStatus, guestsText, cancellationDetails, dateRangeText } =
    useTourBookingCard({ booking, userRole })

  const isBooked = String(normalizedStatus).toUpperCase() === 'BOOKED'

  const sideInfo = isAgent ? (
    <CustomerInfoSection
      firstCustomer={booking.guests?.[0]}
      customerEmail={booking.customerEmail}
      totalGuestsCount={booking.guestsCount}
      documentsCount={booking.documentsCount ?? 0}
      onOpenDocuments={onOpenDocuments}
      onOpenGuests={onOpenGuests}
    />
  ) : (
    <TravelAgentInfoSection travelAgent={booking.travelAgent} />
  )

  const actions = (
    <BookingCardActions
      role={userRole || 'Customer'}
      status={normalizedStatus}
      handlers={handlers}
      isPendingApproval={booking.isPendingApproval}
      hasFeedback={booking.hasFeedback}
      hasPendingEdits={Boolean(booking.pendingEdits)}
      documentsUploaded={booking.documentsUploaded}
    />
  )

  return (
    <TourBookingCard
      id={booking.id}
      status={normalizedStatus}
      tourTitle={booking.tourTitle}
      tourLocation={booking.destination}
      tourImageUrls={[booking.heroImage]}
      dateRange={dateRangeText}
      mealPlan={booking.mealPlan}
      guestsText={guestsText}
      totalPrice={booking.totalPrice}
      cancellationDetails={cancellationDetails}
      documentRejectionReason={isBooked ? booking.documentRejectionReason : null}
      sideInfo={sideInfo}
      actions={actions}
    />
  )
}
