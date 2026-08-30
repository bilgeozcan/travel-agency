import React from 'react'
import { Select } from '@/components/ui/Select/Select'
import { Button } from '@/components/ui/Button/Button'
import { BookingDetailsSection } from '../shared/BookingDetailsSection'
import { CANCELLATION_REASON_OPTIONS } from '../../utils/bookingsValidation'
import { useCancelBookingModal } from '../../hooks/useCancelBookingModal'
import { formatMealPlanFullLabel } from '@/utils/toursValidation'
import type { AgentCancelModalBodyProps } from './CancelBookingModal.types'

export type { AgentCancelModalBodyProps }

function formatTourType(type?: string): string {
  if (!type) return 'N/A'
  const clean = type.trim().toUpperCase()
  if (clean === 'RESORT') return 'Resort'
  if (clean === 'CRUISE') return 'Cruise'
  if (clean === 'HIKE') return 'Hike'
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()
}

export const AgentCancelModalBody: React.FC<AgentCancelModalBodyProps> = ({
  tourTitle,
  location = 'N/A',
  startDate,
  durationDays,
  mealPlan,
  guestsText,
  tourType,
  customerName,
  customerEmail = 'N/A',
  guestsCount,
  isLoading = false,
  onClose,
  onConfirmCancel,
}) => {
  const { selectedReason, isSubmitDisabled, handleReasonChange } = useCancelBookingModal()

  const displayCustomer = customerName
    ? `${customerName} (${guestsCount ? `${guestsCount} guest${guestsCount > 1 ? 's' : ''}` : '1 guest'})`
    : guestsText

  const handleConfirm = () => {
    if (!isSubmitDisabled && selectedReason) {
      onConfirmCancel(selectedReason)
    }
  }

  const cancelDetailItems = [
    { label: 'Customer:', value: displayCustomer, testId: 'agent-cancel-customer' },
    { label: 'Contact email:', value: customerEmail, testId: 'agent-cancel-email' },
    { label: 'Tour name:', value: tourTitle, testId: 'agent-cancel-tour-name' },
    { label: 'Location:', value: location, testId: 'agent-cancel-location' },
    { label: 'Start date:', value: startDate, testId: 'agent-cancel-start-date' },
    { label: 'Duration:', value: `${durationDays} days`, testId: 'agent-cancel-duration' },
    { label: 'Tour type:', value: formatTourType(tourType), testId: 'agent-cancel-tour-type' },
    { label: 'Meal plan:', value: formatMealPlanFullLabel(mealPlan), testId: 'agent-cancel-meal-plan' },
  ]

  return (
    <div className="agent-cancel-modal-body" data-testid="agent-cancel-modal-body">
      {/* Booking Details Section */}
      <BookingDetailsSection
        title="Booking details"
        items={cancelDetailItems}
      />

      {/* Cancellation Reason Dropdown Section */}
      <div className="cancel-booking-section cancel-booking-section--reason">
        <h3 className="cancel-booking-section-title">Cancellation reason</h3>
        <Select
          id="cancellation-reason-select"
          options={CANCELLATION_REASON_OPTIONS}
          value={selectedReason}
          onChange={handleReasonChange}
          disabled={isLoading}
          portal={true}
          data-testid="cancellation-reason-select"
        />
      </div>

      {/* Action Buttons */}
      <div className="cancel-booking-agent-actions">
        <Button
          type="button"
          variant="outline"
          fullWidth={false}
          className="cancel-booking-btn-secondary"
          onClick={onClose}
          disabled={isLoading}
          data-testid="agent-keep-booking-button"
        >
          Keep the booking
        </Button>
        <Button
          type="button"
          variant="primary"
          fullWidth={false}
          className="cancel-booking-btn-primary"
          onClick={handleConfirm}
          disabled={isSubmitDisabled || isLoading}
          isLoading={isLoading}
          loadingText="Cancelling..."
          data-testid="agent-confirm-cancel-button"
        >
          Cancel the booking
        </Button>
      </div>
    </div>
  )
}
