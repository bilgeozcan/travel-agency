import React from 'react'
import starIcon from '@/assets/icons/Star.svg'
import './RatingStars.css'

export interface RatingStarsProps {
  rating: number
  maxStars?: number
  size?: 'sm' | 'md'
}

export const RatingStars: React.FC<RatingStarsProps> = ({ rating, maxStars = 5, size = 'sm' }) => {
  const filledStars = Math.round(rating)

  return (
    <div className={`rating-stars rating-stars--${size}`} data-testid="rating-stars" aria-label={`${rating} out of ${maxStars} stars`}>
      {Array.from({ length: maxStars }, (_, index) => (
        <img
          key={index}
          src={starIcon}
          alt=""
          aria-hidden="true"
          className={`rating-stars__icon ${index < filledStars ? 'rating-stars__icon--filled' : 'rating-stars__icon--empty'}`}
        />
      ))}
    </div>
  )
}
