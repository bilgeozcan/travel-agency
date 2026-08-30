import React from 'react'
import calendarIcon from '@/assets/icons/Calendar.svg'
import locationIcon from '@/assets/icons/Location.svg'
import mealIcon from '@/assets/icons/Meal.svg'
import starIcon from '@/assets/icons/Star.svg'
import successCheckIcon from '@/assets/icons/success-check-withoutbg.svg'
import walletIcon from '@/assets/icons/Wallet.svg'
import placeholderTourImage from '@/assets/images/placeholder-tour.svg'
import { Button } from '@/components/ui/Button/Button'
import type { TourItem } from '@/features/tours/types/tours'
import { formatCancellationInfo, formatMealPlanLabel, formatTourDateRange } from '@/utils/toursValidation'
import './TourCard.css'

export interface TourCardProps {
  tour: TourItem
  onSeeDetails?: (tour: TourItem) => void
  onBookTour?: (tour: TourItem) => void
}

const DEFAULT_TOUR_IMAGE = placeholderTourImage

export const TourCard: React.FC<TourCardProps> = ({
  tour,
  onSeeDetails,
  onBookTour,
}) => {
  const { available: isFreeCancelAvailable, text: cancellationText } = formatCancellationInfo(tour.freeCancelation)

  const formattedMealPlan = tour.mealPlans && tour.mealPlans.length > 0
    ? tour.mealPlans.map((mp) => formatMealPlanLabel(mp)).join(', ')
    : 'Not specified'

  const formattedDurations = tour.durations && tour.durations.length > 0
    ? `(${tour.durations.join(', ')})`
    : ''

  const dateRangeText = formatTourDateRange(tour.startDate, tour.endDate)
  const formattedDateRange = `${dateRangeText} ${formattedDurations}`.trim()

  const cleanPrice = tour.price ? tour.price.replace(/^from\s+/i, '') : ''
  const displayPrice = cleanPrice.toLowerCase().includes('for 1 person')
    ? cleanPrice
    : `${cleanPrice} for 1 person`

  return (
    <article className="tour-card" data-testid={`tour-card-${tour.id}`}>
      {/* Left Column: Big Tour Picture */}
      <div className="tour-card__image-wrapper tour-card-image-col">
        <img
          src={tour.imageUrl || DEFAULT_TOUR_IMAGE}
          alt={tour.name}
          className="tour-card__image tour-card-image"
          loading="lazy"
          onError={(e) => {
            ; (e.target as HTMLImageElement).src = DEFAULT_TOUR_IMAGE
          }}
        />
      </div>

      {/* Right Column: Content Area */}
      <div className="tour-card__content tour-card-details-col">
        {/* Top Header: Title & Rating side by side */}
        <div className="tour-card__header tour-card-header-row">
          <div className="tour-card__title-group">
            <h3
              className="tour-card__title tour-card-title tour-card-title--clickable"
              onClick={() => onSeeDetails?.(tour)}
              data-testid={`tour-title-${tour.id}`}
            >
              {tour.name}
            </h3>
            {/* Location */}
            <p className="tour-card__location tour-card-location">
              <img src={locationIcon} alt="" className="icon location-icon" aria-hidden="true" />
              <span>{tour.destination}</span>
            </p>
          </div>
          <div className="tour-card__rating tour-card-rating">
            <div className="rating-score">
              <img src={starIcon} alt="star" className="star-icon" data-testid="star-icon" />
              <span>{tour.rating.toFixed(1)}</span>
            </div>
            <span className="reviews-count">{tour.reviews} reviews</span>
          </div>
        </div>

        {/* Details List */}
        <div className="tour-card__details tour-card-meta-list">
          <div className="detail-item meta-item">
            <img src={calendarIcon} alt="" className="icon meta-icon" aria-hidden="true" />
            <span className="meta-text">{formattedDateRange}</span>
          </div>

          <div className="detail-item meta-item">
            <img src={mealIcon} alt="" className="icon meta-icon" aria-hidden="true" />
            <span className="meta-text">{formattedMealPlan}</span>
          </div>

          <div className="detail-item meta-item">
            <img src={walletIcon} alt="" className="icon meta-icon" aria-hidden="true" />
            <span className="meta-text">
              <strong>{displayPrice}</strong>
            </span>
          </div>

          <div className={`detail-item meta-item cancellation-item ${isFreeCancelAvailable ? 'detail-item--success free-cancel' : 'no-cancel'}`}>
            {isFreeCancelAvailable ? (
              <img src={successCheckIcon} alt="" className="icon meta-icon" aria-hidden="true" />
            ) : (
              <span className="meta-icon icon cancel-check">✕</span>
            )}
            <span className="meta-text">{cancellationText}</span>
          </div>
        </div>

        {/* Action Buttons Container */}
        <div className="tour-card__actions tour-card-actions">
          <Button
            variant="outline"
            fullWidth={false}
            className="tour-card-action-btn tour-card-action-btn--details"
            onClick={() => onSeeDetails?.(tour)}
            data-testid={`see-details-btn-${tour.id}`}
          >
            See details
          </Button>
          <Button
            variant="primary"
            fullWidth={false}
            className="tour-card-action-btn tour-card-action-btn--book"
            onClick={() => onBookTour?.(tour)}
            data-testid={`book-tour-btn-${tour.id}`}
          >
            Book the tour
          </Button>
        </div>
      </div>
    </article>
  )
}
