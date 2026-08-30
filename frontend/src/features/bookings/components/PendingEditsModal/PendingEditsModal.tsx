import React, { useState } from 'react'
import { ModalShell } from '@/components/ui/Modal/ModalShell'
import { Button } from '@/components/ui/Button/Button'
import type { PendingEditsModalProps } from './PendingEditsModal.types'
import { formatMealPlanFullLabel } from '@/utils/toursValidation'
import { formatBookingConfirmationDate } from '../../utils/bookingConfirmationFormatter'
import type { GuestInfo } from '../../types/bookings'
import './PendingEditsModal.css'

export type { PendingEditsModalProps }

interface ChangeDetail {
  label: string
  from: string
  to: string
}

function formatGuestDetailsWithNames(
  adultsCount: number,
  childrenCount: number,
  guests: GuestInfo[] = []
): string {
  const breakdown = `${adultsCount} ${adultsCount === 1 ? 'adult' : 'adults'}${
    childrenCount > 0 ? `, ${childrenCount} ${childrenCount === 1 ? 'child' : 'children'}` : ''
  }`

  const names = guests
    .map((g) => `${g.firstName || ''} ${g.lastName || ''}`.trim())
    .filter(Boolean)
    .join(', ')

  return names ? `${breakdown} (${names})` : breakdown
}

export const PendingEditsModal: React.FC<PendingEditsModalProps> = ({
  isOpen,
  booking,
  isLoading = false,
  onClose,
  onConfirmEdit,
  onDeclineEdit,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!booking || !booking.pendingEdits) return null

  const pe = booking.pendingEdits
  const isBusy = isLoading || isSubmitting

  const handleConfirmClick = async () => {
    try {
      setIsSubmitting(true)
      await onConfirmEdit(booking.id)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeclineClick = async () => {
    try {
      setIsSubmitting(true)
      await onDeclineEdit(booking.id)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate bullet list of specific changes
  const changedItems: ChangeDetail[] = []

  // 1. Tourists count & names
  const origGuestsStr = formatGuestDetailsWithNames(
    booking.adultsCount,
    booking.childrenCount,
    booking.guests
  )
  const propGuestsStr = formatGuestDetailsWithNames(
    pe.adultsCount,
    pe.childrenCount,
    pe.guests
  )
  if (
    origGuestsStr !== propGuestsStr ||
    booking.adultsCount !== pe.adultsCount ||
    booking.childrenCount !== pe.childrenCount
  ) {
    changedItems.push({
      label: 'Number of tourists:',
      from: origGuestsStr,
      to: propGuestsStr,
    })
  }

  // 2. Meal plan
  if (booking.mealPlan !== pe.mealPlan) {
    const origMeal = formatMealPlanFullLabel(booking.mealPlan)
    const propMeal = formatMealPlanFullLabel(pe.mealPlan)
    changedItems.push({
      label: 'Meal plan:',
      from: origMeal,
      to: propMeal,
    })
  }

  // 3. Date / Duration
  if (booking.startDate !== pe.startDate || booking.durationDays !== pe.durationDays) {
    const origDate = `${formatBookingConfirmationDate(booking.startDate)} (${booking.durationDays} days)`
    const propDate = `${formatBookingConfirmationDate(pe.startDate)} (${pe.durationDays} days)`
    changedItems.push({
      label: 'Date & Duration:',
      from: origDate,
      to: propDate,
    })
  }

  // 4. Total Price
  if (booking.totalPrice !== pe.totalPrice) {
    changedItems.push({
      label: 'Total price:',
      from: `$${booking.totalPrice}`,
      to: `$${pe.totalPrice}`,
    })
  }

  const hotelOrTourName = booking.hotelName || booking.tourTitle
  const formattedStartDate = formatBookingConfirmationDate(booking.startDate)

  return (
    <ModalShell
      isOpen={isOpen}
      title="Confirm tour booking changes"
      onClose={onClose}
      isLoading={isBusy}
      className="pending-edits-modal-shell"
      dataTestId="pending-edits-modal-shell"
    >
      <div className="confirm-changes-modal-body" data-testid="pending-edits-modal-content">
        {/* Intro sentence */}
        <p className="confirm-changes-intro">
          Your booking for <strong className="bold-text">{hotelOrTourName}</strong> on <strong className="bold-text">{formattedStartDate}</strong> has been updated by the travel agent.
        </p>

        {/* Changes List */}
        <div className="confirm-changes-section">
          <h3 className="confirm-changes-section-heading">Changes:</h3>
          <ul className="confirm-changes-list">
            {changedItems.length > 0 ? (
              changedItems.map((item, idx) => (
                <li key={idx} className="confirm-changes-item">
                  {item.label} {item.from} → {item.to}.
                </li>
              ))
            ) : (
              <li className="confirm-changes-item">
                Tour booking details updated by travel agent.
              </li>
            )}
          </ul>
        </div>

        {/* Notes */}
        <div className="confirm-changes-notes">
          <p>All other details of this booking remain the same.</p>
          <p>Please review the changes and confirm your updated booking, or contact us if you need further assistance.</p>
        </div>

        {/* Actions - Right Aligned Buttons matching App standard */}
        <div className="confirm-changes-actions">
          <Button
            type="button"
            variant="outline"
            fullWidth={false}
            disabled={isBusy}
            onClick={handleDeclineClick}
            data-testid="decline-edits-button"
          >
            Decline changes
          </Button>
          <Button
            type="button"
            variant="primary"
            fullWidth={false}
            disabled={isBusy}
            onClick={handleConfirmClick}
            data-testid="confirm-edits-button"
          >
            Confirm changes
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
