import React from 'react'
import type { CreateBookingRequest, GuestInfo } from '../../types/bookings'
import type { TourDetail } from '@/features/tours/types/tours'
import { BookingModal, type BookingModalInitialSelection } from './BookingModal'

export interface CreateBookingModalProps {
  isOpen: boolean
  onClose: () => void
  tour: TourDetail
  initialSelection?: BookingModalInitialSelection
  onConfirmBooking?: (payload: CreateBookingRequest, guests: GuestInfo[]) => Promise<void>
}

export const CreateBookingModal: React.FC<CreateBookingModalProps> = (props) => (
  <BookingModal {...props} mode="create" />
)
