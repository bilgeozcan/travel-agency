import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/providers/AuthContext'
import { useRoleAccess } from '@/hooks/useRoleAccess'
import { useMyBookings } from './useMyBookings'
import { bookingsService } from '@/api/services/bookings.service'
import type { TourBooking } from '../types/bookings'

const getPendingEditKey = (bookingId: string, pendingEdits: unknown): string => {
  return `${bookingId}_${JSON.stringify(pendingEdits || {})}`
}

const readDismissedKeys = (): string[] => {
  try {
    return Object.keys(sessionStorage)
      .filter((k) => k.startsWith('dismissed_pending_edit_'))
      .map((k) => k.replace('dismissed_pending_edit_', ''))
  } catch {
    return []
  }
}

export interface UsePendingEditsNotificationResult {
  activePendingBooking: TourBooking | null
  toastConfig: { message: string; type: 'success' | 'error' } | null
  clearToast: () => void
  handleDismiss: (booking: TourBooking) => void
  handleConfirm: (bookingId: string) => Promise<void>
  handleDecline: (bookingId: string) => Promise<void>
}

export function usePendingEditsNotification(): UsePendingEditsNotificationResult {
  const { user, isAuthenticated } = useAuth()
  const { isAgent } = useRoleAccess(user)
  const queryClient = useQueryClient()

  const [dismissedKeys, setDismissedKeys] = useState<string[]>(readDismissedKeys)
  const [toastConfig, setToastConfig] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Only fetch for authenticated customers — agents and guests get empty list
  const enabled = isAuthenticated && !isAgent
  const { data: bookings = [] } = useMyBookings(
    enabled ? user?.id : undefined,
    enabled ? user?.email : undefined,
    enabled ? user?.role : undefined
  )

  const pendingEditsQueue = enabled
    ? bookings.filter((b) => {
        if (!b.pendingEdits) return false
        const key = getPendingEditKey(b.id, b.pendingEdits)
        return !dismissedKeys.includes(key)
      })
    : []

  const activePendingBooking = pendingEditsQueue[0] || null

  const handleDismiss = (booking: TourBooking) => {
    if (!booking.pendingEdits) return
    const key = getPendingEditKey(booking.id, booking.pendingEdits)
    try {
      sessionStorage.setItem(`dismissed_pending_edit_${key}`, 'true')
    } catch {}
    setDismissedKeys((prev) => [...prev, key])
  }

  const handleConfirm = async (bookingId: string) => {
    try {
      await bookingsService.confirmEdit(bookingId, user?.role)
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setToastConfig({ message: 'Booking changes approved successfully', type: 'success' })
    } catch {
      setToastConfig({ message: 'Failed to approve changes. Please try again.', type: 'error' })
    }
  }

  const handleDecline = async (bookingId: string) => {
    try {
      await bookingsService.declineEdit(bookingId)
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setToastConfig({ message: 'Changes declined and booking canceled successfully', type: 'success' })
    } catch {
      setToastConfig({ message: 'Failed to decline changes. Please try again.', type: 'error' })
    }
  }

  const clearToast = () => setToastConfig(null)

  return {
    activePendingBooking,
    toastConfig,
    clearToast,
    handleDismiss,
    handleConfirm,
    handleDecline,
  }
}
