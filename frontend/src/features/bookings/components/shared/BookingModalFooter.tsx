import React from 'react'
import { Button } from '@/components/ui/Button/Button'
import type { BookingModalFooterProps } from './BookingModalFooter.types'
import './BookingModalFooter.css'

export type { BookingModalFooterProps }

export const BookingModalFooter: React.FC<BookingModalFooterProps> = ({
  totalPrice,
  submitText,
  loadingText,
  isSubmitting = false,
  isSubmitDisabled = false,
  type = 'button',
  onSubmit,
  submitTestId = 'confirm-booking-button',
  priceTestId = 'booking-modal-total-price',
  className = '',
  secondaryAction,
}) => {
  return (
    <div className={`booking-modal-shared-footer ${className}`}>
      <div className="booking-modal-price-row">
        <span className="booking-modal-price-label">Total price:</span>
        <span className="booking-modal-price-value" data-testid={priceTestId}>
          ${totalPrice}
        </span>
      </div>

      <div className="booking-modal-footer-actions">
        {secondaryAction}
        <Button
          type={type}
          variant="primary"
          fullWidth={true}
          disabled={isSubmitDisabled || isSubmitting}
          isLoading={isSubmitting}
          loadingText={loadingText}
          onClick={onSubmit}
          data-testid={submitTestId}
        >
          {submitText}
        </Button>
      </div>
    </div>
  )
}
