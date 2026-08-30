import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RatingStars } from './RatingStars'

describe('RatingStars Component', () => {
  it('renders 5 star icons with an accessible label', () => {
    render(<RatingStars rating={4.7} />)
    expect(screen.getByLabelText('4.7 out of 5 stars')).toBeInTheDocument()
  })

  it('marks rounded number of stars as filled', () => {
    render(<RatingStars rating={3.6} />)
    const stars = screen.getByTestId('rating-stars').querySelectorAll('img')
    expect(stars).toHaveLength(5)
    const filledCount = Array.from(stars).filter((star) =>
      star.className.includes('rating-stars__icon--filled')
    ).length
    expect(filledCount).toBe(4)
  })
})
