import type { TourBooking } from '../../types/bookings'

export interface BookingDocumentItem {
  id: string
  name: string
  url?: string
  fileFormat?: string
}

export interface DocumentsPopupModalProps {
  isOpen: boolean
  booking: TourBooking | null
  documents?: BookingDocumentItem[]
  onClose: () => void
}
