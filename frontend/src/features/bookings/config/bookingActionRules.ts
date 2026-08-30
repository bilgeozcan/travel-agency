import { isRoleAllowed, normalizeUserRole } from '@/utils/authUtils'
import { normalizeBookingStatus } from '../utils/bookingStatusMapper'
import type { BookingStatus } from '../types/bookings'
import type { UserRole } from '@/types/auth'

export type BookingAction =
  | 'cancel'
  | 'edit'
  | 'checkAndConfirm'
  | 'uploadDocuments'
  | 'giveFeedback'

export interface ActionRule {
  allowedRoles: UserRole[] | readonly UserRole[]
  allowedStatuses: BookingStatus[] | readonly BookingStatus[]
}

/**
 * Single Source of Truth (SSOT) configuration matrix for booking action permissions.
 * Defines which user roles and booking statuses can execute/see specific action buttons.
 */
export const BOOKING_ACTION_RULES: Record<BookingAction, ActionRule> = {
  cancel: {
    allowedRoles: ['Customer', 'Travel Agent', 'Admin'],
    allowedStatuses: ['BOOKED', 'CONFIRMED'],
  },
  edit: {
    allowedRoles: ['Customer', 'Travel Agent'],
    allowedStatuses: ['BOOKED'],
  },
  checkAndConfirm: {
    allowedRoles: ['Travel Agent'],
    allowedStatuses: ['BOOKED'],
  },
  uploadDocuments: {
    allowedRoles: ['Customer'],
    allowedStatuses: ['BOOKED', 'CONFIRMED'],
  },
  giveFeedback: {
    allowedRoles: ['Customer'],
    allowedStatuses: ['STARTED', 'FINISHED'],
  },
}

/**
 * Evaluates whether a given action is allowed for a user role and booking status.
 */
export function isBookingActionAllowed(
  action: BookingAction,
  role?: string | null,
  status?: string | null
): boolean {
  const rule = BOOKING_ACTION_RULES[action]
  if (!rule) return false

  const userRole = normalizeUserRole(role)
  const bookingStatus = normalizeBookingStatus(status || undefined)

  const isRoleValid = isRoleAllowed(userRole, rule.allowedRoles)
  const isStatusValid = (rule.allowedStatuses as readonly BookingStatus[]).includes(bookingStatus)

  return isRoleValid && isStatusValid
}
