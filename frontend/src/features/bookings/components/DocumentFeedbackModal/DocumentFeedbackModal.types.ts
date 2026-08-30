import type { TourBooking } from '../../types/bookings'

export interface DocumentFeedbackModalProps {
  isOpen: boolean
  booking: TourBooking | null
  isLoading?: boolean
  onClose: () => void
  onSubmitFeedback: (bookingId: string, comment: string) => Promise<void>
}
