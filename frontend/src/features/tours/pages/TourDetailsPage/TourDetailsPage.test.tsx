import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toursService } from '@/api/services/tours.service'
import type { TourDetail } from '@/features/tours/types/tours'
import { TourDetailsPage } from './TourDetailsPage'

vi.mock('@/api/services/tours.service', () => ({
  toursService: {
    getTourById: vi.fn(),
    getTourReviews: vi.fn(),
  },
}))

const mockTour: TourDetail = {
  id: 'tour-1',
  title: 'Garden Resort & Spa',
  destination: 'Punta Cana, Dominican Republic',
  hotelName: 'Garden Resort & Spa Punta Cana',
  hotelDescription: 'Luxury beach resort',
  rating: 5,
  reviewsCount: 19,
  heroImages: ['https://example.com/img1.jpg'],
  basePricePerPerson: 1400,
  availableStartDates: ['2026-05-10'],
  allowedDurations: [7, 10],
  maxParticipants: 6,
  availableMealPlans: ['BB', 'AI'],
  cancellationPolicy: {
    freeCancellationUntilDays: 15,
    description: 'Free cancellation up to 15 days before start date',
  },
  accommodationDescription: '5-star Luxury Resort Suite',
  guideLanguages: ['English', 'Spanish'],
  transferInfo: 'Included round-trip airport transfer',
  isFullyBooked: false,
}

describe('TourDetailsPage Edge Cases & Acceptance Criteria', () => {
  const mockNavigateToMainPage = vi.fn()
  const mockNavigateToSignIn = vi.fn()
  const mockNavigateToCreateAccount = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(toursService.getTourById).mockResolvedValue(mockTour)
    vi.mocked(toursService.getTourReviews).mockResolvedValue({
      reviews: [],
      page: 1,
      pageSize: 4,
      totalPages: 0,
      totalItems: 0,
    })
  })

  const renderPage = (isAuthenticated = false, tourId = 'tour-1') => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    return render(
      <QueryClientProvider client={queryClient}>
        <TourDetailsPage
          tourId={tourId}
          isAuthenticated={isAuthenticated}
          onNavigateToMainPage={mockNavigateToMainPage}
          onNavigateToSignIn={mockNavigateToSignIn}
          onNavigateToCreateAccount={mockNavigateToCreateAccount}
        />
      </QueryClientProvider>
    )
  }

  describe('Edge Case 1: Loading & Error States', () => {
    it('shows PageLoader while tour details are fetching', () => {
      vi.mocked(toursService.getTourById).mockReturnValue(new Promise(() => {}))
      renderPage()
      expect(screen.getByText('Loading tour details...')).toBeInTheDocument()
    })

    it('renders error state and handles "All tours" navigation click on API failure', async () => {
      const user = userEvent.setup()
      vi.mocked(toursService.getTourById).mockRejectedValue(new Error('Network error'))

      renderPage()

      await waitFor(() => {
        expect(screen.getByTestId('tour-details-error')).toBeInTheDocument()
      })
      expect(screen.getByText('Page could not be loaded')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /all tours/i }))
      expect(mockNavigateToMainPage).toHaveBeenCalledTimes(1)
    })

    it('renders error state when tour data is null or empty', async () => {
      vi.mocked(toursService.getTourById).mockResolvedValue(null as any)

      renderPage()

      await waitFor(() => {
        expect(screen.getByTestId('tour-details-error')).toBeInTheDocument()
      })
    })
  })

  describe('Edge Case 2: Guest Authentication Popup Flow', () => {
    it('opens AuthRequiredPopup when unauthenticated user attempts to book a tour', async () => {
      const user = userEvent.setup()
      vi.mocked(toursService.getTourById).mockResolvedValue(mockTour)

      renderPage(false)

      await waitFor(() => {
        expect(screen.getAllByText('Garden Resort & Spa').length).toBeGreaterThan(0)
      })

      const bookBtn = screen.getByTestId('book-tour-cta')
      await user.click(bookBtn)

      expect(screen.getByTestId('auth-required-popup')).toBeInTheDocument()
    })

    it('triggers success toast directly when authenticated user clicks book button', async () => {
      const user = userEvent.setup()
      vi.mocked(toursService.getTourById).mockResolvedValue(mockTour)

      renderPage(true)

      await waitFor(() => {
        expect(screen.getAllByText('Garden Resort & Spa').length).toBeGreaterThan(0)
      })

      const bookBtn = screen.getByTestId('book-tour-cta')
      await user.click(bookBtn)

      expect(screen.queryByTestId('auth-required-popup')).not.toBeInTheDocument()
      expect(screen.getByTestId('booking-modal')).toBeInTheDocument()
    })
  })

  describe('Edge Case 3: Partial or Empty Tour Metadata Fallbacks', () => {
    it('renders safe fallback text for missing optional properties (destination, guideLanguages, transfer)', async () => {
      const incompleteTour: TourDetail = {
        ...mockTour,
        destination: undefined,
        guideLanguages: [],
        transferInfo: '',
        accommodationDescription: '',
        allowedDurations: [],
        availableMealPlans: [],
      }
      vi.mocked(toursService.getTourById).mockResolvedValue(incompleteTour)

      renderPage()

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: 'Garden Resort & Spa' })).toBeInTheDocument()
      })

      expect(screen.getAllByText('Not specified').length).toBeGreaterThan(0) // Guide languages, meal plans, hotel fallback
      expect(screen.getByText('Not included')).toBeInTheDocument() // Transfer info fallback
      expect(screen.getByText('Standard accommodation')).toBeInTheDocument() // Accommodation fallback
    })
  })
})
