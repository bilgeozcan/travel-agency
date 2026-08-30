import type React from 'react'
import type { BookingStatus } from '@/features/bookings/types/bookings'

export type { BookingStatus }

export interface TourBookingCardProps {
  id: string
  status: BookingStatus | string
  tourImageUrls: string[]
  tourTitle: string
  tourLocation: string
  dateRange: string
  mealPlan: string
  guestsText?: string
  totalPrice: number
  documentsCount?: number
  cancellationDetails?: {
    cancelledBy: string
    reason: string
  }
  documentRejectionReason?: string | null
  /* Pure Slot Props */
  sideInfo?: React.ReactNode
  actions?: React.ReactNode
}
