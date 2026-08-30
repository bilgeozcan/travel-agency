import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bookingsService } from '@/api/services/bookings.service'
import { ApiError } from '@/api/client/apiError'
import { useAuth } from '@/providers/AuthContext'
import { useMyBookings } from '../../hooks/useMyBookings'
import type { TourBooking } from '../../types/bookings'
import { MyToursPage } from './MyToursPage'

vi.mock('@/providers/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../hooks/useMyBookings', () => ({
  useMyBookings: vi.fn(),
}))

vi.mock('@/api/services/bookings.service', () => ({
  bookingsService: {
    cancelBooking: vi.fn(),
    updateBooking: vi.fn(),
    submitFeedback: vi.fn(),
    confirmBooking: vi.fn(),
    sendDocumentFeedback: vi.fn(),
    getBookingDocuments: vi.fn().mockResolvedValue([]),
    getDocumentDownloadUrl: vi.fn().mockResolvedValue('https://example.com/doc.pdf'),
    uploadBookingDocuments: vi.fn(),
  },
}))

function makeFile(name: string, size: number, type = 'application/pdf'): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function mockBookingsResult(data: TourBooking[]) {
  vi.mocked(useMyBookings).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useMyBookings>)
}

/**
 * Attaches a file to every field of the open upload modal, which is what
 * unlocks its Save button.
 */
async function fillUploadModal(fieldIds: string[]) {
  // The modal fetches previously uploaded documents on open and rebuilds its
  // fields from the response, so wait for that to settle before attaching.
  await waitFor(() =>
    expect(screen.getByTestId('upload-documents-save-btn')).toHaveTextContent('Save')
  )
  for (const fieldId of fieldIds) {
    fireEvent.click(screen.getByTestId(`upload-field-tab-${fieldId}`))
    fireEvent.drop(screen.getByTestId('upload-documents-dropzone'), {
      dataTransfer: { files: [makeFile(`${fieldId}.pdf`, 1024)] },
    })
    await screen.findByText(`${fieldId}.pdf`)
  }
}

const mockBookings: TourBooking[] = [
  {
    id: 'b-1',
    tourId: 't-1',
    tourTitle: 'Tropical Caribe Hotel',
    destination: 'Punta Cana',
    hotelName: 'Tropical Caribe Hotel',
    heroImage: 'https://example.com/img1.jpg',
    startDate: '2026-08-15',
    endDate: '2026-08-22',
    durationDays: 7,
    adultsCount: 2,
    childrenCount: 0,
    guestsCount: 2,
    guests: [
      { firstName: 'John', lastName: 'Doe' },
      { firstName: 'Jane', lastName: 'Doe' },
    ],
    mealPlan: 'BB',
    totalPrice: 1400,
    currency: 'USD',
    status: 'BOOKED',
    freeCancellationUntilDate: '2026-08-05',
    documentsUploaded: false,
  },
  {
    id: 'b-2',
    tourId: 't-2',
    tourTitle: 'Amalfi Coast Luxury',
    destination: 'Amalfi',
    hotelName: 'Amalfi Resort',
    heroImage: 'https://example.com/img2.jpg',
    startDate: '2026-09-01',
    endDate: '2026-09-08',
    durationDays: 7,
    adultsCount: 1,
    childrenCount: 0,
    guestsCount: 1,
    guests: [{ firstName: 'John', lastName: 'Doe' }],
    mealPlan: 'AI',
    totalPrice: 2000,
    currency: 'USD',
    status: 'CANCELED',
    freeCancellationUntilDate: '',
    documentsUploaded: true,
    canceledBy: 'Customer cancellation',
    cancellationReason: 'Personal reason',
  },
]

describe('MyToursPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u-123', email: 'john@example.com', role: 'Customer' },
      isAuthenticated: true,
      isLoading: false,
      role: 'Customer',
      expiresAt: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      restoreSession: vi.fn(),
      updateUser: vi.fn(),
    })
    vi.mocked(useMyBookings).mockReturnValue({
      data: mockBookings,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)
  })

  const renderPage = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    return render(
      <QueryClientProvider client={queryClient}>
        <MyToursPage />
      </QueryClientProvider>
    )
  }

  it('renders loading state while bookings are fetching', () => {
    vi.mocked(useMyBookings).mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderPage()
    expect(screen.getByText('Loading your bookings...')).toBeInTheDocument()
  })

  it('renders tab bar and all bookings by default', () => {
    renderPage()
    expect(screen.getByText('Tropical Caribe Hotel')).toBeInTheDocument()
    expect(screen.getByText('Amalfi Coast Luxury')).toBeInTheDocument()
  })

  it('filters list when switching to "Booked" tab', () => {
    renderPage()

    const bookedTab = screen.getByRole('tab', { name: 'Booked' })
    fireEvent.click(bookedTab)

    expect(screen.getByText('Tropical Caribe Hotel')).toBeInTheDocument()
    expect(screen.queryByText('Amalfi Coast Luxury')).not.toBeInTheDocument()
  })

  it('filters list when switching to "Canceled" tab', () => {
    renderPage()

    const canceledTab = screen.getByRole('tab', { name: 'Canceled' })
    fireEvent.click(canceledTab)

    expect(screen.queryByText('Tropical Caribe Hotel')).not.toBeInTheDocument()
    expect(screen.getByText('Amalfi Coast Luxury')).toBeInTheDocument()
  })

  it('renders a customer-specific empty state message when no bookings match active tab', () => {
    renderPage()

    const startedTab = screen.getByRole('tab', { name: 'Started' })
    fireEvent.click(startedTab)

    expect(screen.getByText('No started tours found.')).toBeInTheDocument()
  })

  it('renders an assigned-bookings empty state for Travel Agents', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'ta-123', email: 'agent@example.com', role: 'TRAVEL_AGENT' },
      isAuthenticated: true,
      isLoading: false,
      role: 'TRAVEL_AGENT',
      expiresAt: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      restoreSession: vi.fn(),
      updateUser: vi.fn(),
    })
    vi.mocked(useMyBookings).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderPage()

    expect(screen.getByText('No assigned bookings found.')).toBeInTheDocument()
  })

  it('opens CancelBookingModal and triggers cancelBooking service on confirm', async () => {
    vi.mocked(bookingsService.cancelBooking).mockResolvedValueOnce({
      message: 'Booking cancelled',
      refundEligible: true,
    })

    renderPage()

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)

    expect(screen.getByRole('heading', { name: 'Cancel' })).toBeInTheDocument()

    const confirmBtn = screen.getByTestId('confirm-cancel-button')
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(bookingsService.cancelBooking).toHaveBeenCalledWith('b-1')
    })
  })

  it('shows the cancellation penalty returned by the API', async () => {
    vi.mocked(bookingsService.cancelBooking).mockResolvedValueOnce({
      message: 'Booking cancelled',
      refundEligible: false,
      penaltyAmount: 350,
    })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByTestId('confirm-cancel-button'))

    expect(await screen.findByText('Booking canceled. A $350 cancellation penalty applies.')).toBeInTheDocument()
  })

  it('shows a clear conflict message when confirmation loses a concurrent update', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'ta-123', email: 'agent@example.com', role: 'TRAVEL_AGENT' },
      isAuthenticated: true,
      isLoading: false,
      role: 'TRAVEL_AGENT',
      expiresAt: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      restoreSession: vi.fn(),
      updateUser: vi.fn(),
    })
    vi.mocked(bookingsService.confirmBooking).mockRejectedValueOnce(
      new ApiError(
        { code: 'BOOKING_STATE_CONFLICT', message: 'Booking cannot be confirmed while it is in CANCELED state' },
        409
      )
    )

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /check (and|&) confirm/i }))
    fireEvent.click(screen.getByTestId('confirm-booking-button'))

    expect(
      await screen.findByText('This booking was canceled or changed before it could be confirmed. Please refresh and review its current status.')
    ).toBeInTheDocument()
  })

  it('opens FeedbackModal when clicking "Give feedback" on a Started or Finished tour booking', () => {
    const mockStartedBooking: TourBooking = {
      ...mockBookings[0],
      id: 'b-3',
      status: 'STARTED',
    }
    vi.mocked(useMyBookings).mockReturnValue({
      data: [mockStartedBooking],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    renderPage()

    const giveFeedbackBtn = screen.getByRole('button', { name: 'Give feedback' })
    expect(giveFeedbackBtn).toBeInTheDocument()

    fireEvent.click(giveFeedbackBtn)

    expect(screen.getByTestId('feedback-modal-content')).toBeInTheDocument()
    expect(screen.getByTestId('feedback-rating-label')).toHaveTextContent('Please rate your experience*')
  })

  it('submits feedback via bookingsService.submitFeedback and displays success toast on submit', async () => {
    const mockStartedBooking: TourBooking = {
      ...mockBookings[0],
      id: 'b-3',
      tourId: 't-3',
      status: 'STARTED',
    }
    vi.mocked(useMyBookings).mockReturnValue({
      data: [mockStartedBooking],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)
    vi.mocked(bookingsService.submitFeedback).mockResolvedValueOnce({
      id: 'fb-100',
      bookingId: 'b-3',
      tourId: 't-3',
      rating: 5,
      comment: 'Awesome tour',
    })

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Give feedback' }))
    fireEvent.click(screen.getByTestId('feedback-star-5'))
    fireEvent.change(screen.getByTestId('feedback-comment-input'), { target: { value: 'Awesome tour' } })
    fireEvent.click(screen.getByTestId('feedback-submit-btn'))

    await waitFor(() => {
      expect(bookingsService.submitFeedback).toHaveBeenCalledWith('t-3', 'b-3', 5, 'Awesome tour', false)
    })
    expect(await screen.findByText('Your feedback has been submitted successfully')).toBeInTheDocument()
  })

  it('updates feedback via bookingsService.submitFeedback with isUpdate true and displays updated success toast', async () => {
    const mockFeedbackBooking: TourBooking = {
      ...mockBookings[0],
      id: 'b-4',
      tourId: 't-4',
      status: 'FINISHED',
      hasFeedback: true,
      feedback: {
        rating: 4,
        comment: 'Good experience',
      },
    }
    vi.mocked(useMyBookings).mockReturnValue({
      data: [mockFeedbackBooking],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any)
    vi.mocked(bookingsService.submitFeedback).mockResolvedValueOnce({
      id: 'fb-101',
      bookingId: 'b-4',
      tourId: 't-4',
      rating: 5,
      comment: 'Updated awesome tour',
    })

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Update feedback' }))
    fireEvent.click(screen.getByTestId('feedback-star-5'))
    fireEvent.change(screen.getByTestId('feedback-comment-input'), { target: { value: 'Updated awesome tour' } })
    fireEvent.click(screen.getByTestId('feedback-submit-btn'))

    await waitFor(() => {
      expect(bookingsService.submitFeedback).toHaveBeenCalledWith('t-4', 'b-4', 5, 'Updated awesome tour', true)
    })
    expect(await screen.findByText('Your feedback has been updated successfully')).toBeInTheDocument()
  })

  describe('document upload', () => {
    const bookedBooking = mockBookings[0]

    beforeEach(() => {
      vi.mocked(bookingsService.getBookingDocuments).mockResolvedValue([])
      mockBookingsResult([bookedBooking])
    })

    it('labels the card action "Upload documents" while nothing is uploaded', () => {
      renderPage()
      expect(screen.getByRole('button', { name: 'Upload documents' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Update documents' })).not.toBeInTheDocument()
    })

    it('labels the card action "Update documents" once documents exist', () => {
      mockBookingsResult([{ ...bookedBooking, documentsUploaded: true }])

      renderPage()

      expect(screen.getByRole('button', { name: 'Update documents' })).toBeInTheDocument()
    })

    it('uploads the documents, shows the success toast and flips the card to "Update documents"', async () => {
      vi.mocked(bookingsService.uploadBookingDocuments).mockResolvedValueOnce(undefined)

      renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'Upload documents' }))
      await fillUploadModal(['passport-0', 'passport-1', 'payment-confirmation'])

      fireEvent.click(screen.getByTestId('upload-documents-save-btn'))

      await waitFor(() =>
        expect(bookingsService.uploadBookingDocuments).toHaveBeenCalledWith(
          'b-1',
          expect.any(Array),
          expect.any(Array),
          expect.any(Function)
        )
      )
      expect(
        await screen.findByText('Your documents have been uploaded successfully')
      ).toBeInTheDocument()
      expect(await screen.findByRole('button', { name: 'Update documents' })).toBeInTheDocument()
    })

    it('shows the updated-successfully toast when the booking already had documents', async () => {
      vi.mocked(bookingsService.uploadBookingDocuments).mockResolvedValueOnce(undefined)
      mockBookingsResult([{ ...bookedBooking, documentsUploaded: true }])

      renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'Update documents' }))
      await fillUploadModal(['passport-0', 'passport-1', 'payment-confirmation'])

      fireEvent.click(screen.getByTestId('upload-documents-save-btn'))

      expect(
        await screen.findByText('Your documents have been updated successfully')
      ).toBeInTheDocument()
    })

    it('keeps the modal open with an error toast when the upload fails, so the user can retry', async () => {
      vi.mocked(bookingsService.uploadBookingDocuments).mockRejectedValueOnce(
        new Error('Network request failed')
      )

      renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'Upload documents' }))
      await fillUploadModal(['passport-0', 'passport-1', 'payment-confirmation'])

      fireEvent.click(screen.getByTestId('upload-documents-save-btn'))

      expect(await screen.findByText('Network request failed')).toBeInTheDocument()
      expect(screen.getByTestId('upload-documents-body')).toBeInTheDocument()
      await waitFor(() =>
        expect(screen.getByTestId('upload-documents-save-btn')).toBeEnabled()
      )
    })
  })
})
