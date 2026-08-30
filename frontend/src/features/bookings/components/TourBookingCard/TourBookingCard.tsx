import React from 'react'
import calendarIcon from '@/assets/icons/Calendar.svg'
import locationIcon from '@/assets/icons/Location.svg'
import mealIcon from '@/assets/icons/Meal.svg'
import peopleIcon from '@/assets/icons/People.svg'
import walletIcon from '@/assets/icons/Wallet.svg'
import placeholderTourImage from '@/assets/images/hero-beach.jpg'
import type { TourBookingCardProps } from './TourBookingCard.types'
import { BookingStepper } from '@/components/ui/BookingStepper/BookingStepper'
import { isCanceledStatus } from '../../utils/bookingStatusMapper'
import './TourBookingCard.css'

export type { TourBookingCardProps }

export const TourBookingCard: React.FC<TourBookingCardProps> = ({
  status,
  tourTitle,
  tourLocation,
  tourImageUrls,
  dateRange,
  mealPlan,
  guestsText,
  totalPrice,
  cancellationDetails,
  documentRejectionReason,
  sideInfo,
  actions,
}) => {
  const isCanceled = isCanceledStatus(status)
  const heroImage = tourImageUrls?.[0] || placeholderTourImage

  return (
    <div className="tour-booking-card" data-testid="tour-booking-card">
      {/* Stepper Header Container */}
      <div className="tour-booking-stepper-container">
        <BookingStepper status={status} />
      </div>

      {/* Main Card Header: Image & Title */}
      <div className="tour-booking-header">
        <div className="tour-booking-thumb-wrapper">
          <img
            src={heroImage}
            alt={tourTitle}
            className="tour-booking-thumb"
            onError={(e) => {
              const target = e.currentTarget
              if (target.src !== DEFAULT_FALLBACK_IMAGE) {
                target.src = DEFAULT_FALLBACK_IMAGE
              }
            }}
          />
        </div>
        <div className="tour-booking-header-info">
          <h3 className="tour-booking-title">{tourTitle}</h3>
          <div className="tour-booking-location-row">
            <img src={locationIcon} alt="" aria-hidden="true" width="12" height="12" />
            <span>{tourLocation}</span>
          </div>
        </div>
      </div>

      <div className="tour-booking-columns">
        {/* Left Column: Tour details */}
        <div className="tour-booking-col">
          <span className="col-heading">Tour details</span>
          <div className="info-list">
            <div className="info-item">
              <img src={calendarIcon} alt="" aria-hidden="true" width="14" height="14" />
              <span>{dateRange}</span>
            </div>
            <div className="info-item">
              <img src={mealIcon} alt="" aria-hidden="true" width="14" height="14" />
              <span>{mealPlan}</span>
            </div>
            {guestsText && (
              <div className="info-item">
                <img src={peopleIcon} alt="" aria-hidden="true" width="14" height="14" />
                <span>{guestsText}</span>
              </div>
            )}
            <div className="info-item">
              <img src={walletIcon} alt="" aria-hidden="true" width="14" height="14" />
              <span>Total price <strong>${totalPrice}</strong></span>
            </div>
          </div>
        </div>

        {/* Right Column: Slot (sideInfo) */}
        {sideInfo}
      </div>

      {/* Document Rejection Reason Banner */}
      {documentRejectionReason && (
        <div className="tour-booking-doc-rejection-banner" data-testid="doc-rejection-banner" role="alert">
          <div className="cancellation-line">
            <span className="cancellation-label">Documents rejected:</span>
          </div>
          <div className="cancellation-line">
            <span className="cancellation-label">Reason:</span>
            <span className="cancellation-value">{documentRejectionReason}</span>
          </div>
        </div>
      )}

      {/* Footer Area: Cancellation Details (Left) and Actions Slot (Right) */}
      <div className="tour-booking-footer">
        {isCanceled && cancellationDetails ? (
          <div className="tour-booking-cancellation-info">
            <div className="cancellation-line">
              <span className="cancellation-label">Cancelled by:</span>
              <span className="cancellation-value">{cancellationDetails.cancelledBy}</span>
            </div>
            <div className="cancellation-line">
              <span className="cancellation-label">Reason:</span>
              <span className="cancellation-value">{cancellationDetails.reason}</span>
            </div>
          </div>
        ) : (
          <div className="tour-booking-footer-spacer" />
        )}

        {!isCanceled && actions}
      </div>
    </div>
  )
}

const DEFAULT_FALLBACK_IMAGE = placeholderTourImage
