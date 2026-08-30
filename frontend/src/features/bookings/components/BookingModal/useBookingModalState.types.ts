import type { TourDetail } from '@/features/tours/types/tours'
import type { CreateBookingRequest, GuestInfo, UpdateBookingRequest } from '../../types/bookings'
import type { BookingModalInitialSelection, EditMode } from './BookingModal.types'

export interface UseBookingModalStateProps {
  isOpen: boolean
  tour: TourDetail
  initialSelection?: BookingModalInitialSelection
  initialGuests?: GuestInfo[]
  mode?: 'create' | 'edit'
  roleMode?: EditMode
  onConfirmBooking?: (payload: CreateBookingRequest, guests: GuestInfo[]) => Promise<void>
  onSubmit?: (payload: CreateBookingRequest | UpdateBookingRequest, guests: GuestInfo[]) => Promise<void>
}
