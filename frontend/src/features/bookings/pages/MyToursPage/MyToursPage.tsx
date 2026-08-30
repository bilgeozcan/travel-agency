import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { TabBar } from '@/components/ui/TabBar/TabBar'
import { BookingCardAdapter } from '../../components/TourBookingCard/BookingCardAdapter'
import { CancelBookingModal } from '../../components/CancelBookingModal/CancelBookingModal'
import { EditBookingModal } from '../../components/BookingModal/EditBookingModal'
import { CheckConfirmModal } from '../../components/CheckConfirmModal/CheckConfirmModal'
import { FeedbackModal } from '../../components/FeedbackModal/FeedbackModal'
import { DocumentsPopupModal } from '../../components/DocumentsPopupModal/DocumentsPopupModal'
import { GuestsPopupModal } from '../../components/GuestsPopupModal/GuestsPopupModal'
import { DocumentFeedbackModal } from '../../components/DocumentFeedbackModal/DocumentFeedbackModal'
import { PendingEditsModal } from '../../components/PendingEditsModal/PendingEditsModal'
import { UploadDocumentsModal } from '../../components/UploadDocumentsModal/UploadDocumentsModal'
import { Toast } from '@/components/ui/Toast/Toast'
import { useAuth } from '@/providers/AuthContext'
import { PageLoader } from '@/components/ui/PageLoader/PageLoader'
import { useMyBookings } from '../../hooks/useMyBookings'
import { useTourDetails } from '@/features/tours/hooks/useTourDetails'
import { bookingsService } from '@/api/services/bookings.service'
import type { TourBooking } from '../../types/bookings'
import { formatGuestSummary } from '../../utils/bookingFormatter'
import { isCanceledStatus } from '../../utils/bookingStatusMapper'
import { useRoleAccess } from '@/hooks/useRoleAccess'
import type { CancellationReason } from '../../utils/bookingsValidation'
import { ApiError } from '@/api/client/apiError'
import './MyToursPage.css'

const TABS = ['All tours', 'Booked', 'Confirmed', 'Started', 'Finished', 'Canceled']

function getBookingActionErrorMessage(error: unknown, action: 'cancel' | 'update' | 'confirm' | 'documentFeedback'): string {
  if (error instanceof ApiError) {
    if (
      error.code === 'BOOKING_STATE_CONFLICT' ||
      error.code === 'BOOKING_UPDATE_CONFLICT'
    ) {
      if (action === 'confirm') {
        return 'This booking was canceled or changed before it could be confirmed. Please refresh and review its current status.'
      }

      if (action === 'cancel') {
        return 'This booking was already changed and can no longer be canceled. Please refresh and review its current status.'
      }

      return 'This booking was changed by another user. Please refresh and try again.'
    }

    return error.message
  }

  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function getEmptyBookingsMessage(isAgent: boolean, activeTab: string): string {
  if (isAgent) {
    return activeTab === 'All tours'
      ? 'No assigned bookings found.'
      : `No ${activeTab.toLowerCase()} assigned bookings found.`
  }

  return activeTab === 'All tours'
    ? "You haven't booked a tour yet"
    : `No ${activeTab.toLowerCase()} tours found.`
}

export const MyToursPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('All tours')
  const { user } = useAuth()
  const { isAgent } = useRoleAccess(user)
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<TourBooking | null>(null)
  const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<TourBooking | null>(null)
  const [selectedBookingForConfirm, setSelectedBookingForConfirm] = useState<TourBooking | null>(null)
  const [selectedBookingForFeedback, setSelectedBookingForFeedback] = useState<TourBooking | null>(null)
  const [selectedBookingForDocuments, setSelectedBookingForDocuments] = useState<TourBooking | null>(null)
  const [selectedBookingForGuests, setSelectedBookingForGuests] = useState<TourBooking | null>(null)
  const [selectedBookingForDocFeedback, setSelectedBookingForDocFeedback] = useState<TourBooking | null>(null)
  const [selectedBookingForPendingEdits, setSelectedBookingForPendingEdits] = useState<TourBooking | null>(null)
  const [selectedBookingForUpload, setSelectedBookingForUpload] = useState<TourBooking | null>(null)
  // Frontend-only: track which bookings have had documents uploaded in this session
  // so the card button flips to 'Update documents' immediately (before backend cache refresh).
  const [uploadedBookingIds, setUploadedBookingIds] = useState<Set<string>>(new Set())

  const [isCancelling, setIsCancelling] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSendingDocFeedback, setIsSendingDocFeedback] = useState(false)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [toastConfig, setToastConfig] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const queryClient = useQueryClient()

  const { data: bookings = [], isLoading } = useMyBookings(user?.id, user?.email, user?.role)
  const { data: selectedTour, isLoading: isTourPolicyLoading } = useTourDetails(selectedBookingForCancel?.tourId)

  // Filter bookings based on active tab
  const filteredBookings = bookings.filter((booking) => {
    if (activeTab === 'All tours') return true
    if (isCanceledStatus(activeTab)) {
      return isCanceledStatus(booking.status)
    }
    return booking.status.toLowerCase() === activeTab.toLowerCase()
  })

  const handleConfirmCancel = async (reason?: CancellationReason) => {
    if (!selectedBookingForCancel) return

    try {
      setIsCancelling(true)
      const response = reason
        ? await bookingsService.cancelBooking(selectedBookingForCancel.id, reason)
        : await bookingsService.cancelBooking(selectedBookingForCancel.id)

      await queryClient.invalidateQueries({ queryKey: ['bookings'] })

      if (response.refundEligible) {
        setToastConfig({ message: 'Booking canceled. The customer is eligible for a full refund.', type: 'success' })
      } else {
        const penaltyMessage = typeof response.penaltyAmount === 'number' && response.penaltyAmount > 0
          ? `Booking canceled. A $${response.penaltyAmount} cancellation penalty applies.`
          : 'Booking canceled. The cancellation is not eligible for a refund.'
        setToastConfig({ message: penaltyMessage, type: 'success' })
      }

      setSelectedBookingForCancel(null)
    } catch (error: unknown) {
      setToastConfig({ message: getBookingActionErrorMessage(error, 'cancel'), type: 'error' })
    } finally {
      setIsCancelling(false)
    }
  }

  const handleUpdateBooking = async (payload: Parameters<typeof bookingsService.updateBooking>[1]) => {
    if (!selectedBookingForEdit) return

    try {
      setIsUpdating(true)
      await bookingsService.updateBooking(selectedBookingForEdit.id, payload)
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setSelectedBookingForEdit(null)
      setToastConfig({ message: 'All changes have been saved successfully', type: 'success' })
    } catch (error: unknown) {
      setToastConfig({ message: getBookingActionErrorMessage(error, 'update'), type: 'error' })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCheckAndConfirmBooking = async (bookingId: string) => {
    try {
      setIsConfirming(true)
      await bookingsService.confirmBooking(bookingId)
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setSelectedBookingForConfirm(null)
      setToastConfig({ message: 'Booking confirmed successfully', type: 'success' })
    } catch (error: unknown) {
      setToastConfig({ message: getBookingActionErrorMessage(error, 'confirm'), type: 'error' })
    } finally {
      setIsConfirming(false)
    }
  }

  const handleSendDocumentFeedback = async (bookingId: string, comment: string) => {
    try {
      setIsSendingDocFeedback(true)
      await bookingsService.sendDocumentFeedback(bookingId, comment)
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setToastConfig({ message: 'Document feedback sent to customer', type: 'success' })
      setSelectedBookingForDocFeedback(null)
    } catch (error: unknown) {
      setToastConfig({ message: getBookingActionErrorMessage(error, 'documentFeedback'), type: 'error' })
    } finally {
      setIsSendingDocFeedback(false)
    }
  }

  const handleSubmitFeedback = async (rating: number, comment: string) => {
    if (!selectedBookingForFeedback) return

    const isUpdate = Boolean(selectedBookingForFeedback.hasFeedback)

    try {
      setIsSubmittingFeedback(true)
      await bookingsService.submitFeedback(
        selectedBookingForFeedback.tourId,
        selectedBookingForFeedback.id,
        rating,
        comment,
        isUpdate
      )
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setToastConfig({
        message: isUpdate
          ? 'Your feedback has been updated successfully'
          : 'Your feedback has been submitted successfully',
        type: 'success',
      })
      setSelectedBookingForFeedback(null)
    } catch {
      setToastConfig({ message: 'Failed to submit feedback. Please try again.', type: 'error' })
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  const handleConfirmPendingEdit = async (bookingId: string) => {
    try {
      await bookingsService.confirmEdit(bookingId, user?.role)
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setSelectedBookingForPendingEdits(null)
      setToastConfig({ message: 'Booking changes approved successfully', type: 'success' })
    } catch {
      setToastConfig({ message: 'Failed to approve changes. Please try again.', type: 'error' })
    }
  }

  const handleDeclinePendingEdit = async (bookingId: string) => {
    try {
      await bookingsService.declineEdit(bookingId)
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setSelectedBookingForPendingEdits(null)
      setToastConfig({ message: 'Changes declined and booking canceled successfully', type: 'success' })
    } catch {
      setToastConfig({ message: 'Failed to decline changes. Please try again.', type: 'error' })
    }
  }

  return (
    <div className="my-tours-main">
      {toastConfig && (
        <Toast
          type={toastConfig.type}
          message={toastConfig.message}
          onClose={() => setToastConfig(null)}
        />
      )}

      <div className="my-tours-container">
        <div className="my-tours-tabs-wrapper">
          <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <div className="my-tours-list">
          {isLoading ? (
            <div className="my-tours-loading">
              <PageLoader label="Loading your bookings..." inline />
            </div>
          ) : filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => (
              <BookingCardAdapter
                key={booking.id}
                booking={{
                  ...booking,
                  // Reflect successful upload immediately without waiting for backend cache refresh
                  documentsUploaded: booking.documentsUploaded || uploadedBookingIds.has(booking.id),
                }}
                userRole={user?.role}
                handlers={{
                  onCancel: () => setSelectedBookingForCancel(booking),
                  onEdit: () => setSelectedBookingForEdit(booking),
                  onCheckAndConfirm: () => setSelectedBookingForConfirm(booking),
                  onGiveFeedback: () => setSelectedBookingForFeedback(booking),
                  onReviewPendingEdits: () => setSelectedBookingForPendingEdits(booking),
                  onUploadDocuments: () => setSelectedBookingForUpload(booking),
                }}
                onOpenDocuments={() => setSelectedBookingForDocuments(booking)}
                onOpenGuests={() => setSelectedBookingForGuests(booking)}
              />
            ))
          ) : (
            <div className="my-tours-empty">
              <p>{getEmptyBookingsMessage(isAgent, activeTab)}</p>
            </div>
          )}
        </div>
      </div>

      {selectedBookingForCancel && (
        <CancelBookingModal
          isOpen={Boolean(selectedBookingForCancel)}
          mode={isAgent ? 'agent' : 'customer'}
          tourTitle={selectedBookingForCancel.tourTitle}
          location={selectedBookingForCancel.destination}
          startDate={selectedBookingForCancel.startDate}
          durationDays={selectedBookingForCancel.durationDays}
          mealPlan={selectedBookingForCancel.mealPlan}
          guestsText={formatGuestSummary(selectedBookingForCancel)}
          customerName={
            selectedBookingForCancel.guests?.[0]
              ? `${selectedBookingForCancel.guests[0].firstName} ${selectedBookingForCancel.guests[0].lastName}`.trim()
              : undefined
          }
          customerEmail={selectedBookingForCancel.customerEmail}
          guestsCount={selectedBookingForCancel.guestsCount}
          tourType={selectedTour?.tourType}
          freeCancellationUntilDate={selectedBookingForCancel.freeCancellationUntilDate}
          freeCancellationUntilDays={selectedTour?.cancellationPolicy.freeCancellationUntilDays}
          isPolicyLoading={isTourPolicyLoading}
          isLoading={isCancelling}
          onClose={() => setSelectedBookingForCancel(null)}
          onConfirmCancel={handleConfirmCancel}
        />
      )}

      {selectedBookingForEdit && (
        <EditBookingModal
          isOpen={Boolean(selectedBookingForEdit)}
          mode={isAgent ? 'agent' : 'customer'}
          booking={selectedBookingForEdit}
          onClose={() => setSelectedBookingForEdit(null)}
          onUpdateBooking={handleUpdateBooking}
          isLoading={isUpdating}
        />
      )}

      {selectedBookingForConfirm && (
        <CheckConfirmModal
          isOpen={Boolean(selectedBookingForConfirm)}
          booking={selectedBookingForConfirm}
          isLoading={isConfirming}
          onClose={() => setSelectedBookingForConfirm(null)}
          onConfirm={handleCheckAndConfirmBooking}
          onDoNotConfirm={() => {
            const currentBooking = selectedBookingForConfirm
            setSelectedBookingForConfirm(null)
            setSelectedBookingForDocFeedback(currentBooking)
          }}
        />
      )}

      {selectedBookingForFeedback && (
        <FeedbackModal
          isOpen={Boolean(selectedBookingForFeedback)}
          hasFeedback={selectedBookingForFeedback.hasFeedback}
          initialRating={selectedBookingForFeedback.feedback?.rating}
          initialComment={selectedBookingForFeedback.feedback?.comment}
          isLoading={isSubmittingFeedback}
          onClose={() => setSelectedBookingForFeedback(null)}
          onSubmit={handleSubmitFeedback}
        />
      )}

      {selectedBookingForDocuments && (
        <DocumentsPopupModal
          isOpen={Boolean(selectedBookingForDocuments)}
          booking={selectedBookingForDocuments}
          onClose={() => setSelectedBookingForDocuments(null)}
        />
      )}

      {selectedBookingForGuests && (
        <GuestsPopupModal
          isOpen={Boolean(selectedBookingForGuests)}
          booking={selectedBookingForGuests}
          onClose={() => setSelectedBookingForGuests(null)}
        />
      )}

      {selectedBookingForDocFeedback && (
        <DocumentFeedbackModal
          isOpen={Boolean(selectedBookingForDocFeedback)}
          booking={selectedBookingForDocFeedback}
          isLoading={isSendingDocFeedback}
          onClose={() => setSelectedBookingForDocFeedback(null)}
          onSubmitFeedback={handleSendDocumentFeedback}
        />
      )}

      {selectedBookingForPendingEdits && (
        <PendingEditsModal
          isOpen={Boolean(selectedBookingForPendingEdits)}
          booking={selectedBookingForPendingEdits}
          onClose={() => setSelectedBookingForPendingEdits(null)}
          onConfirmEdit={handleConfirmPendingEdit}
          onDeclineEdit={handleDeclinePendingEdit}
        />
      )}

      {selectedBookingForUpload && (
        <UploadDocumentsModal
          isOpen={Boolean(selectedBookingForUpload)}
          booking={selectedBookingForUpload}
          isUpdate={uploadedBookingIds.has(selectedBookingForUpload.id) || selectedBookingForUpload.documentsUploaded}
          onClose={() => setSelectedBookingForUpload(null)}
          onSave={async (fields, isUpdate, originalFields, onFileUploaded) => {
            try {
              await bookingsService.uploadBookingDocuments(
                selectedBookingForUpload.id,
                fields,
                originalFields,
                onFileUploaded
              )
              await queryClient.invalidateQueries({ queryKey: ['bookings'] })
              // Save is gated on every field having a file, so a success here
              // always means the booking has documents.
              setUploadedBookingIds((prev) => new Set(prev).add(selectedBookingForUpload.id))
              setSelectedBookingForUpload(null)
              setToastConfig({
                message: isUpdate
                  ? 'Your documents have been updated successfully'
                  : 'Your documents have been uploaded successfully',
                type: 'success',
              })
            } catch (error) {
              setToastConfig({
                message:
                  error instanceof Error
                    ? error.message
                    : 'Failed to upload documents. Please try again.',
                type: 'error',
              })
              // Modal stays open — user can retry
            }
          }}
        />
      )}

    </div>
  )
}
