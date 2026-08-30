import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TourReview } from '@/features/tours/types/tours'
import { ReviewCard } from './ReviewCard'

const mockReview: TourReview = {
  id: 'review-1',
  authorName: 'Anna',
  rating: 5,
  date: '2024-06-08',
  comment: 'Absolutely loved this trip!',
}

describe('ReviewCard Component', () => {
  it('renders author, formatted date, rating and comment', () => {
    render(<ReviewCard review={mockReview} />)

    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('6/8/2024')).toBeInTheDocument()
    expect(screen.getByText('Absolutely loved this trip!')).toBeInTheDocument()
    expect(screen.getByLabelText('5 out of 5 stars')).toBeInTheDocument()
  })
})
