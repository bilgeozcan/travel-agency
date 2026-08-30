import type { GuestInfo } from '../types/bookings'

export interface UseCustomerInfoSectionProps {
  firstCustomer?: GuestInfo | null
  customerEmail?: string
  totalGuestsCount: number
  documentsCount: number
}

export function useCustomerInfoSection({
  firstCustomer,
  customerEmail,
  totalGuestsCount,
  documentsCount,
}: UseCustomerInfoSectionProps) {
  const customerName = firstCustomer
    ? `${firstCustomer.firstName} ${firstCustomer.lastName}`.trim()
    : 'Customer'

  const displayEmail = firstCustomer?.email || customerEmail || ''

  const guestSummaryText = `${customerName} (${
    totalGuestsCount > 0 ? `${totalGuestsCount} guest${totalGuestsCount > 1 ? 's' : ''}` : '1 guest'
  })`

  const docsText =
    documentsCount > 0
      ? `Documents uploaded: ${documentsCount} item${documentsCount > 1 ? 's' : ''}`
      : 'No documents uploaded'

  return {
    customerName,
    displayEmail,
    guestSummaryText,
    docsText,
  }
}
