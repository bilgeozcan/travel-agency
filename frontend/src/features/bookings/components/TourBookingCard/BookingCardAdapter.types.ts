import type { TourBooking } from '../../types/bookings'
import type { BookingCardHandlers } from './BookingCardActions.types'

export interface BookingCardAdapterProps {
  booking: TourBooking
  userRole?: string | null
  handlers?: BookingCardHandlers
  onOpenDocuments?: () => void
  onOpenGuests?: () => void
}
