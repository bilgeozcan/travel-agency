import React, { useEffect } from 'react'
import { Button } from '@/components/ui/Button/Button'
import type { BookingConfirmationModalProps } from '../../types/bookingConfirmation'
import closeIcon from '@/assets/icons/Close.svg'
import { getCancellationPolicyStatus } from '../../utils/bookingsValidation'
import {
  formatBookingConfirmationGuestSummary,
  formatBookingConfirmationDate,
  calculateBookingConfirmationRefDate,
} from '../../utils/bookingConfirmationFormatter'
import './BookingConfirmationModal.css'

export const BookingConfirmationModal: React.FC<BookingConfirmationModalProps> = ({
  isOpen,
  hotelName,
  startDate,
  durationDays,
  mealPlan,
  adultsCount,
  childrenCount = 0,
  travelAgent,
  bookingDate,
  freeCancellationUntilDate,
  onClose,
  onNavigateToMyTours,
}) => {
  // ESC key listener & body scroll lock
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Separated Logic Helpers
  const refDate = calculateBookingConfirmationRefDate(startDate, bookingDate)
  const cancellationStatus = getCancellationPolicyStatus({
    startDate,
    freeCancellationUntilDate,
    currentDate: refDate,
  })
  const guestSummary = formatBookingConfirmationGuestSummary(adultsCount, childrenCount)
  const formattedStartDate = formatBookingConfirmationDate(startDate)

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleMyToursClick = () => {
    onClose()
    if (onNavigateToMyTours) {
      onNavigateToMyTours()
    }
  }

  return (
    <div
      className="booking-confirmation-backdrop"
      onClick={handleBackdropClick}
      data-testid="booking-confirmation-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-confirmation-title"
    >
      <div className="booking-confirmation-shell" data-testid="booking-confirmation-modal">
        {/* Header Bar */}
        <div className="booking-confirmation-header">
          <h2 id="booking-confirmation-title" className="booking-confirmation-title">
            Booking Confirmed!
          </h2>
          <button
            type="button"
            className="booking-confirmation-close-btn"
            onClick={onClose}
            aria-label="Close confirmation modal"
          >
            <img src={closeIcon} alt="" aria-hidden="true" width="24" height="24" />
          </button>
        </div>

        {/* Free Cancellation Banner - Conditional Rendering: Render ONLY if free cancellation is active */}
        {cancellationStatus.isFree && (
          <div className="booking-confirmation-banner booking-confirmation-banner--success" data-testid="free-cancellation-banner">
            <p className="booking-confirmation-banner-text">
              {cancellationStatus.bannerMessage}
            </p>
          </div>
        )}

        {/* Booking Info Description */}
        <div className="booking-confirmation-info-box">
          <p className="booking-confirmation-info-text">
            You have successfully booked a tour at {hotelName}, starting date {formattedStartDate} ({durationDays} days), {mealPlan} for {guestSummary}.
          </p>
        </div>

        {/* Travel Agent & Documents Notice */}
        <div className="booking-confirmation-notice">
          <p>
            Please upload your travel documents (passports, payment confirmations) on the <strong>'My Tours'</strong> page and wait for your Travel Agent to contact you.
          </p>
        </div>

        {/* Assigned Travel Agent Section */}
        {travelAgent && (
          <div className="booking-confirmation-agent-card" data-testid="travel-agent-card">
            <h4 className="booking-confirmation-agent-heading">Your Assigned Travel Agent</h4>
            <div className="booking-confirmation-agent-details">
              <p className="booking-confirmation-agent-name">{travelAgent.name}</p>
              <p className="booking-confirmation-agent-contact">
                <span>📧 {travelAgent.email}</span>
                {travelAgent.phone && <span>📞 {travelAgent.phone}</span>}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="booking-confirmation-actions">
          <Button
            variant="primary"
            className="booking-confirmation-btn"
            onClick={handleMyToursClick}
            data-testid="my-tours-button"
          >
            My Tours
          </Button>
        </div>
      </div>
    </div>
  )
}
