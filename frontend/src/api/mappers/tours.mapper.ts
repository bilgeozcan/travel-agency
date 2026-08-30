import placeholderTourImage from '@/assets/images/placeholder-tour.svg'
import type { TourDetail, TourReview } from '@/features/tours/types/tours'

function parsePriceValue(value: unknown): number {
  if (typeof value === 'number') return value
  const parsed = parseFloat(String(value ?? '').replace(/[^0-9.]/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

function parseBasePrice(raw: any): number {
  if (typeof raw.price === 'number') return raw.price
  if (!raw.price || typeof raw.price !== 'object') return 0

  if (raw.price.adult !== undefined) {
    return parsePriceValue(raw.price.adult)
  }

  const firstDuration = Array.isArray(raw.durations) ? raw.durations[0] : undefined
  if (firstDuration && raw.price[firstDuration] !== undefined) {
    return parsePriceValue(raw.price[firstDuration])
  }

  const firstPrice = Object.values(raw.price)[0]
  return parsePriceValue(firstPrice)
}

/**
 * Maps raw backend GET /tours/{id} response (OAS TourDetailsDTO) to frontend TourDetail model.
 */
export function mapBackendTourDetailsToFrontend(raw: any, tourId: string): TourDetail {
  if (!raw) {
    throw new Error(`Invalid tour detail data for ID '${tourId}'`)
  }

  // Parse durations: e.g. ["7 days", "10 days"] -> [7, 10]
  const allowedDurations: number[] = Array.isArray(raw.durations)
    ? raw.durations.map((d: any) => {
      if (typeof d === 'number') return d
      const matched = String(d).match(/\d+/)
      return matched ? parseInt(matched[0], 10) : 7
    })
    : [7]

  const basePrice = parseBasePrice(raw)

  const pricesByDuration: Record<string, number> = {}
  if (raw.price && typeof raw.price === 'object') {
    Object.entries(raw.price).forEach(([k, v]) => {
      pricesByDuration[k] = parsePriceValue(v)
    })
  }

  // Parse guest quantity limits
  const adultsMax = typeof raw.guestQuantity?.adultsMaxValue === 'number' ? raw.guestQuantity.adultsMaxValue : 10
  const childrenMax = typeof raw.guestQuantity?.childrenMaxValue === 'number' ? raw.guestQuantity.childrenMaxValue : 10
  // Prefer the canonical totalMaxValue key, but keep reading the legacy typo for old payloads.
  // Must use typeof === 'number' (not ||) so a legitimately sold-out value of 0 is not coerced to the fallback 10.
  const totalMaxRaw =
    typeof raw.guestQuantity?.totalMaxValue === 'number'
        ? raw.guestQuantity.totalMaxValue
        : typeof raw.guestQuantity?.totalMaxVelue === 'number'
          ? raw.guestQuantity.totalMaxVelue
        : 10
  const totalMax = totalMaxRaw
  const maxParticipants = totalMax

  // Parse guide languages from customDetails
  const guideLanguages = raw.customDetails?.guideLanguage
    ? raw.customDetails.guideLanguage.split(',').map((s: string) => s.trim())
    : []

  // Parse meal supplements per day
  const mealSupplementsPerDay: Record<string, number> = {}
  if (raw.mealSupplementsPerDay && typeof raw.mealSupplementsPerDay === 'object') {
    Object.entries(raw.mealSupplementsPerDay).forEach(([k, v]) => {
      const parsed = typeof v === 'number' ? v : parseFloat(String(v || '0'))
      mealSupplementsPerDay[k] = isNaN(parsed) ? 0 : parsed
    })
  }

  const isFullyBooked =
    raw.isAvailable === false ||
    totalMax <= 0 ||
    raw.guestQuantity?.adultsMaxValue <= 0

  const rawImages: string[] = Array.isArray(raw.imageUrls) ? raw.imageUrls.filter(Boolean) : []
  if (raw.imageUrl && !rawImages.includes(raw.imageUrl)) {
    rawImages.unshift(raw.imageUrl)
  }
  const heroImages = rawImages.length > 0 ? rawImages : [placeholderTourImage]

  const freeCancelDays = raw.freeCancelationDaysBefore || 0
  let cancellationDescription = 'Standard cancellation policy'

  if (freeCancelDays > 0) {
    cancellationDescription = `Free cancellation up to ${freeCancelDays} days before start date`
  }

  return {
    id: raw.id || tourId,
    title: raw.name || '',
    destination: raw.destination || '',
    hotelName: raw.hotelName || raw.name || '',
    hotelDescription: raw.hotelDescription || raw.summary || '',
    rating: typeof raw.rating === 'number' ? raw.rating : parseFloat(raw.rating || '0'),
    reviewsCount: raw.reviews || 0,
    heroImages,
    basePricePerPerson: basePrice,
    availableStartDates: Array.isArray(raw.startDates) ? raw.startDates : [],
    allowedDurations: allowedDurations,
    maxParticipants: maxParticipants,
    adultsMax: adultsMax,
    childrenMax: childrenMax,
    totalMax: totalMax,
    availableMealPlans: Array.isArray(raw.mealPlans) ? raw.mealPlans : [],
    cancellationPolicy: {
      freeCancellationUntilDays: freeCancelDays,
      description: cancellationDescription,
    },
    accommodationDescription: raw.accomodiation || raw.accommodationDescription || '',
    guideLanguages: guideLanguages,
    transferInfo: raw.customDetails?.transfer || 'Not included',
    isFullyBooked: isFullyBooked,
    mealSupplementsPerDay: mealSupplementsPerDay,
    pricesByDuration: pricesByDuration,
    tourType: raw.tourType,
  }
}

/**
 * Maps raw backend GET /tours/{id}/reviews item to frontend TourReview model.
 */
export function mapBackendReviewToFrontend(r: any, idx: number): TourReview {
  return {
    id: r.reviewId || r.id || `rev-${idx}`,
    authorName: r.authorName || 'Anonymous',
    authorAvatar: r.authorImageUrl || r.authorAvatar || '',
    rating: typeof r.rate === 'number' ? r.rate : parseFloat(r.rate || r.rating || '0'),
    date: r.createdAt || r.date || '',
    comment: r.reviewContent || r.comment || '',
  }
}
