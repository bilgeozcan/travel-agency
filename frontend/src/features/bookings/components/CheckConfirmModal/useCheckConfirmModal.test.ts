import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCheckConfirmModal } from './useCheckConfirmModal'
import type { TourBooking } from '../../types/bookings'

const mockBooking: TourBooking = {
  id: 'b-101',
  tourId: 't-202',
  tourTitle: 'Mediterranean Paradise',
  destination: 'Antalya, Turkey',
  hotelName: 'Grand Hyatt Resort',
  heroImage: '/images/tour.jpg',
  startDate: '2026-09-01',
  endDate: '2026-09-08',
  durationDays: 7,
  adultsCount: 2,
  childrenCount: 1,
  guestsCount: 3,
  mealPlan: 'HB',
  totalPrice: 2400,
  currency: 'USD',
  status: 'BOOKED',
  customerEmail: 'alex.smith@example.com',
  documentsUploaded: true,
  guests: [
    { firstName: 'Alex', lastName: 'Smith', email: 'alex.smith@example.com' },
    { firstName: 'Jane', lastName: 'Smith' },
  ],
}

describe('useCheckConfirmModal Hook', () => {
  it('formats customer info, guest summary, and formatted date correctly', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useCheckConfirmModal({ booking: mockBooking, onConfirm })
    )

    expect(result.current.customerName).toBe('Alex Smith')
    expect(result.current.customerEmail).toBe('alex.smith@example.com')
    expect(result.current.guestSummary).toBe('3 Guests (2 Adults, 1 Child)')
    expect(result.current.formattedStartDate).toContain('2026')
    expect(result.current.documentList).toHaveLength(0)
  })

  it('does not manufacture document items when documents are not supplied', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useCheckConfirmModal({ booking: mockBooking, onConfirm })
    )

    expect(result.current.documentList).toEqual([])
  })

  it('uses provided custom documents list if passed', () => {
    const customDocs = [
      { id: '1', name: 'Custom_Doc.pdf', url: '/files/doc.pdf', fileFormat: 'pdf' },
    ]
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useCheckConfirmModal({ booking: mockBooking, documents: customDocs, onConfirm })
    )

    expect(result.current.documentList).toEqual(customDocs)
  })

  it('triggers onConfirm when handleConfirm is called', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useCheckConfirmModal({ booking: mockBooking, onConfirm })
    )

    await act(async () => {
      await result.current.handleConfirm()
    })

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith('b-101')
  })
})
