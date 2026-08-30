import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toursService } from '@/api/services/tours.service'
import { ReviewsSection } from './ReviewsSection'

vi.mock('@/api/services/tours.service', () => ({
  toursService: {
    getTourReviews: vi.fn(),
  },
}))

function renderComponent() {
  const testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  return render(
    <QueryClientProvider client={testQueryClient}>
      <ReviewsSection tourId="tour-2" />
    </QueryClientProvider>
  )
}

describe('ReviewsSection Component', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders reviews returned from the service', async () => {
    vi.mocked(toursService.getTourReviews).mockResolvedValueOnce({
      reviews: [
        { id: 'r1', authorName: 'Anna', rating: 5, date: '2024-06-08', comment: 'Loved it!' },
      ],
    })

    renderComponent()

    await waitFor(() => expect(screen.getByText('Anna')).toBeInTheDocument())
    expect(screen.getByText('Loved it!')).toBeInTheDocument()
  })

  it('shows the empty state when there are no reviews', async () => {
    vi.mocked(toursService.getTourReviews).mockResolvedValueOnce({ reviews: [] })

    renderComponent()

    await waitFor(() =>
      expect(screen.getByText('No reviews about this trip yet')).toBeInTheDocument()
    )
  })

  it('re-fetches reviews when sort option changes', async () => {
    const user = userEvent.setup()
    vi.mocked(toursService.getTourReviews).mockResolvedValue({
      reviews: [
        { id: 'r1', authorName: 'Anna', rating: 5, date: '2024-06-08', comment: 'Loved it!' },
      ],
    })

    renderComponent()
    await waitFor(() => expect(screen.getByText('Anna')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Sort by:' }))
    await user.click(screen.getByRole('option', { name: 'Newest first' }))

    await waitFor(() =>
      expect(toursService.getTourReviews).toHaveBeenCalledWith('tour-2', 'NEWEST', 1, 4)
    )
  })

  it('renders fallback error message when fetching reviews fails', async () => {
    vi.mocked(toursService.getTourReviews).mockRejectedValueOnce(new Error('API failure'))

    renderComponent()

    await waitFor(() =>
      expect(screen.getByText('Reviews could not be loaded')).toBeInTheDocument()
    )
  })
})
