import type { TourBooking } from '../../types/bookings'

export interface PendingEditsModalProps {
  isOpen: boolean
  booking: TourBooking | null
  isLoading?: boolean
  onClose: () => void
  onConfirmEdit: (bookingId: string) => Promise<void> | void
  onDeclineEdit: (bookingId: string) => Promise<void> | void
}
