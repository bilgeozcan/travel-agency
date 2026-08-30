import { useState } from 'react'
import type { TourBooking } from '../../types/bookings'
import type { BookingDocumentItem } from './CheckConfirmModal.types'
import { formatBookingConfirmationDate } from '../../utils/bookingConfirmationFormatter'

export interface UseCheckConfirmModalParams {
  booking: TourBooking | null
  documents?: BookingDocumentItem[]
  onConfirm: (bookingId: string) => Promise<void>
}

export function useCheckConfirmModal({
  booking,
  documents = [],
  onConfirm,
}: UseCheckConfirmModalParams) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const firstGuest = booking?.guests?.[0]
  const customerName = firstGuest
    ? `${firstGuest.firstName} ${firstGuest.lastName}`.trim()
    : 'Customer'

  const customerEmail = booking?.customerEmail || firstGuest?.email || 'N/A'

  const adults = booking?.adultsCount ?? 1
  const children = booking?.childrenCount ?? 0
  const totalGuests = booking?.guestsCount ?? adults + children

  const guestSummary = `${totalGuests} Guest${totalGuests !== 1 ? 's' : ''} (${adults} Adult${adults !== 1 ? 's' : ''}, ${children} Child${children !== 1 ? 'ren' : ''})`

  const formattedStartDate = booking?.startDate ? formatBookingConfirmationDate(booking.startDate) : ''

  const documentList: BookingDocumentItem[] = documents

  const handleConfirm = async () => {
    if (!booking || isSubmitting) return
    try {
      setIsSubmitting(true)
      await onConfirm(booking.id)
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    customerName,
    customerEmail,
    guestSummary,
    formattedStartDate,
    documentList,
    isSubmitting,
    handleConfirm,
  }
}
