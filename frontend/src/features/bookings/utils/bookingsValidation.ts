import type { GuestInfo } from '../types/bookings'
import type { SelectOption } from '@/components/ui/Select/Select'

export type CancellationReason =
  | "Customer's Emergency"
  | 'Hotel Emergency'
  | 'Safety Concerns'
  | 'Insufficient bookings'

export const CANCELLATION_REASON_OPTIONS: SelectOption[] = [
  { label: "Customer's Emergency", value: "Customer's Emergency" },
  { label: 'Hotel Emergency', value: 'Hotel Emergency' },
  { label: 'Safety Concerns', value: 'Safety Concerns' },
  { label: 'Insufficient bookings', value: 'Insufficient bookings' },
]

export function validateCancellationReason(reason?: string): boolean {
  if (!reason || typeof reason !== 'string') return false
  return CANCELLATION_REASON_OPTIONS.some((option) => option.value === reason.trim())
}

export const BOOKING_ERRORS = {
  FIRST_NAME_REQUIRED: 'First name is required',
  LAST_NAME_REQUIRED: 'Last name is required',
} as const

/**
 * Validates dynamic guest personal details input fields.
 */
export function validateGuestInputs(guests: GuestInfo[]): {
  isValid: boolean
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}
  let isValid = true

  guests.forEach((guest, idx) => {
    if (!guest.firstName.trim()) {
      errors[`customer_${idx}_firstName`] = BOOKING_ERRORS.FIRST_NAME_REQUIRED
      isValid = false
    }

    if (!guest.lastName.trim()) {
      errors[`customer_${idx}_lastName`] = BOOKING_ERRORS.LAST_NAME_REQUIRED
      isValid = false
    }
  })

  return { isValid, errors }
}

export interface FreeCancellationStatus {
  isFree: boolean
  cutoffDateFormatted: string
  bannerMessage: string
}

export interface CancellationPolicyInput {
  startDate: string
  freeCancellationUntilDate?: string | null
  freeCancellationUntilDays?: number
  currentDate?: Date
}

/**
 * Safely parses ISO date strings (e.g., "YYYY-MM-DD" or ISO strings) at local midnight,
 * preventing UTC offset shifts across different timezones.
 */
export function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null
  const cleanStr = dateStr.trim()
  const isoMatch = cleanStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch.map(Number)
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const parsed = new Date(y, m - 1, d)
      if (!isNaN(parsed.getTime())) {
        return parsed
      }
    }
  }
  const parsed = new Date(cleanStr)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Resolves the cancellation policy from the booking deadline supplied by the API,
 * then the tour-specific policy, then a ten-day legacy fallback.
 */
export function getCancellationPolicyStatus({
  startDate,
  freeCancellationUntilDate,
  freeCancellationUntilDays,
  currentDate = new Date(),
}: CancellationPolicyInput): FreeCancellationStatus {
  const apiDeadline = parseLocalDate(freeCancellationUntilDate ?? '')
  const tourStartDate = parseLocalDate(startDate)
  const hasTourPolicy = typeof freeCancellationUntilDays === 'number'
  const policyDays = freeCancellationUntilDays && freeCancellationUntilDays > 0
    ? freeCancellationUntilDays
    : null
  const cutoffDate = apiDeadline ?? (
    policyDays && tourStartDate
      ? new Date(tourStartDate.getFullYear(), tourStartDate.getMonth(), tourStartDate.getDate() - policyDays)
      : !hasTourPolicy && freeCancellationUntilDate === undefined && tourStartDate
        ? new Date(tourStartDate.getFullYear(), tourStartDate.getMonth(), tourStartDate.getDate() - 10)
        : null
  )

  if (!cutoffDate) {
    return {
      isFree: false,
      cutoffDateFormatted: '',
      bannerMessage: 'Cancellation terms are unavailable. Please contact support before cancelling.',
    }
  }

  const now = new Date(currentDate)
  now.setHours(0, 0, 0, 0)
  const isFree = now.getTime() <= cutoffDate.getTime()

  // Format date e.g. "January 5, 2025"
  const formattedDate = cutoffDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  if (isFree) {
    return {
      isFree: true,
      cutoffDateFormatted: formattedDate,
      bannerMessage: `Free cancellation is possible until ${formattedDate}.`,
    }
  }

  return {
    isFree: false,
    cutoffDateFormatted: formattedDate,
    bannerMessage:
      'Please note, that the free cancelation period for this booking is over, the charges are non-refundable.',
  }
}

export interface FeedbackValidationResult {
  isValid: boolean
  showLowRatingWarning: boolean
  isSubmitDisabled: boolean
}

/**
 * Validates feedback rating and comment inputs according to MR 2 business rules.
 */
export function validateFeedbackInput(rating: number, comment: string): FeedbackValidationResult {
  const trimmedComment = (comment || '').trim()
  const isRatingValid = typeof rating === 'number' && rating >= 1 && rating <= 5
  const isLowRating = rating >= 1 && rating <= 3
  const isCommentEmpty = trimmedComment.length === 0

  const showLowRatingWarning = isLowRating && isCommentEmpty
  const isSubmitDisabled = !isRatingValid || (isLowRating && isCommentEmpty)

  return {
    isValid: !isSubmitDisabled,
    showLowRatingWarning,
    isSubmitDisabled,
  }
}


