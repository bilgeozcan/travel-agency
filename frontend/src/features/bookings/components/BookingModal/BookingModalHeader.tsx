import React from 'react'
import starIcon from '@/assets/icons/Star.svg'
import closeIcon from '@/assets/icons/Close.svg'
import type { BookingModalHeaderProps } from './BookingModalHeader.types'

export type { BookingModalHeaderProps }

export const BookingModalHeader: React.FC<BookingModalHeaderProps> = ({
  title,
  rating,
  destination,
  onClose,
}) => {
  const ratingText = rating ? rating.toFixed(1).replace('.', ',') : '-'

  return (
    <div className="booking-modal-header">
      <div className="booking-modal-title-group">
        <div className="booking-modal-hotel-row">
          <h2 className="booking-modal-hotel-name">{title}</h2>
          <div className="booking-modal-rating-badge">
            <img src={starIcon} alt="" aria-hidden="true" width="14" height="14" />
            <span>{ratingText}</span>
          </div>
        </div>
        <p className="booking-modal-location">{destination || ''}</p>
      </div>
      <button
        type="button"
        className="booking-modal-close-btn"
        onClick={onClose}
        aria-label="Close booking modal"
      >
        <img src={closeIcon} alt="" aria-hidden="true" width="24" height="24" />
      </button>
    </div>
  )
}
