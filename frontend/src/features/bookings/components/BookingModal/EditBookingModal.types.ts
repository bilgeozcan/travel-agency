import type { GuestInfo, TourBooking, UpdateBookingRequest } from '../../types/bookings'

export type EditMode = 'customer' | 'agent'

export interface EditBookingModalProps {
  isOpen: boolean
  mode?: EditMode
  onClose: () => void
  booking: TourBooking
  onUpdateBooking: (payload: UpdateBookingRequest, guests: GuestInfo[]) => Promise<void>
  isLoading?: boolean
}
