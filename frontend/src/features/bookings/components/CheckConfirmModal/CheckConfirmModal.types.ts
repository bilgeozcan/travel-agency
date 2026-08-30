import type { TourBooking } from '../../types/bookings'

export interface BookingDocumentItem {
  id: string
  name: string
  url?: string
  fileFormat?: string
}

export interface CheckConfirmModalProps {
  isOpen: boolean
  booking: TourBooking | null
  documents?: BookingDocumentItem[]
  isLoading?: boolean
  onClose: () => void
  onConfirm: (bookingId: string) => Promise<void>
  onDoNotConfirm?: (bookingId: string) => void
}
