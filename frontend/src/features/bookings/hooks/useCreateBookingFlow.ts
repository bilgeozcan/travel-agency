import { useState } from 'react'
import { bookingsService } from '@/api/services/bookings.service'
import type { CreateBookingRequest, CreateBookingResponse } from '../types/bookings'

interface UseCreateBookingFlowOptions {
  quotedPrice?: number
}

export function useCreateBookingFlow() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitBooking = async (
    payload: CreateBookingRequest,
    options?: UseCreateBookingFlowOptions
  ): Promise<CreateBookingResponse> => {
    setIsLoading(true)
    setError(null)

    try {
      let token = payload.bookingToken

      if (!token) {
        const totalGuests = payload.guests.adult + payload.guests.children
        const quotedPrice = options?.quotedPrice || payload.quotedPrice

        if (!quotedPrice) {
          throw new Error('Quoted price is required for booking')
        }

        const valResult = await bookingsService.validateBooking({
          packageId: payload.tourId,
          startDate: payload.date,
          duration: payload.duration,
          guestCount: totalGuests,
          adults: payload.guests.adult,
          children: payload.guests.children,
          mealPlan: payload.mealPlan,
          quotedPrice,
        })

        token = valResult.bookingToken
      }

      const response = await bookingsService.createBooking({
        ...payload,
        bookingToken: token,
      })

      return response
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit booking'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  return {
    submitBooking,
    isLoading,
    error,
  }
}
