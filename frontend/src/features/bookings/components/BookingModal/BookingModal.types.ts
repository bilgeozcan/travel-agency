import type { MealPlanCode, TourDetail } from '@/features/tours/types/tours'
import type { CreateBookingRequest, GuestInfo, UpdateBookingRequest } from '../../types/bookings'

export type EditMode = 'customer' | 'agent'

export interface BookingModalInitialSelection {
  startDate?: string
  duration?: number
  adults?: number
  children?: number
  mealPlan?: MealPlanCode
}

export interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  tour: TourDetail
  initialSelection?: BookingModalInitialSelection
  initialGuests?: GuestInfo[]
  onConfirmBooking?: (payload: CreateBookingRequest, guests: GuestInfo[]) => Promise<void>
  mode?: 'create' | 'edit'
  roleMode?: EditMode
  onSubmit?: (payload: CreateBookingRequest | UpdateBookingRequest, guests: GuestInfo[]) => Promise<void>
}
