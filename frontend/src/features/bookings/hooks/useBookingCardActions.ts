import { isBookingActionAllowed } from '../config/bookingActionRules'

export interface BookingCardActionPermissions {
  canCancel: boolean
  canEdit: boolean
  canCheckAndConfirm: boolean
  canUploadDocuments: boolean
  canGiveFeedback: boolean
}

/**
 * Custom hook providing declarative action permissions for a booking card based on user role and booking status.
 */
export function useBookingCardActions(
  role?: string | null,
  status?: string | null
): BookingCardActionPermissions {
  return {
    canCancel: isBookingActionAllowed('cancel', role, status),
    canEdit: isBookingActionAllowed('edit', role, status),
    canCheckAndConfirm: isBookingActionAllowed('checkAndConfirm', role, status),
    canUploadDocuments: isBookingActionAllowed('uploadDocuments', role, status),
    canGiveFeedback: isBookingActionAllowed('giveFeedback', role, status),
  }
}
