import type { BookingStatus } from '@/features/bookings/types/bookings'

export interface BookingCardHandlers {
  onCancel?: () => void
  onEdit?: () => void
  onUploadDocuments?: () => void
  onCheckAndConfirm?: () => void
  onGiveFeedback?: () => void
  onReviewPendingEdits?: () => void
}

export interface BookingCardActionsProps {
  role?: 'Customer' | 'Travel Agent' | string
  status: BookingStatus | string
  handlers: BookingCardHandlers
  isPendingApproval?: boolean
  hasFeedback?: boolean
  hasPendingEdits?: boolean
  documentsUploaded?: boolean
}
