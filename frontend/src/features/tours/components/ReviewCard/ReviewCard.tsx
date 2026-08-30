import React from 'react'
import userIcon from '@/assets/icons/user.svg'
import { RatingStars } from '@/features/tours/components/RatingStars/RatingStars'
import type { TourReview } from '@/features/tours/types/tours'
import './ReviewCard.css'

export interface ReviewCardProps {
  review: TourReview
}

function formatReviewDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

export const ReviewCard: React.FC<ReviewCardProps> = ({ review }) => {
  return (
    <article className="review-card card" data-testid={`review-card-${review.id}`}>
      <div className="review-card__header">
        <img
          src={review.authorAvatar || userIcon}
          alt=""
          aria-hidden="true"
          className="review-card__avatar"
        />
        <div className="review-card__author">
          <span className="review-card__name">{review.authorName}</span>
          <span className="review-card__date">{formatReviewDate(review.date)}</span>
        </div>
      </div>

      <RatingStars rating={review.rating} />

      <p className="review-card__comment">{review.comment}</p>
    </article>
  )
}
