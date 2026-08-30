import React from 'react'
import { BookingModalFooter as SharedBookingModalFooter } from '../shared/BookingModalFooter'
import type { BookingModalFooterProps } from './BookingModalFooter.types'

export type { BookingModalFooterProps }

export const BookingModalFooter: React.FC<BookingModalFooterProps> = ({
  totalPrice,
  isEditMode,
  isSubmitDisabled,
  isSubmitting,
}) => {
  return (
    <SharedBookingModalFooter
      totalPrice={totalPrice}
      submitText={isEditMode ? 'Save changes' : 'Book Now'}
      loadingText={isEditMode ? 'Saving...' : 'Booking...'}
      isSubmitting={isSubmitting}
      isSubmitDisabled={isSubmitDisabled}
      type="submit"
      submitTestId="booking-modal-submit-btn"
      priceTestId="booking-modal-total-price"
    />
  )
}
