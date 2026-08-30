import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../client/apiClient'
import { bookingsService } from './bookings.service'
import type { UpdateBookingRequest } from '@/features/bookings/types/bookings'

vi.mock('../client/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('bookingsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('validateBooking posts payload and returns validation response', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { isValid: true, bookingToken: 'tok-123' },
    } as any)

    const payload = {
      packageId: 'p1',
      startDate: '2026-05-10',
      duration: '7 days',
      guestCount: 2,
      quotedPrice: 1400,
    }

    const res = await bookingsService.validateBooking(payload)

    expect(apiClient.post).toHaveBeenCalledWith('/bookings/validate', payload)
    expect(res.bookingToken).toBe('tok-123')
  })

  it('validateBooking throws error when response data is missing', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(null as any)

    await expect(
      bookingsService.validateBooking({
        packageId: 'p1',
        startDate: '2026-05-10',
        duration: '7 days',
        guestCount: 2,
        quotedPrice: 1400,
      })
    ).rejects.toThrow('Failed to validate booking availability')
  })

  it('createBooking posts correctly formatted request payload', async () => {
    const mockResponse = {
      data: {
        freeCancelation: '2025-01-05',
        details: 'You have successfully booked...',
      },
    }
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse as any)

    const payload = {
      tourId: 'tour-1',
      date: '2025-01-15',
      duration: '7 days',
      mealPlan: 'BB' as const,
      guests: { adult: 2, children: 1 },
      personalDetails: [{ firstName: 'John', lastName: 'Doe' }],
    }

    const result = await bookingsService.createBooking(payload)

    expect(apiClient.post).toHaveBeenCalledWith('/bookings', payload)
    expect(result.freeCancelation).toBe('2025-01-05')
  })

  it('createBooking throws error when data is missing', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(null as any)

    await expect(
      bookingsService.createBooking({
        tourId: 't1',
        date: '2025-01-15',
        duration: '7 days',
        mealPlan: 'BB',
        guests: { adult: 1, children: 0 },
        personalDetails: [],
      })
    ).rejects.toThrow('Failed to create booking')
  })

  it('getUserBookings fetches and maps backend bookings', async () => {
    const mockDtoList = [
      {
        id: 'b1',
        userId: 'u1',
        tourId: 't1',
        state: 'BOOKED',
        name: 'Hotel Alpha',
        destination: 'Miami',
        tourDetails: {
          date: '2025-02-01 (7 days)',
          mealPlan: 'HB',
          guests: '2 adults',
          totalPrice: '$1200',
        },
      },
    ]
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { bookings: mockDtoList } } as any)

    const bookings = await bookingsService.getUserBookings()

    expect(apiClient.get).toHaveBeenCalledWith('/bookings')
    expect(bookings).toHaveLength(1)
    expect(bookings[0]?.tourTitle).toBe('Hotel Alpha')
    expect(bookings[0]?.totalPrice).toBe(1200)
  })

  it('updateBooking puts payload and maps updated booking', async () => {
    const mockUpdatedDto = {
      id: 'b1',
      name: 'Updated Hotel',
      tourDetails: { date: '2025-03-01 (5 days)' },
    }
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockUpdatedDto } as any)

    const updatePayload: UpdateBookingRequest = {
      duration: '5 days',
      mealPlan: 'BB',
      guests: { adult: 1, children: 0 },
      personalDetails: [{ firstName: 'John', lastName: 'Doe' }],
    }

    const result = await bookingsService.updateBooking('b1', updatePayload)

    expect(apiClient.put).toHaveBeenCalledWith('/bookings/b1', updatePayload)
    expect(result.tourTitle).toBe('Updated Hotel')
  })

  it('cancelBooking sends DELETE request to /bookings/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      data: { message: 'Booking cancelled successfully', refundEligible: true },
    } as any)

    const res = await bookingsService.cancelBooking('b1')

    expect(apiClient.delete).toHaveBeenCalledWith('/bookings/b1')
    expect(res.refundEligible).toBe(true)
  })

  it('cancelBooking sends the travel-agent cancellation reason using the API field name', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      data: { message: 'Booking cancelled successfully', refundEligible: false },
    } as any)

    await bookingsService.cancelBooking('b1', 'Safety Concerns')

    expect(apiClient.delete).toHaveBeenCalledWith('/bookings/b1', {
      cancelReason: 'Safety Concerns',
    })
  })

  it('sendDocumentFeedback posts reason field to /bookings/:id/reject-documents', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { message: 'Documents rejected and customer notified' },
    } as any)

    const result = await bookingsService.sendDocumentFeedback('b1', 'Missing passport copy')

    expect(apiClient.post).toHaveBeenCalledWith('/bookings/b1/reject-documents', {
      reason: 'Missing passport copy',
    })
    expect(result.success).toBe(true)
  })

  it('uploads each new file with its document classification', async () => {
    const file = new File(['passport'], 'passport.pdf', { type: 'application/pdf' })
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { document: { id: 'd1', name: 'passport.pdf', fileFormat: 'PDF' }, uploadUrl: 'https://upload.example.com/d1' },
    } as any)
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: {} } as any)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    await bookingsService.uploadBookingDocuments('b1', [{
      fieldId: 'passport-0',
      label: 'Passport Ada Lovelace',
      documentType: 'PASSPORT',
      guestIndex: 0,
      files: [{ id: 'new-1', name: 'passport.pdf', size: file.size, file }],
    }])

    expect(apiClient.post).toHaveBeenCalledWith('/bookings/b1/documents', {
      name: 'passport.pdf',
      fileFormat: 'PDF',
      contentType: 'application/pdf',
      documentType: 'PASSPORT',
      guestIndex: 0,
    })
    vi.unstubAllGlobals()
  })

  it('submitFeedback posts rating and comment to /tours/:tourId/feedbacks?bookingId=:bookingId', async () => {
    const mockFeedbackResponse = {
      id: 'fb-1',
      bookingId: 'b1',
      tourId: 't1',
      rating: 5,
      comment: 'Great trip!',
    }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockFeedbackResponse } as any)

    const res = await bookingsService.submitFeedback('t1', 'b1', 5, 'Great trip!')

    expect(apiClient.post).toHaveBeenCalledWith('/tours/t1/feedbacks?bookingId=b1', {
      rating: 5,
      comment: 'Great trip!',
    })
    expect(res.id).toBe('fb-1')
    expect(res.rating).toBe(5)
  })

  it('submitFeedback omits comment from payload when comment is whitespace only', async () => {
    const mockFeedbackResponse = {
      id: 'fb-2',
      bookingId: 'b1',
      tourId: 't1',
      rating: 4,
    }
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockFeedbackResponse } as any)

    const res = await bookingsService.submitFeedback('t1', 'b1', 4, '    \n  ')

    expect(apiClient.post).toHaveBeenCalledWith('/tours/t1/feedbacks?bookingId=b1', {
      rating: 4,
    })
    expect(res.id).toBe('fb-2')
  })

  it('submitFeedback puts rating and comment to /tours/:tourId/feedbacks?bookingId=:bookingId when isUpdate is true', async () => {
    const mockFeedbackResponse = {
      id: 'fb-update-1',
      bookingId: 'b1',
      tourId: 't1',
      rating: 4,
      comment: 'Updated review comments',
    }
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockFeedbackResponse } as any)

    const res = await bookingsService.submitFeedback('t1', 'b1', 4, 'Updated review comments', true)

    expect(apiClient.put).toHaveBeenCalledWith('/tours/t1/feedbacks?bookingId=b1', {
      rating: 4,
      comment: 'Updated review comments',
    })
    expect(res.id).toBe('fb-update-1')
    expect(res.rating).toBe(4)
  })

  it('updateFeedback delegates to submitFeedback with isUpdate set to true', async () => {
    const mockFeedbackResponse = {
      id: 'fb-update-2',
      bookingId: 'b2',
      tourId: 't2',
      rating: 5,
    }
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockFeedbackResponse } as any)

    const res = await bookingsService.updateFeedback('t2', 'b2', 5)

    expect(apiClient.put).toHaveBeenCalledWith('/tours/t2/feedbacks?bookingId=b2', {
      rating: 5,
    })
    expect(res.id).toBe('fb-update-2')
  })

  it('submitFeedback throws error when response data is missing', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce(null as any)

    await expect(bookingsService.submitFeedback('t1', 'b1', 5)).rejects.toThrow(
      'Failed to submit feedback for tour t1'
    )
  })
})
