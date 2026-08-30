import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TourItem } from '@/features/tours/types/tours'
import placeholderTourImage from '@/assets/images/placeholder-tour.svg'
import { TourCard } from './TourCard'

const mockTour: TourItem = {
  id: 'tour-123',
  name: 'Garden Resort & Spa',
  destination: 'Punta Cana, Dominican Republic',
  startDate: '2026-05-10',
  endDate: '2026-05-17',
  imageUrl: 'https://example.com/tour.jpg',
  durations: ['7 days'],
  mealPlans: ['BB', 'AI'],
  price: '$1400 for 1 person',
  rating: 5.0,
  reviews: 19,
  freeCancelation: '2026-12-25',
  tourType: 'RESORT',
}

describe('TourCard Component', () => {
  it('renders tour title, location, image, and price correctly', () => {
    render(<TourCard tour={mockTour} />)

    expect(screen.getByText('Garden Resort & Spa')).toBeInTheDocument()
    expect(screen.getByText('Punta Cana, Dominican Republic')).toBeInTheDocument()
    expect(screen.getByText('$1400 for 1 person')).toBeInTheDocument()
    expect(screen.getByTestId('star-icon')).toBeInTheDocument()
    expect(screen.getByText('5.0')).toBeInTheDocument()
    expect(screen.getByText('19 reviews')).toBeInTheDocument()
    expect(screen.getByText('Free cancellation until December 25')).toBeInTheDocument()
  })

  it('handles See details and Book tour button clicks', async () => {
    const user = userEvent.setup()
    const handleSeeDetails = vi.fn()
    const handleBookTour = vi.fn()

    render(
      <TourCard
        tour={mockTour}
        onSeeDetails={handleSeeDetails}
        onBookTour={handleBookTour}
      />
    )

    await user.click(screen.getByTestId('see-details-btn-tour-123'))
    expect(handleSeeDetails).toHaveBeenCalledWith(mockTour)

    await user.click(screen.getByTestId('book-tour-btn-tour-123'))
    expect(handleBookTour).toHaveBeenCalledWith(mockTour)
  })

  it('displays default text when free cancellation is not available', () => {
    render(<TourCard tour={{ ...mockTour, freeCancelation: null }} />)
    expect(screen.getByText('Free cancellation is not available')).toBeInTheDocument()
  })

  it('handles missing image, zero rating, and missing optional arrays gracefully with default fallbacks', () => {
    const edgeTour: TourItem = {
      ...mockTour,
      imageUrl: '',
      rating: 0,
      reviews: 0,
      durations: [],
      mealPlans: [],
    }

    render(<TourCard tour={edgeTour} />)
    expect(screen.getByText('0.0')).toBeInTheDocument()
    expect(screen.getByText('0 reviews')).toBeInTheDocument()
    expect(screen.getByAltText('Garden Resort & Spa')).toHaveAttribute('src', placeholderTourImage)
  })

  it('renders extremely long tour titles and destinations without breaking component structure', () => {
    const longTour: TourItem = {
      ...mockTour,
      name: 'Super Long Deluxe Grand Luxury Resort Hotel '.repeat(5),
      destination: 'Very Long Destination Name Village Region City State Country '.repeat(3),
    }

    render(<TourCard tour={longTour} />)
    expect(screen.getByText(/Super Long Deluxe Grand Luxury Resort Hotel/i)).toBeInTheDocument()
  })
})
