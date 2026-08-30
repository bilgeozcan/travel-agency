import React from 'react'
import personIcon from '@/assets/icons/Person.svg'
import emailIcon from '@/assets/icons/email.svg'
import documentIcon from '@/assets/icons/document.svg'
import type { CustomerInfoSectionProps } from './CustomerInfoSection.types'
import { useCustomerInfoSection } from '../../hooks/useCustomerInfoSection'
import './CustomerInfoSection.css'

export type { CustomerInfoSectionProps }

export const CustomerInfoSection: React.FC<CustomerInfoSectionProps> = ({
  firstCustomer,
  customerEmail,
  totalGuestsCount,
  documentsCount,
  onOpenDocuments,
  onOpenGuests,
}) => {
  const { displayEmail, guestSummaryText, docsText } = useCustomerInfoSection({
    firstCustomer,
    customerEmail,
    totalGuestsCount,
    documentsCount,
  })

  return (
    <div className="tour-booking-col" data-testid="customer-info-section">
      <span className="col-heading">Customer details</span>
      <div className="info-list">
        {/* Customer / Guest Info */}
        <div className="info-item">
          <img src={personIcon} alt="" aria-hidden="true" width="14" height="14" />
          {onOpenGuests ? (
            <button
              type="button"
              className="customer-info-link-btn"
              onClick={onOpenGuests}
              data-testid="customer-info-guests-link"
            >
              {guestSummaryText}
            </button>
          ) : (
            <span data-testid="customer-info-guests-link">{guestSummaryText}</span>
          )}
        </div>

        {/* Customer Email */}
        {displayEmail && (
          <div className="info-item">
            <img src={emailIcon} alt="" aria-hidden="true" width="14" height="14" />
            <span data-testid="customer-info-email">{displayEmail}</span>
          </div>
        )}

        {/* Uploaded Documents Link */}
        <div className="info-item">
          <img src={documentIcon} alt="" aria-hidden="true" width="14" height="14" />
          <button
            type="button"
            className="customer-info-link-btn"
            onClick={onOpenDocuments}
            data-testid="customer-info-docs-link"
          >
            {docsText}
          </button>
        </div>

        {/* See All Guests Link */}
        {onOpenGuests && (
          <div className="info-item">
            <button
              type="button"
              className="customer-info-link-btn customer-see-all-guests-btn"
              onClick={onOpenGuests}
              data-testid="see-all-guests-link"
            >
              See all guests
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
