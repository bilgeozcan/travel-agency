import React from 'react'
import { Button } from '@/components/ui/Button/Button'
import { getCancellationPolicyStatus } from '../../utils/bookingsValidation'
import { formatMealPlanFullLabel } from '@/utils/toursValidation'

export interface CustomerCancelModalBodyProps {
  tourTitle: string
  startDate: string
  durationDays: number
  mealPlan: string
  guestsText: string
  freeCancellationUntilDate?: string | null
  freeCancellationUntilDays?: number
  isPolicyLoading?: boolean
  isLoading?: boolean
  onClose: () => void
  onConfirmCancel: () => void
}

export const CustomerCancelModalBody: React.FC<CustomerCancelModalBodyProps> = ({
  tourTitle,
  startDate,
  durationDays,
  mealPlan,
  guestsText,
  freeCancellationUntilDate,
  freeCancellationUntilDays,
  isPolicyLoading = false,
  isLoading = false,
  onClose,
  onConfirmCancel,
}) => {
  const cancellationStatus = getCancellationPolicyStatus({
    startDate,
    freeCancellationUntilDate,
    freeCancellationUntilDays,
  })

  return (
    <>
      {/* Dynamic Yellow / Red Banner */}
      {!isPolicyLoading && (
        <div
          className={`cancel-booking-banner ${cancellationStatus.isFree
              ? 'cancel-booking-banner--yellow'
              : 'cancel-booking-banner--red'
            }`}
          data-testid="cancellation-policy-banner"
        >
          {cancellationStatus.bannerMessage}
        </div>
      )}

      {/* Confirmation Body Text */}
      <p className="cancel-booking-modal-body">
        Are you sure you want to cancel the tour at <strong>{tourTitle}</strong>,
        starting date <strong>{startDate} ({durationDays} days)</strong>,{' '}
        <strong>{formatMealPlanFullLabel(mealPlan)}</strong> for <strong>{guestsText}</strong>?
      </p>

      {/* Action Buttons */}
      <div className="cancel-booking-modal-actions">
        <Button
          type="button"
          variant="outline"
          fullWidth={false}
          className="cancel-booking-btn-outline"
          onClick={onConfirmCancel}
          disabled={isLoading}
          isLoading={isLoading}
          loadingText="Cancelling..."
          data-testid="confirm-cancel-button"
        >
          Cancel the booking
        </Button>
        <Button
          type="button"
          variant="primary"
          fullWidth={false}
          className="cancel-booking-btn-filled"
          onClick={onClose}
          disabled={isLoading}
          data-testid="keep-booking-button"
        >
          Keep the booking
        </Button>
      </div>
    </>
  )
}
