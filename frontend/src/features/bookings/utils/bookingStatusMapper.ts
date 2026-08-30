import type { BookingStatus } from '../types/bookings'

/**
 * Normalizes raw booking status string variants (e.g., 'CANCELLED', 'canceled', 'CANCELED')
 * to standard BookingStatus type.
 */
export function normalizeBookingStatus(status?: string): BookingStatus {
  if (!status) return 'BOOKED'
  const normalized = status.toUpperCase().trim()
  if (normalized === 'CANCELLED' || normalized === 'CANCELED') {
    return 'CANCELED'
  }
  if (['BOOKED', 'CONFIRMED', 'STARTED', 'FINISHED'].includes(normalized)) {
    return normalized as BookingStatus
  }
  return 'BOOKED'
}

/**
 * Helper checking if a given status string is any variant of cancelled
 */
export function isCanceledStatus(status?: string): boolean {
  if (!status) return false
  const normalized = status.trim().toUpperCase()
  return normalized === 'CANCELLED' || normalized === 'CANCELED'
}
