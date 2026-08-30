import type { TravelAgentContact } from './bookings'

export interface BookingConfirmationModalProps {
  isOpen: boolean
  hotelName: string
  startDate: string
  durationDays: number
  mealPlan: string
  adultsCount: number
  childrenCount?: number
  travelAgent?: TravelAgentContact
  bookingDate?: Date | string
  freeCancellationUntilDate?: string
  onClose: () => void
  onNavigateToMyTours?: () => void
}

export interface ConfirmedBookingInfo {
  hotelName: string
  startDate: string
  durationDays: number
  mealPlan: string
  adultsCount: number
  childrenCount: number
  travelAgent?: TravelAgentContact
  freeCancellationUntilDate?: string
}
