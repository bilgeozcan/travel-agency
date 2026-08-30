import React from 'react'
import { Button } from '@/components/ui/Button/Button'
import type { BookingCardActionsProps, BookingCardHandlers } from './BookingCardActions.types'
import { useBookingCardActions } from '../../hooks/useBookingCardActions'
import { FEEDBACK_MODAL_STRINGS } from '../../config/feedbackConstants'

export type { BookingCardActionsProps, BookingCardHandlers }

export const BookingCardActions: React.FC<BookingCardActionsProps> = ({
  role = 'Customer',
  status,
  handlers = {},
  isPendingApproval = false,
  hasFeedback = false,
  hasPendingEdits = false,
  documentsUploaded = false,
}) => {
  const {
    canCancel,
    canEdit,
    canCheckAndConfirm,
    canUploadDocuments,
    canGiveFeedback,
  } = useBookingCardActions(role, status)

  const isCustomerRole = role === 'Customer' || role === 'CUSTOMER'
  // Pending edits are only relevant for customers
  const hasPending = hasPendingEdits && isCustomerRole

  const hasAnyAction = canCancel || canEdit || canCheckAndConfirm || canUploadDocuments || canGiveFeedback || hasPending
  if (!hasAnyAction) return null

  return (
    <div className="tour-booking-actions">
      {canCancel && (
        <Button variant="outline" fullWidth={false} onClick={handlers.onCancel}>
          Cancel
        </Button>
      )}

      {/* Hide Edit while agent's pending edits are awaiting customer approval */}
      {canEdit && !hasPending && (
        <Button variant="outline" fullWidth={false} onClick={handlers.onEdit}>
          Edit
        </Button>
      )}

      {canCheckAndConfirm && (
        <div className="tooltip-wrapper">
          <Button
            variant="primary"
            fullWidth={false}
            disabled={isPendingApproval}
            onClick={handlers.onCheckAndConfirm}
          >
            Check and confirm
          </Button>
          {isPendingApproval && (
            <span className="tooltip-text">Waiting for changes approval from customer</span>
          )}
        </div>
      )}

      {canUploadDocuments && (
        <Button variant="primary" fullWidth={false} onClick={handlers.onUploadDocuments}>
          {documentsUploaded ? 'Update documents' : 'Upload documents'}
        </Button>
      )}

      {canGiveFeedback && (
        <Button variant="primary" fullWidth={false} onClick={handlers.onGiveFeedback}>
          {hasFeedback ? FEEDBACK_MODAL_STRINGS.UPDATE_FEEDBACK_BTN : FEEDBACK_MODAL_STRINGS.GIVE_FEEDBACK_BTN}
        </Button>
      )}

      {/* Review Changes appears on the far right when pending edits exist */}
      {hasPending && (
        <Button variant="primary" fullWidth={false} onClick={handlers.onReviewPendingEdits}>
          Review changes
        </Button>
      )}
    </div>
  )
}

