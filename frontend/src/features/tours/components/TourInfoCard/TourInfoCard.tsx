import React from 'react'
import type { TourDetail } from '@/features/tours/types/tours'
import { formatMealPlanLabel } from '@/utils/toursValidation'
import './TourInfoCard.css'

export interface TourInfoCardProps {
  tour: TourDetail
}

export const TourInfoCard: React.FC<TourInfoCardProps> = ({ tour }) => {
  const mealPlans = tour.availableMealPlans ?? []
  const allowedDurations = tour.allowedDurations ?? []
  const guideLanguages = tour.guideLanguages ?? []
  const cancellationPolicy = tour.cancellationPolicy ?? { description: 'Standard cancellation policy' }

  const mealPlansLabel = mealPlans.map((code) => formatMealPlanLabel(code)).join(', ')
  const durationsLabel = allowedDurations.map((d) => `${d} days`).join(', ')
  const guideLanguagesLabel = guideLanguages.length > 0 ? guideLanguages.join(', ') : 'Not specified'

  return (
    <section className="tour-info-card card" data-testid="tour-info-card">
      {tour.hotelDescription && <p className="tour-info-card__spot-sentence">{tour.hotelDescription}</p>}

      <h2 className="text-title tour-info-card__heading">About the tour</h2>

      <dl className="tour-info-card__list">
        <div className="tour-info-card__item">
          <dt>Hotel</dt>
          <dd>{tour.hotelName || 'Not specified'}</dd>
        </div>

        <div className="tour-info-card__item">
          <dt>Tour dates</dt>
          <dd>
            {tour.availableStartDates && tour.availableStartDates.length > 0
              ? `${tour.availableStartDates[0]}${tour.allowedDurations && tour.allowedDurations.length > 0 ? ` (${tour.allowedDurations.join('/')} days available)` : ''}`
              : 'Dates upon request'}
          </dd>
        </div>

        <div className="tour-info-card__item">
          <dt>Price per person</dt>
          <dd>${tour.basePricePerPerson}</dd>
        </div>

        <div className="tour-info-card__item">
          <dt>Free cancellation policy</dt>
          <dd>{cancellationPolicy.description}</dd>
        </div>

        <div className="tour-info-card__item">
          <dt>Duration</dt>
          <dd>{durationsLabel || 'Not specified'}</dd>
        </div>

        <div className="tour-info-card__item">
          <dt>Accommodation</dt>
          <dd>{tour.accommodationDescription || 'Standard accommodation'}</dd>
        </div>

        <div className="tour-info-card__item">
          <dt>Meal plans</dt>
          <dd>{mealPlansLabel || 'Not specified'}</dd>
        </div>

        <div className="tour-info-card__item">
          <dt>Tourguide</dt>
          <dd>{guideLanguagesLabel}</dd>
        </div>

        <div className="tour-info-card__item">
          <dt>Transfer</dt>
          <dd>{tour.transferInfo || 'Not included'}</dd>
        </div>

        <div className="tour-info-card__item">
          <dt>Small group</dt>
          <dd>{tour.maxParticipants !== undefined ? `Maximum number of participants: ${tour.maxParticipants}` : 'Not specified'}</dd>
        </div>
      </dl>
    </section>
  )
}
