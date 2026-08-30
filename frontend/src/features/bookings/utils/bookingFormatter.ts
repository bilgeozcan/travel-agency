import type { GuestInfo } from '../types/bookings'

export interface BookingGuestSummaryInput {
  guests?: GuestInfo[]
  adultsCount: number
  childrenCount: number
}

/**
 * Formats guest display summary string for booking cards and modals.
 * e.g., "John Doe, Jane Doe (2 adults, 1 child)"
 */
export function formatGuestSummary(booking: BookingGuestSummaryInput): string {
  const guestNames =
    booking.guests && booking.guests.length > 0
      ? booking.guests
          .map((guest) => `${guest.firstName} ${guest.lastName}`.trim())
          .filter(Boolean)
          .join(', ')
      : 'Guest'

  const adultsText = `${booking.adultsCount} adult${booking.adultsCount > 1 ? 's' : ''}`
  const childrenText =
    booking.childrenCount > 0
      ? `, ${booking.childrenCount} ${booking.childrenCount > 1 ? 'children' : 'child'}`
      : ''

  return `${guestNames} (${adultsText}${childrenText})`
}

/**
 * Normalizes cancellation role identifier into user-facing label.
 * e.g., 'TRAVEL_AGENT' -> 'Travel agent', 'CUSTOMER' -> 'Tourist', 'ADMIN' -> 'Admin'
 */
export function formatCancellationRole(roleInput?: string | null): string | undefined {
  if (!roleInput) return undefined
  const lower = roleInput.trim().toLowerCase()
  if (lower.includes('admin')) return 'Admin'
  if (lower.includes('agent')) return 'Travel agent'
  if (lower.includes('customer') || lower.includes('tourist') || lower.includes('user')) return 'Tourist'
  return undefined
}

/**
 * Parses and formats canceledBy field for display.
 * Resolves role precedence from explicit rawRole or raw stringified payload.
 */
export function cleanCanceledBy(raw?: string | null, rawRole?: string | null): string | undefined {
  if (!raw && !rawRole) return undefined
  const str = raw ? String(raw).trim() : ''

  // 1. Determine Role (checks rawRole first, falls back to raw string)
  const roleLabel = formatCancellationRole(rawRole) || formatCancellationRole(str)
  let userIdentifier = ''

  // 2. Determine Name or Email
  if (str) {
    const firstNameMatch = str.match(/['"]firstName['"]:\s*['"]([^'"]+)['"]/)
    const lastNameMatch = str.match(/['"]lastName['"]:\s*['"]([^'"]+)['"]/)
    const emailMatch = str.match(/['"]email['"]:\s*['"]([^'"]+)['"]/)
    const nameMatch = str.match(/['"]name['"]:\s*['"]([^'"]+)['"]/)

    if (firstNameMatch && lastNameMatch) {
      userIdentifier = `${firstNameMatch[1]} ${lastNameMatch[1]}`
    } else if (nameMatch) {
      userIdentifier = nameMatch[1]
    } else if (emailMatch) {
      userIdentifier = emailMatch[1]
    } else if (str.includes('@') && !str.startsWith('{')) {
      userIdentifier = str
    }
  }

  // 3. Combine Identifier and Role Label
  if (userIdentifier && roleLabel) {
    return `${userIdentifier} (${roleLabel})`
  }
  if (userIdentifier) {
    return userIdentifier
  }
  if (roleLabel) {
    return roleLabel
  }

  return str || undefined
}

/**
 * Normalizes cancellation reason string for user-facing display.
 * Returns '-' if the reason is missing, null, or whitespace.
 */
export function cleanCancellationReason(raw?: string | null): string {
  if (!raw || raw.trim() === '') return '-'
  return raw.trim()
}
