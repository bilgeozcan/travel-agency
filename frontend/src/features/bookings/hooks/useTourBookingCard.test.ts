import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTourBookingCard } from './useTourBookingCard'
import type { TourBooking } from '../types/bookings'

describe('useTourBookingCard Hook', () => {
  const mockBooking: TourBooking = {
    id: 'booking-101',
    tourId: 'tour-swiss',
    tourTitle: 'Swiss Alps Ski Retreat',
    destination: 'Zermatt, Switzerland',
    hotelName: 'Swiss Alps Ski Retreat',
    heroImage: 'https://example.com/swiss.jpg',
    startDate: 'Jan 15, 2025',
    endDate: 'Jan 22, 2025',
    durationDays: 7,
    adultsCount: 2,
    childrenCount: 0,
    guestsCount: 2,
    guests: [{ firstName: 'Taylor', lastName: 'Smith' }],
    mealPlan: 'BB',
    totalPrice: 1400,
    currency: 'USD',
    status: 'BOOKED',
    documentsUploaded: true,
  }

  it('evaluates Customer view correctly', () => {
    const { result } = renderHook(() =>
      useTourBookingCard({ booking: mockBooking, userRole: 'Customer' })
    )

    expect(result.current.isAgent).toBe(false)
    expect(result.current.normalizedStatus).toBe('booked')
    expect(result.current.guestsText).toBe('Taylor Smith (2 adults)')
    expect(result.current.dateRangeText).toBe('Jan 15, 2025 (7 days)')
  })

  it('evaluates Travel Agent view correctly and omits guestsText', () => {
    const { result } = renderHook(() =>
      useTourBookingCard({ booking: mockBooking, userRole: 'Travel Agent' })
    )

    expect(result.current.isAgent).toBe(true)
    expect(result.current.guestsText).toBeUndefined()
  })

  it('extracts cancellation details when canceledBy is present', () => {
    const canceledBooking: TourBooking = {
      ...mockBooking,
      status: 'CANCELED',
      canceledBy: 'Customer',
      cancellationReason: 'Flight change',
    }

    const { result } = renderHook(() =>
      useTourBookingCard({ booking: canceledBooking, userRole: 'Customer' })
    )

    expect(result.current.cancellationDetails).toEqual({
      cancelledBy: 'Customer',
      reason: 'Flight change',
    })
  })
})
