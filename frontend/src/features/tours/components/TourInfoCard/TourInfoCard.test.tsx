import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TourDetail } from '@/features/tours/types/tours'
import { TourInfoCard } from './TourInfoCard'

const mockTourDetail: TourDetail = {
  id: 'tour-2',
  title: 'A guided hike in the Dolomites',
  hotelName: 'Dolomites Guided Hike',
  hotelDescription: 'Experience the excitement among the wonders of the Brenta Dolomites!',
  rating: 4.73,
  reviewsCount: 42,
  heroImages: ['/img1.jpg'],
  basePricePerPerson: 1400,
  availableStartDates: ['2026-06-01'],
  allowedDurations: [7, 10, 12],
  maxParticipants: 8,
  availableMealPlans: ['BB', 'HB', 'FB'],
  cancellationPolicy: {
    freeCancellationUntilDays: 14,
    description: 'Free cancellation until January 5',
  },
  accommodationDescription: 'Cozy mountain huts with stunning views.',
  guideLanguages: ['Italian', 'English'],
  transferInfo: 'Organized transfer from Milan airport.',
  isFullyBooked: false,
}

describe('TourInfoCard Component', () => {
  it('renders all tour info sections', () => {
    render(<TourInfoCard tour={mockTourDetail} />)

    expect(screen.getByText('About the tour')).toBeInTheDocument()
    expect(screen.getByText('Free cancellation until January 5')).toBeInTheDocument()
    expect(screen.getByText('7 days, 10 days, 12 days')).toBeInTheDocument()
    expect(screen.getByText('Cozy mountain huts with stunning views.')).toBeInTheDocument()
    expect(screen.getByText('Italian, English')).toBeInTheDocument()
    expect(screen.getByText('Organized transfer from Milan airport.')).toBeInTheDocument()
    expect(screen.getByText('Maximum number of participants: 8')).toBeInTheDocument()
  })
})
