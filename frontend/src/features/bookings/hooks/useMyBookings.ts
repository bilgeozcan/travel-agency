import { useQuery } from '@tanstack/react-query'
import { bookingsService } from '@/api/services/bookings.service'
import { isTravelAgent } from '@/utils/authUtils'
import type { TourBooking } from '../types/bookings'

/**
 * Custom Hook: useMyBookings
 * Encapsulates React Query data fetching and Travel Agent assigned booking filtering logic.
 */
export function useMyBookings(userId?: string, userEmail?: string, role?: string | null) {
  const queryId = userId || userEmail

  return useQuery({
    queryKey: ['bookings', queryId, userEmail, role],
    queryFn: () => {
      if (!queryId) return Promise.resolve([])
      return bookingsService.getUserBookings(role)
    },
    select: (bookings: TourBooking[]) => {
      if (!isTravelAgent(role)) {
        return bookings
      }

      const normEmail = userEmail?.toLowerCase().trim() || ''
      const normId = userId?.toLowerCase().trim() || ''

      return bookings.filter((booking) => {
        if (!booking.travelAgent?.email) {
          return true
        }

        const agentEmail = booking.travelAgent.email.toLowerCase().trim()
        return (
          Boolean(normEmail && (agentEmail === normEmail || normEmail.includes(agentEmail) || agentEmail.includes(normEmail))) ||
          Boolean(normId && (agentEmail === normId || normId.includes(agentEmail)))
        )
      })
    },
    enabled: Boolean(queryId),
    staleTime: 1000 * 60 * 5,
  })
}
