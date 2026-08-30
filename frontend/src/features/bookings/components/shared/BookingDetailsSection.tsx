import React from 'react'
import type { BookingDetailsSectionProps } from './BookingDetailsSection.types'
import './BookingDetailsSection.css'

export type { BookingDetailsSectionProps }

export const BookingDetailsSection: React.FC<BookingDetailsSectionProps> = ({
  title = 'Booking details',
  items,
  className = '',
  dataTestId = 'booking-details-section',
}) => {
  return (
    <div className={`booking-details-section ${className}`} data-testid={dataTestId}>
      {title && <h3 className="booking-details-section-title">{title}</h3>}
      <dl className="booking-details-grid">
        {items.map((item, idx) => (
          <div key={item.id || item.label || idx} className="booking-detail-row">
            <dt className="booking-detail-label">{item.label}</dt>
            <dd className="booking-detail-value" data-testid={item.testId}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
