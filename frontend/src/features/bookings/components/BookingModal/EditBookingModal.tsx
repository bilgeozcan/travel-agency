import React from 'react'
import type { TourDetail } from '@/features/tours/types/tours'
import type { TourBooking, UpdateBookingRequest } from '../../types/bookings'
import { BookingModal } from './BookingModal'
import { useTourDetails } from '@/features/tours/hooks/useTourDetails'
import { isBookingActionAllowed } from '../../config/bookingActionRules'
import type { EditBookingModalProps } from './EditBookingModal.types'

export type { EditBookingModalProps }

function toEditTour(booking: TourBooking, tourDetails?: TourDetail): TourDetail {
  const duration = booking.durationDays || 1
  const totalGuests = Math.max(booking.guestsCount, booking.adultsCount + booking.childrenCount, 1)

  return {
    id: booking.tourId,
    title: booking.tourTitle,
    hotelName: booking.hotelName || booking.tourTitle,
    hotelDescription: '',
    rating: booking.hotelRating ?? 0,
    reviewsCount: 0,
    heroImages: booking.heroImage ? [booking.heroImage] : [],
    basePricePerPerson: tourDetails?.basePricePerPerson ?? booking.totalPrice / totalGuests,
    availableStartDates: tourDetails?.availableStartDates?.length
      ? tourDetails.availableStartDates
      : [booking.startDate],
    allowedDurations: tourDetails?.allowedDurations?.length
      ? tourDetails.allowedDurations
      : [duration],
    maxParticipants: 0,
    availableMealPlans: tourDetails?.availableMealPlans?.length
      ? tourDetails.availableMealPlans
      : [booking.mealPlan],
    cancellationPolicy: tourDetails?.cancellationPolicy ?? { freeCancellationUntilDays: 0, description: '' },
    accommodationDescription: '',
    guideLanguages: [],
    transferInfo: '',
    isFullyBooked: false,
    destination: booking.destination,
    mealSupplementsPerDay: tourDetails?.mealSupplementsPerDay,
    pricesByDuration: tourDetails?.pricesByDuration,
  }
}

export const EditBookingModal: React.FC<EditBookingModalProps> = ({
  isOpen,
  mode = 'customer',
  onClose,
  booking,
  onUpdateBooking,
}) => {
  const { data: tourDetails } = useTourDetails(isOpen ? booking.tourId : undefined)

  if (!isOpen) return null
  if (booking && !isBookingActionAllowed('edit', undefined, booking.status)) {
    return null
  }

  return (
    <BookingModal
      isOpen={isOpen}
      onClose={onClose}
      tour={toEditTour(booking, tourDetails)}
      mode="edit"
      roleMode={mode}
      initialSelection={{
        startDate: booking.startDate,
        duration: booking.durationDays,
        adults: booking.adultsCount,
        children: booking.childrenCount,
        mealPlan: booking.mealPlan,
      }}
      initialGuests={booking.guests}
      onSubmit={(payload, guests) => onUpdateBooking(payload as UpdateBookingRequest, guests)}
    />
  )
}
