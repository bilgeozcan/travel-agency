import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toursService } from '@/api/services/tours.service'
import { LoadingProvider } from '@/providers/LoadingContext'
import { AllToursPage } from './AllToursPage'
import type { AllToursPageProps } from './AllToursPage'

vi.mock('@/api/services/tours.service', () => ({
  toursService: {
    getAvailableTours: vi.fn(),
  },
}))

function renderComponent(props: AllToursPageProps = {}, initialEntries: string[] = ['/']) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <LoadingProvider>
        <QueryClientProvider client={testQueryClient}>
          <AllToursPage {...props} />
        </QueryClientProvider>
      </LoadingProvider>
    </MemoryRouter>
  )
}

describe('AllToursPage Component', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    sessionStorage.clear()
  })

  it('renders tour grid when available tours are fetched (Populated State)', async () => {
    vi.mocked(toursService.getAvailableTours).mockResolvedValueOnce({
      tours: [
        {
          id: 't-1',
          name: 'Garden Resort',
          destination: 'Dominican Republic',
          startDate: '2026-05-10',
          durations: ['7 days'],
          mealPlans: ['BB'],
          price: '$1400',
          rating: 5.0,
          reviews: 10,
        },
      ],
      page: 1,
      pageSize: 6,
      totalPages: 1,
      totalItems: 1,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Garden Resort')).toBeInTheDocument()
    })
    expect(screen.getByTestId('tours-grid')).toBeInTheDocument()
  })

  it('renders filter empty state message when no tours match search filters (Empty State)', async () => {
    vi.mocked(toursService.getAvailableTours).mockResolvedValue({
      tours: [],
      page: 1,
      pageSize: 6,
      totalPages: 0,
      totalItems: 0,
    })

    const user = userEvent.setup()
    renderComponent()

    await user.type(screen.getByPlaceholderText('Any destination'), 'NonExistentCity')
    await user.click(screen.getByTestId('filter-search-btn'))

    await waitFor(() => {
      expect(
        screen.getByText('There are no tours with such filters, please change filters')
      ).toBeInTheDocument()
    })
    expect(screen.getByTestId('tours-empty')).toBeInTheDocument()
  })

  it('renders distinct API-error state when API request fails (AC-US4-10)', async () => {
    vi.mocked(toursService.getAvailableTours).mockRejectedValueOnce(new Error('Network response 500 Internal Server Error'))

    renderComponent()

    await waitFor(() => {
      expect(screen.getByTestId('tours-error')).toBeInTheDocument()
    })
    expect(screen.getByText('Unable to load tours')).toBeInTheDocument()
    expect(
      screen.getByText("We couldn't connect to our tour catalog right now. Please check your connection or try again.")
    ).toBeInTheDocument()
    expect(screen.getByTestId('tours-retry-btn')).toBeInTheDocument()
  })

  it('preserves search state from URL query parameters (AC-US4-11)', async () => {
    vi.mocked(toursService.getAvailableTours).mockResolvedValueOnce({
      tours: [],
      page: 1,
      pageSize: 6,
      totalPages: 0,
      totalItems: 0,
    })

    renderComponent({}, ['/?destination=Punta+Cana&page=1&sortBy=PRICE_ASC'])

    await waitFor(() => {
      expect(toursService.getAvailableTours).toHaveBeenCalledWith(
        expect.objectContaining({
          destination: 'Punta Cana',
          page: 1,
          sortBy: 'PRICE_ASC',
        })
      )
    })
  })

  it('shows auth popup when guest tries to book a tour and triggers navigation callbacks', async () => {
    vi.mocked(toursService.getAvailableTours).mockResolvedValueOnce({
      tours: [
        {
          id: 't-guest',
          name: 'Tropical Caribe',
          destination: 'Punta Cana',
          startDate: '2026-05-10',
          durations: ['7 days'],
          mealPlans: ['BB'],
          price: '$1400',
          rating: 5.0,
          reviews: 10,
        },
      ],
      page: 1,
      pageSize: 6,
      totalPages: 1,
      totalItems: 1,
    })

    const user = userEvent.setup()
    const handleNavigateToSignIn = vi.fn()
    const handleNavigateToCreateAccount = vi.fn()

    renderComponent({
      isAuthenticated: false,
      onNavigateToSignIn: handleNavigateToSignIn,
      onNavigateToCreateAccount: handleNavigateToCreateAccount,
    })

    await waitFor(() => {
      expect(screen.getByText('Tropical Caribe')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('book-tour-btn-t-guest'))

    expect(screen.getByTestId('auth-required-popup')).toBeInTheDocument()
    expect(screen.getByText('To book a tour please sign in or create an account')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await user.click(screen.getByRole('button', { name: 'Create an account' }))

    expect(handleNavigateToSignIn).toHaveBeenCalledTimes(1)
    expect(handleNavigateToCreateAccount).toHaveBeenCalledTimes(1)
  })
})

