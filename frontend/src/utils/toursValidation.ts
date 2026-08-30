// Tour Validation and Formatting Utilities (US_4.1 & US_4.2)

import type { MealPlanCode, ResortTypeCode, TourSortOption } from '@/features/tours/types/tours'
import { ERROR_MESSAGES } from './validation'

export const MEAL_PLAN_OPTIONS: { label: string; value: MealPlanCode }[] = [
  { label: 'Breakfast (BB)', value: 'BB' },
  { label: 'Half-board (HB)', value: 'HB' },
  { label: 'Full-board (FB)', value: 'FB' },
  { label: 'All inclusive (AI)', value: 'AI' },
]

export const RESORT_TYPE_OPTIONS: { label: string; value: ResortTypeCode }[] = [
  { label: 'Resorts', value: 'RESORT' },
  { label: 'Cruises', value: 'CRUISE' },
  { label: 'Hikes', value: 'HIKE' },
]

export const TOUR_SORT_OPTIONS: { label: string; value: TourSortOption }[] = [
  { label: 'Top rated first', value: 'RATING_DESC' },
  { label: 'Low rated first', value: 'RATING_ASC' },
  { label: 'Highest price first', value: 'PRICE_DESC' },
  { label: 'Lowest price first', value: 'PRICE_ASC' },
]

/**
 * Formats a tour start and end date (YYYY-MM-DD) into display date range (e.g. "May 10 - May 17")
 */
export function formatTourDateRange(startDate?: string, endDate?: string): string {
  if (!startDate) return 'Flexible dates'

  const formatSingle = (dateStr: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number)
      const dateObj = new Date(Date.UTC(year, month - 1, day))
      if (!isNaN(dateObj.getTime())) {
        const monthShort = dateObj.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
        return `${monthShort} ${day}`
      }
    }
    return dateStr
  }

  const startFormatted = formatSingle(startDate)
  if (!endDate) return startFormatted

  const endFormatted = formatSingle(endDate)
  return `${startFormatted} - ${endFormatted}`
}

/**
 * Calculates end date (YYYY-MM-DD) from start date (YYYY-MM-DD) and duration in days.
 */
export function calculateEndDate(startDate?: string, durationDays?: number): string | null {
  if (!startDate || !durationDays || durationDays <= 0) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    const [year, month, day] = startDate.split('-').map(Number)
    const dateObj = new Date(Date.UTC(year, month - 1, day))
    if (!isNaN(dateObj.getTime())) {
      dateObj.setUTCDate(dateObj.getUTCDate() + durationDays)
      const endYear = dateObj.getUTCFullYear()
      const endMonth = String(dateObj.getUTCMonth() + 1).padStart(2, '0')
      const endDay = String(dateObj.getUTCDate()).padStart(2, '0')
      return `${endYear}-${endMonth}-${endDay}`
      return `${endYear}-${endMonth}-${endDay}`
    }
  }
  return null
}

/**
 * Formats a tour start date (YYYY-MM-DD) into a short display date (e.g. "May 10", "Jun 1")
 */
export function formatTourStartDate(startDate?: string): string {
  if (!startDate) return 'Flexible dates'
  if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    const [year, month, day] = startDate.split('-').map(Number)
    const dateObj = new Date(Date.UTC(year, month - 1, day))
    if (!isNaN(dateObj.getTime())) {
      const monthShort = dateObj.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
      return `${monthShort} ${day}`
    }
  }
  return startDate
}

/**
 * Validates start and end dates. Returns error message string if invalid, or null if valid.
 */
export function validateDateRange(startDate?: string, endDate?: string): string | null {
  if (!startDate || !endDate) return null

  const start = new Date(startDate)
  const end = new Date(endDate)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return ERROR_MESSAGES.invalidDateFormat
  }

  if (end < start) {
    return ERROR_MESSAGES.endDateBeforeStartDate
  }

  return null
}

/**
 * Formats meal plan code to user-friendly string
 */
export function formatMealPlanLabel(code?: string): string {
  if (!code) return 'Not specified'
  switch (code.toUpperCase()) {
    case 'BB':
      return 'Breakfast'
    case 'HB':
      return 'Half-board'
    case 'FB':
      return 'Full-board'
    case 'AI':
      return 'All inclusive'
    default:
      return code
  }
}

/**
 * Formats meal plan code or string to full label with abbreviation, e.g. "Breakfast (BB)", "Half-board (HB)"
 */
export function formatMealPlanFullLabel(code?: string): string {
  if (!code) return 'Not specified'
  const cleanCode = code.trim().toUpperCase()

  switch (cleanCode) {
    case 'BB':
    case 'BREAKFAST':
      return 'Breakfast (BB)'
    case 'HB':
    case 'HALF_BOARD':
    case 'HALF-BOARD':
      return 'Half-board (HB)'
    case 'FB':
    case 'FULL_BOARD':
    case 'FULL-BOARD':
      return 'Full-board (FB)'
    case 'AI':
    case 'ALL_INCLUSIVE':
    case 'ALL INCLUSIVE':
    case 'ALL-INCLUSIVE':
      return 'All inclusive (AI)'
    default:
      return code
  }
}

/**
 * Formats adult/children quantity string according to US_4.2 spec (adults-x, children-y)
 */
export function formatGuestCountLabel(adults: number, children: number): string {
  const safeAdults = Math.max(1, adults || 1)
  const safeChildren = Math.max(0, children || 0)

  if (safeChildren > 0) {
    return `${safeAdults} adult${safeAdults > 1 ? 's' : ''}, ${safeChildren} child${safeChildren > 1 ? 'ren' : ''}`
  } else {
    return `${safeAdults} adult${safeAdults > 1 ? 's' : ''}`
  }
}

export interface CancellationInfo {
  available: boolean
  text: string
}

/**
 * Formats cancellation information.
 * Returns a structured { available, text } object so callers don't
 * derive a boolean by prefix-matching a display string.
 */
export function formatCancellationInfo(
  freeCancelation?: string | boolean | null
): CancellationInfo {
  if (!freeCancelation) {
    return { available: false, text: 'Free cancellation is not available' }
  }

  if (typeof freeCancelation === 'boolean' || freeCancelation === 'true') {
    return { available: true, text: 'Free cancellation available' }
  }

  if (typeof freeCancelation !== 'string') {
    return { available: Boolean(freeCancelation), text: 'Free cancellation available' }
  }

  if (
    freeCancelation.toLowerCase().startsWith('free cancellation') ||
    freeCancelation.toLowerCase().startsWith('free cancelation')
  ) {
    return { available: true, text: freeCancelation }
  }

  // If ISO date format like YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(freeCancelation)) {
    // Use local midnight to avoid UTC-offset causing the date to flip a day early
    // (e.g., at 23:00 UTC+3, toISOString() would already show the next day)
    const today = new Date()
    const todayLocalStr = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-')

    if (freeCancelation < todayLocalStr) {
      return { available: false, text: 'Free cancellation is no longer available for this trip' }
    }

    const [year, month, day] = freeCancelation.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    if (!isNaN(dateObj.getTime())) {
      const monthName = dateObj.toLocaleString('en-US', { month: 'long' })
      return { available: true, text: `Free cancellation until ${monthName} ${day}` }
    }
  }

  return { available: true, text: `Free cancellation until ${freeCancelation}` }
}

/**
 * Safely extracts unique, non-empty destination strings from an array of tour items.
 */
export function extractUniqueDestinations(tours?: { destination?: string }[]): string[] {
  if (!Array.isArray(tours) || tours.length === 0) return []
  const list = tours
    .map((t) => t?.destination?.trim())
    .filter((d): d is string => Boolean(d))
  return Array.from(new Set(list))
}

export interface CalculateTourPriceParams {
  basePricePerPerson: number
  numberOfTourists: number
  durationDays: number
  mealPlan: MealPlanCode | string
  mealSupplementsPerDay?: Record<string, number>
  pricesByDuration?: Record<string, number>
}

/**
 * Calculates tour total price using the enterprise formula:
 * Price Per Person = Base Price + (Daily Meal Supplement * Duration Days)
 * Total Price = Price Per Person * Number Of Tourists
 */
export function calculateTourPrice(params: CalculateTourPriceParams): number {
  let basePrice = Math.max(0, Number(params.basePricePerPerson) || 0)
  const duration = Math.max(1, Math.floor(Number(params.durationDays) || 1))
  const tourists = Math.max(1, Math.floor(Number(params.numberOfTourists) || 1))

  // Dynamically resolve base price for duration if pricesByDuration is available
  if (params.pricesByDuration && Object.keys(params.pricesByDuration).length > 0) {
    const durationKey = `${duration} days`
    const durationKeySingular = `${duration} day`
    const matchedVal =
      params.pricesByDuration[durationKey] ??
      params.pricesByDuration[durationKeySingular] ??
      params.pricesByDuration[String(duration)]

    if (typeof matchedVal === 'number' && matchedVal > 0) {
      basePrice = matchedVal
    }
  }

  const mealCode = String(params.mealPlan || '').toUpperCase()
  const supplements = params.mealSupplementsPerDay || {}
  const matchedKey = Object.keys(supplements).find(
    (key) => key.toUpperCase() === mealCode
  )
  const dailySupplement = matchedKey
    ? Number(supplements[matchedKey]) || 0
    : 0

  const pricePerPerson = basePrice + (dailySupplement * duration)
  return Math.round(pricePerPerson * tourists)
}
