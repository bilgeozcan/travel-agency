import type { CancellationReason } from '../../utils/bookingsValidation'

export type CancelMode = 'customer' | 'agent'

export interface CancelBookingModalProps {
  isOpen: boolean
  mode?: CancelMode
  tourTitle: string
  location?: string
  startDate: string
  durationDays: number
  mealPlan: string
  guestsText: string
  tourType?: string
  isLoading?: boolean
  isPolicyLoading?: boolean
  freeCancellationUntilDate?: string | null
  freeCancellationUntilDays?: number
  customerName?: string
  customerEmail?: string
  guestsCount?: number
  onClose: () => void
  onConfirmCancel: (reason?: CancellationReason) => void
}

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

export interface AgentCancelModalBodyProps {
  tourTitle: string
  location?: string
  startDate: string
  durationDays: number
  mealPlan: string
  guestsText: string
  tourType?: string
  customerName?: string
  customerEmail?: string
  guestsCount?: number
  isLoading?: boolean
  onClose: () => void
  onConfirmCancel: (reason?: CancellationReason) => void
}
