import { isTravelAgent } from '@/utils/authUtils'
import type { TourBooking } from '../types/bookings'
import type { BookingStatus } from '../components/TourBookingCard/TourBookingCard.types'
import { formatGuestSummary } from '../utils/bookingFormatter'

export interface UseTourBookingCardProps {
  booking: TourBooking
  userRole?: string | null
}

export function useTourBookingCard({ booking, userRole }: UseTourBookingCardProps) {
  const isAgent = isTravelAgent(userRole)
  const normalizedStatus = booking.status.toLowerCase() as BookingStatus

  const guestsText = isAgent ? undefined : formatGuestSummary(booking)

  const cancellationDetails = booking.canceledBy
    ? {
        cancelledBy: booking.canceledBy,
        reason: booking.cancellationReason || '-',
      }
    : undefined

  return {
    isAgent,
    normalizedStatus,
    guestsText,
    cancellationDetails,
    dateRangeText: `${booking.startDate} (${booking.durationDays} days)`,
  }
}
