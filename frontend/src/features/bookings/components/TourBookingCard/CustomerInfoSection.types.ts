import type { GuestInfo } from '../../types/bookings'

export interface CustomerInfoSectionProps {
  firstCustomer?: GuestInfo | null
  customerEmail?: string
  totalGuestsCount: number
  documentsCount: number
  onOpenDocuments?: () => void
  onOpenGuests?: () => void
}
