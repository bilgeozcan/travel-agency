import placeholderTourImage from '@/assets/images/placeholder-tour.svg'
import type { MealPlanCode } from '@/features/tours/types/tours'
import type { BackendBookingItem, GuestInfo, TourBooking } from '@/features/bookings/types/bookings'
import { isTravelAgent } from '@/utils/authUtils'

export function extractIsPendingApproval(dto: BackendBookingItem): boolean {
  return Boolean(dto.isPendingApproval ?? dto.pendingApproval ?? dto.is_pending_approval)
}

import {
  formatCancellationRole,
  cleanCanceledBy,
  cleanCancellationReason,
} from '@/features/bookings/utils/bookingFormatter'

export { formatCancellationRole, cleanCanceledBy, cleanCancellationReason }

/**
 * 1. Base Shared Parser: Parses core tour attributes (dates, price, rating, cancellation).
 */

export interface BaseBookingParsed {
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
  mealPlan: MealPlanCode
  totalPrice: number
  currency: string
  status: TourBooking['status']
  freeCancellationUntilDate?: string | null
  canceledBy?: string
  canceledByRole?: string | null
  cancellationReason?: string
}

export function mapBaseBackendBooking(dto: BackendBookingItem): BaseBookingParsed {
  const rawDateStr = dto.tourDetails?.date ?? ''
  const dateMatch = rawDateStr.match(/^(\d{4}-\d{2}-\d{2})(?:\s*\((\d+)\s*days\))?/)
  const startDate = dateMatch ? dateMatch[1] : rawDateStr

  let durationDays = dateMatch && dateMatch[2] ? parseInt(dateMatch[2], 10) : 1
  const rawDuration = dto.tourDetails?.duration
  if (rawDuration) {
    const durMatch = String(rawDuration).match(/\d+/)
    if (durMatch) {
      durationDays = parseInt(durMatch[0], 10)
    }
  }

  let endDate = startDate
  if (startDate && durationDays) {
    const startDt = new Date(startDate)
    if (!isNaN(startDt.getTime())) {
      startDt.setDate(startDt.getDate() + durationDays)
      endDate = startDt.toISOString().split('T')[0]
    }
  }

  const rawGuests = dto.tourDetails?.guests ?? ''
  const adultMatch = rawGuests.match(/(\d+)\s*adult/i)
  const childMatch = rawGuests.match(/(\d+)\s*child/i)

  const rawPersonalDetails = Array.isArray(dto.personalDetails)
    ? dto.personalDetails
    : Array.isArray(dto.tourDetails?.personalDetails)
      ? dto.tourDetails.personalDetails
      : []

  const adultsCount = adultMatch ? parseInt(adultMatch[1], 10) : Math.max(1, rawPersonalDetails.length)
  const childrenCount = childMatch ? parseInt(childMatch[1], 10) : 0
  const guestsCount = Math.max(adultsCount + childrenCount, rawPersonalDetails.length)

  const rawPrice = dto.tourDetails?.totalPrice ?? '0'
  const numericPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0

  const rawRating = (dto as any).tourDetails?.rating ?? (dto as any).hotelRating
  const hotelRating = typeof rawRating === 'number' ? rawRating : parseFloat(String(rawRating ?? '')) || undefined

  return {
    id: dto.id,
    tourId: dto.tourId,
    tourTitle: dto.name || '',
    destination: dto.destination || '',
    hotelName: dto.name || '',
    hotelRating,
    heroImage: dto.tourImageUrl && dto.tourImageUrl.trim() ? dto.tourImageUrl : placeholderTourImage,
    startDate: startDate || '',
    endDate: endDate || '',
    durationDays,
    adultsCount,
    childrenCount,
    guestsCount,
    mealPlan: (dto.tourDetails?.mealPlan as MealPlanCode) || 'BB',
    totalPrice: numericPrice,
    currency: 'USD',
    status: dto.state || 'BOOKED',
    freeCancellationUntilDate: dto.freeCancellationUntilDate !== undefined
      ? dto.freeCancellationUntilDate
      : dto.freeCancelation,
    canceledBy: cleanCanceledBy(dto.canceledBy, dto.canceledByRole),
    canceledByRole: dto.canceledByRole ?? null,
    cancellationReason: cleanCancellationReason(dto.cancelReason),
  }
}

/**
 * Parses guest list and personal details from raw DTO.
 */
function parseGuestsList(dto: BackendBookingItem, guestsCount: number): GuestInfo[] {
  const rawGuests = dto.tourDetails?.guests ?? ''
  const rawPersonalDetails = Array.isArray(dto.personalDetails)
    ? dto.personalDetails
    : Array.isArray(dto.tourDetails?.personalDetails)
      ? dto.tourDetails.personalDetails
      : []

  const personalDetails: GuestInfo[] = rawPersonalDetails
    .filter(
      (guest): guest is { firstName: string; lastName: string } =>
        typeof guest === 'object' && guest !== null &&
        typeof (guest as { firstName?: unknown }).firstName === 'string' &&
        typeof (guest as { lastName?: unknown }).lastName === 'string'
    )
    .map((guest) => ({
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: typeof (guest as any).email === 'string' && (guest as any).email.trim() ? (guest as any).email.trim() : undefined,
    }))

  const namesPart = rawGuests.replace(/\s*\([^)]*\)\s*$/, '').trim()
  const guestsList = personalDetails.length > 0
    ? personalDetails
    : namesPart && !/adult|child/i.test(namesPart)
      ? namesPart.split(/,\s*/).map((fullName) => {
        const parts = fullName.trim().split(/\s+/)
        return { firstName: parts.shift() || '', lastName: parts.join(' ') }
      }).filter((guest) => guest.firstName)
      : []

  const guestsListNormalized = [...guestsList]
  while (guestsListNormalized.length < guestsCount) {
    guestsListNormalized.push({ firstName: '', lastName: '' })
  }

  return guestsListNormalized
}

/**
 * Parses and normalizes feedback data safely handling null, undefined, and partial objects.
 */
export function parseFeedbackInfo(dto: BackendBookingItem): {
  hasFeedback: boolean
  feedback?: { rating: number; comment: string }
} {
  const hasFeedbackFlag = Boolean(dto.hasFeedback)
  const rawFeedback = dto.feedback

  if (rawFeedback && typeof rawFeedback === 'object') {
    const rawRating = rawFeedback.rating
    const ratingNum = typeof rawRating === 'number' ? rawRating : Number(rawRating)

    if (Number.isFinite(ratingNum) && ratingNum >= 1 && ratingNum <= 5) {
      const commentStr = typeof rawFeedback.comment === 'string' ? rawFeedback.comment.trim() : ''
      return {
        hasFeedback: true,
        feedback: {
          rating: ratingNum,
          comment: commentStr,
        },
      }
    }
  }

  return {
    hasFeedback: hasFeedbackFlag,
    feedback: undefined,
  }
}

/**
 * Parses pendingEdits object if present on the booking DTO.
 */
export function parsePendingEditsInfo(dto: BackendBookingItem): TourBooking['pendingEdits'] {
  if (!dto.pendingEdits || typeof dto.pendingEdits !== 'object') {
    return null
  }

  const pe = dto.pendingEdits
  const tourDetails = pe.tourDetails || {}

  const rawDateStr = tourDetails.date ?? ''
  const dateMatch = rawDateStr.match(/^(\d{4}-\d{2}-\d{2})(?:\s*\((\d+)\s*days\))?/)
  const startDate = dateMatch ? dateMatch[1] : (rawDateStr || dto.tourDetails?.date || '')

  let durationDays = dateMatch && dateMatch[2] ? parseInt(dateMatch[2], 10) : 1
  if (tourDetails.duration) {
    const durMatch = String(tourDetails.duration).match(/\d+/)
    if (durMatch) durationDays = parseInt(durMatch[0], 10)
  }

  let endDate = startDate
  if (startDate && durationDays) {
    const startDt = new Date(startDate)
    if (!isNaN(startDt.getTime())) {
      startDt.setDate(startDt.getDate() + durationDays)
      endDate = startDt.toISOString().split('T')[0]
    }
  }

  const rawGuests = tourDetails.guests ?? ''
  const adultMatch = rawGuests.match(/(\d+)\s*adult/i)
  const childMatch = rawGuests.match(/(\d+)\s*child/i)

  const rawPersonalDetails = Array.isArray(pe.personalDetails)
    ? pe.personalDetails
    : Array.isArray((tourDetails as any).personalDetails)
      ? (tourDetails as any).personalDetails
      : []

  const adultsCount = adultMatch ? parseInt(adultMatch[1], 10) : Math.max(1, rawPersonalDetails.length)
  const childrenCount = childMatch ? parseInt(childMatch[1], 10) : 0
  const guestsCount = Math.max(adultsCount + childrenCount, rawPersonalDetails.length)

  const rawPrice = tourDetails.totalPrice ?? '0'
  const numericPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0

  const guests = parseGuestsList(
    {
      ...dto,
      tourDetails: {
        ...dto.tourDetails,
        ...tourDetails,
      },
      personalDetails: rawPersonalDetails,
    },
    guestsCount
  )

  return {
    startDate: startDate || '',
    endDate: endDate || '',
    durationDays,
    adultsCount,
    childrenCount,
    guestsCount,
    guests,
    mealPlan: (tourDetails.mealPlan as MealPlanCode) || (dto.tourDetails?.mealPlan as MealPlanCode) || 'BB',
    totalPrice: numericPrice,
  }
}

function parseDocumentsInfo(dto: BackendBookingItem): { documentsUploaded: boolean; documentsCount: number } {
  const rawDocs = Array.isArray(dto.documents) ? dto.documents : []
  const parsedTourDetailsCount = typeof dto.tourDetails?.documents === 'string'
    ? (parseInt(dto.tourDetails.documents.replace(/\D/g, ''), 10) || 0)
    : 0
  const documentsCount = rawDocs.length > 0 ? rawDocs.length : parsedTourDetailsCount
  const documentsUploaded = documentsCount > 0
  return { documentsUploaded, documentsCount }
}

/**
 * 2. Customer Specific Parser: Maps booking data for Customer view (includes assigned travelAgent contact info).
 */
export function mapCustomerBooking(dto: BackendBookingItem): TourBooking {
  const base = mapBaseBackendBooking(dto)
  const guests = parseGuestsList(dto, base.guestsCount)
  const feedbackInfo = parseFeedbackInfo(dto)
  const docInfo = parseDocumentsInfo(dto)

  return {
    ...base,
    guests,
    documentsUploaded: docInfo.documentsUploaded,
    documentsCount: docInfo.documentsCount,
    travelAgent: dto.travelAgent ? { ...dto.travelAgent } : undefined,
    isPendingApproval: extractIsPendingApproval(dto) || Boolean(dto.pendingEdits),
    hasFeedback: feedbackInfo.hasFeedback,
    feedback: feedbackInfo.feedback,
    pendingEdits: parsePendingEditsInfo(dto),
    documentRejectionReason: dto.documentRejectionReason ?? null,
  }
}

/**
 * 3. Travel Agent Specific Parser: Maps booking data for Travel Agent view (includes customerEmail & guest details).
 */
export function mapTravelAgentBooking(dto: BackendBookingItem): TourBooking {
  const base = mapBaseBackendBooking(dto)
  const guests = parseGuestsList(dto, base.guestsCount)
  const feedbackInfo = parseFeedbackInfo(dto)
  const docInfo = parseDocumentsInfo(dto)

  const firstGuestEmail = guests.find((g) => g.email)?.email
  const customerEmail =
    firstGuestEmail ||
    (dto.userId && dto.userId.includes('@') ? dto.userId : '') ||
    (dto as any).customerEmail ||
    (dto as any).email ||
    ''

  return {
    ...base,
    guests,
    documentsUploaded: docInfo.documentsUploaded,
    documentsCount: docInfo.documentsCount,
    customerEmail,
    travelAgent: dto.travelAgent ? { ...dto.travelAgent } : undefined,
    isPendingApproval: extractIsPendingApproval(dto) || Boolean(dto.pendingEdits),
    hasFeedback: feedbackInfo.hasFeedback,
    feedback: feedbackInfo.feedback,
    pendingEdits: parsePendingEditsInfo(dto),
    documentRejectionReason: dto.documentRejectionReason ?? null,
  }
}

/**
 * 4. Role-Aware Entry Point: Delegates mapping based on user role.
 */
export function mapBackendBookingToFrontend(dto: BackendBookingItem, userRole?: string | null): TourBooking {
  return isTravelAgent(userRole) ? mapTravelAgentBooking(dto) : mapCustomerBooking(dto)
}
