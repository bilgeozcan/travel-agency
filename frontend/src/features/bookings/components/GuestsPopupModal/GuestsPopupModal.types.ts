import type { GuestInfo, TourBooking } from '../../types/bookings'

export interface GuestsPopupModalProps {
  isOpen: boolean
  booking: TourBooking | null
  guests?: GuestInfo[]
  onClose: () => void
}
