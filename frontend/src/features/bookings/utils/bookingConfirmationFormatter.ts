import { parseLocalDate } from './bookingsValidation'

/**
 * Formats adult and children count into human-readable summary (e.g. "1 adult", "2 adults, 1 child").
 */
export function formatBookingConfirmationGuestSummary(
  adultsCount: number,
  childrenCount = 0
): string {
  const adultText = `${adultsCount} ${adultsCount === 1 ? 'adult' : 'adults'}`
  const childText = childrenCount > 0 ? `, ${childrenCount} ${childrenCount === 1 ? 'child' : 'children'}` : ''
  return `${adultText}${childText}`
}

/**
 * Formats ISO YYYY-MM-DD or date strings into long US date format (e.g. "January 15, 2025").
 */
export function formatBookingConfirmationDate(dateStr: string): string {
  if (!dateStr) return ''
  const parsed = parseLocalDate(dateStr)
  if (parsed) {
    return parsed.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }
  return dateStr
}

/**
 * Determines the reference date for free cancellation status calculations.
 * Ensures historical mock dates or testing dates don't drift relative to system clock.
 */
export function calculateBookingConfirmationRefDate(
  startDate: string,
  bookingDate?: Date | string
): Date {
  if (bookingDate) return new Date(bookingDate)
  const parsedStart = parseLocalDate(startDate)
  const now = new Date()
  if (parsedStart && now.getTime() > parsedStart.getTime()) {
    return new Date(parsedStart.getFullYear(), parsedStart.getMonth(), parsedStart.getDate() - 14)
  }
  return now
}
