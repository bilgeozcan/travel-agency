import React, { useEffect, useState } from 'react'
import { ModalShell } from '@/components/ui/Modal/ModalShell'
import { Button } from '@/components/ui/Button/Button'
import { BookingModalHeader } from '../BookingModal/BookingModalHeader'
import { BookingDetailsSection } from '../shared/BookingDetailsSection'
import { BookingDocumentsSection } from '../shared/BookingDocumentsSection'
import { BookingModalFooter } from '../shared/BookingModalFooter'
import type { CheckConfirmModalProps } from './CheckConfirmModal.types'
import { useCheckConfirmModal } from './useCheckConfirmModal'
import { formatMealPlanFullLabel } from '@/utils/toursValidation'
import { bookingsService } from '@/api/services/bookings.service'
import './CheckConfirmModal.css'

export type { CheckConfirmModalProps }

export const CheckConfirmModal: React.FC<CheckConfirmModalProps> = ({
  isOpen,
  booking,
  documents,
  isLoading = false,
  onClose,
  onConfirm,
  onDoNotConfirm,
}) => {
  const [fetchedDocuments, setFetchedDocuments] = useState<CheckConfirmModalProps['documents']>([])
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null)
  const {
    customerName,
    customerEmail,
    formattedStartDate,
    documentList,
    isSubmitting,
    handleConfirm,
  } = useCheckConfirmModal({
    booking,
    documents: documents ?? fetchedDocuments,
    onConfirm,
  })

  useEffect(() => {
    if (!isOpen || !booking || documents) return

    let isCurrent = true
    bookingsService
      .getBookingDocuments(booking.id)
      .then((items) => {
        if (isCurrent) setFetchedDocuments(items)
      })
      .catch(() => {
        if (isCurrent) setFetchedDocuments([])
      })
    return () => { isCurrent = false }
  }, [isOpen, booking?.id, documents])

  if (!booking) return null

  const isBusy = isLoading || isSubmitting

  const adults = booking.adultsCount ?? 1
  const children = booking.childrenCount ?? 0
  const guestBreakdownText = children > 0
    ? `${adults} adult${adults !== 1 ? 's' : ''}, ${children} child${children !== 1 ? 'ren' : ''}`
    : `${adults} adult${adults !== 1 ? 's' : ''}`

  const bookingDetailItems = [
    {
      label: 'Customer:',
      value: `${customerName} ( ${guestBreakdownText} )`,
      testId: 'check-confirm-customer-value',
    },
    {
      label: 'Contact email:',
      value: customerEmail,
      testId: 'check-confirm-email-value',
    },
    {
      label: 'Start date:',
      value: formattedStartDate || booking.startDate,
      testId: 'check-confirm-start-date-value',
    },
    {
      label: 'Duration:',
      value: `${booking.durationDays} days`,
      testId: 'check-confirm-duration-value',
    },
    {
      label: 'Meal plan:',
      value: formatMealPlanFullLabel(booking.mealPlan),
      testId: 'check-confirm-meal-plan-value',
    },
  ]

  const handleDoNotConfirmClick = () => {
    if (booking && onDoNotConfirm) {
      onDoNotConfirm(booking.id)
    }
  }

  const handleDownload = async (document: NonNullable<CheckConfirmModalProps['documents']>[number]) => {
    if (!booking || downloadingDocumentId) return
    setDownloadingDocumentId(document.id)
    try {
      const downloadUrl = await bookingsService.getDocumentDownloadUrl(booking.id, document.id)
      const link = window.document.createElement('a')
      link.href = downloadUrl
      link.download = document.name
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
    } finally {
      setDownloadingDocumentId(null)
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      title=""
      onClose={onClose}
      isLoading={isBusy}
      dataTestId="check-confirm-backdrop"
      className="check-confirm-modal-shell"
    >
      <div className="check-confirm-modal-body" data-testid="check-confirm-modal-content">
        {/* Header Bar */}
        <BookingModalHeader
          title={booking.hotelName || booking.tourTitle}
          rating={booking.hotelRating || 5.0}
          destination={booking.destination}
          onClose={onClose}
        />

        {/* Booking Details Section */}
        <BookingDetailsSection
          title="Booking details"
          items={bookingDetailItems}
          className="check-confirm-booking-details"
          dataTestId="check-confirm-booking-details"
        />

        {/* Documents Section */}
        <BookingDocumentsSection
          title="Documents"
          documents={documentList}
          className="check-confirm-documents"
          dataTestId="check-confirm-documents"
          onDownload={handleDownload}
          downloadingDocumentId={downloadingDocumentId}
        />

        {/* Shared Footer (Price row + Primary Confirm Button & Secondary Do Not Confirm Button) */}
        <BookingModalFooter
          totalPrice={booking.totalPrice}
          submitText="Confirm"
          loadingText="Confirming..."
          isSubmitting={isBusy}
          onSubmit={handleConfirm}
          submitTestId="confirm-booking-button"
          secondaryAction={
            onDoNotConfirm ? (
              <Button
                type="button"
                variant="outline"
                fullWidth={true}
                disabled={isBusy}
                onClick={handleDoNotConfirmClick}
                data-testid="do-not-confirm-button"
              >
                Do not confirm
              </Button>
            ) : undefined
          }
        />
      </div>
    </ModalShell>
  )
}
