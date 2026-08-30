import type { MealPlanCode } from '@/features/tours/types/tours'

export type BookingStatus = 'BOOKED' | 'CONFIRMED' | 'STARTED' | 'FINISHED' | 'CANCELED'

export interface GuestInfo {
  firstName: string
  lastName: string
  email?: string
}

export interface TravelAgentContact {
  name: string
  email: string
  phone: string
  messenger: string
}

export type TravelAgentInfo = TravelAgentContact

export interface BackendBookingItem {
  id: string
  userId: string
  tourId: string
  state: BookingStatus
  name: string
  destination: string
  tourImageUrl?: string
  personalDetails?: unknown
  documents?: unknown
  isPendingApproval?: boolean
  pendingApproval?: boolean
  is_pending_approval?: boolean
  tourDetails: {
    date: string
    duration?: string
    mealPlan: string
    guests: string
    personalDetails?: unknown
    totalPrice: string
    documents?: string
  }
  travelAgent?: TravelAgentContact
  canceledBy?: string | null
  canceledByRole?: string | null
  cancelReason?: string | null
  freeCancellationUntilDate?: string | null
  freeCancelation?: string | null
  documentRejectionReason?: string | null
  hasFeedback?: boolean | null
  feedback?: {
    rating?: number | null
    comment?: string | null
  } | null
  pendingEdits?: {
    tourDetails?: {
      date?: string
      duration?: string
      mealPlan?: string
      guests?: string
      totalPrice?: string
      documents?: string
    }
    personalDetails?: unknown
    capacityDelta?: {
      adults?: number
      children?: number
      total?: number
    }
  } | null
}

export interface PendingEditsParsed {
  startDate: string
  endDate: string
  durationDays: number
  mealPlan: MealPlanCode
  adultsCount: number
  childrenCount: number
  guestsCount: number
  guests: GuestInfo[]
  totalPrice: number
}

export interface TourBooking {
  id: string
  tourId: string
  tourTitle: string
  destination: string
  hotelName: string
  hotelRating?: number
  heroImage: string
  startDate: string
  endDate: string
  durationDays: number
  adultsCount: number
  childrenCount: number
  guestsCount: number
  guests: GuestInfo[]
  mealPlan: MealPlanCode
  totalPrice: number
  currency: string
  status: BookingStatus
  freeCancellationUntilDate?: string | null
  documentsUploaded: boolean
  documentsCount?: number
  travelAgent?: TravelAgentContact
  customerEmail?: string
  canceledBy?: string
  canceledByRole?: string | null
  cancellationReason?: string
  documentRejectionReason?: string | null
  isPendingApproval?: boolean
  hasFeedback?: boolean
  feedback?: {
    rating: number
    comment: string
  }
  pendingEdits?: PendingEditsParsed | null
}

export interface CreateBookingRequest {
  tourId: string
  date: string
  duration: string
  mealPlan: MealPlanCode
  guests: {
    adult: number
    children: number
  }
  personalDetails: GuestInfo[]
  bookingToken?: string
  quotedPrice?: number
}

export interface CreateBookingResponse {
  freeCancelation: string
  details: string
  travelAgent?: TravelAgentContact
}

export interface UpdateBookingRequest {
  date?: string
  duration: string
  mealPlan: MealPlanCode
  guests: {
    adult: number
    children: number
  }
  personalDetails: GuestInfo[]
}

export interface CancelBookingResponse {
  message: string
  refundEligible: boolean
  penaltyAmount?: number
}

export interface BookingDocumentItem {
  id: string
  name: string
  url: string
  fileFormat?: string
  documentType?: 'PASSPORT' | 'PAYMENT_CONFIRMATION'
  guestIndex?: number
}

export interface DocumentFeedbackRequest {
  bookingId: string
  comment: string
}

export interface TourFeedbackResponse {
  id: string
  bookingId: string
  tourId: string
  rating: number
  comment?: string
  createdAt?: string
  updatedAt?: string
}
