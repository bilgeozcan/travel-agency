import { describe, expect, it } from 'vitest'
import {
  calculateEndDate,
  calculateTourPrice,
  extractUniqueDestinations,
  formatCancellationInfo,
  formatGuestCountLabel,
  formatMealPlanLabel,
  formatTourDateRange,
  formatTourStartDate,
  validateDateRange,
} from './toursValidation'

describe('toursValidation utilities', () => {
  describe('formatTourDateRange & formatTourStartDate & calculateEndDate', () => {
    it('formatTourDateRange formats valid ISO start and end dates', () => {
      expect(formatTourDateRange('2026-05-10', '2026-05-17')).toBe('May 10 - May 17')
      expect(formatTourDateRange('2026-05-10')).toBe('May 10')
      expect(formatTourDateRange(undefined)).toBe('Flexible dates')
    })

    it('formatTourStartDate converts ISO date to short display string', () => {
      expect(formatTourStartDate('2026-06-01')).toBe('Jun 1')
      expect(formatTourStartDate('')).toBe('Flexible dates')
    })

    it('calculateEndDate calculates correct end date from start date and duration days', () => {
      expect(calculateEndDate('2026-05-10', 7)).toBe('2026-05-17')
      expect(calculateEndDate('2026-05-10', 0)).toBeNull()
      expect(calculateEndDate(undefined, 7)).toBeNull()
    })
  })

  describe('validateDateRange', () => {
    it('returns null if start or end date is missing', () => {
      expect(validateDateRange('2026-05-10', '')).toBeNull()
      expect(validateDateRange('', '2026-05-20')).toBeNull()
    })

    it('returns null if end date is equal to or after start date', () => {
      expect(validateDateRange('2026-05-10', '2026-05-10')).toBeNull()
      expect(validateDateRange('2026-05-10', '2026-05-20')).toBeNull()
    })

    it('returns error message if end date is before start date', () => {
      expect(validateDateRange('2026-05-20', '2026-05-10')).toBe(
        'End date cannot be before start date'
      )
    })
  })

  describe('formatMealPlanLabel', () => {
    it('formats codes correctly', () => {
      expect(formatMealPlanLabel('BB')).toBe('Breakfast')
      expect(formatMealPlanLabel('HB')).toBe('Half-board')
      expect(formatMealPlanLabel('FB')).toBe('Full-board')
      expect(formatMealPlanLabel('AI')).toBe('All inclusive')
    })
  })

  describe('formatGuestCountLabel', () => {
    it('formats guest count correctly according to spec', () => {
      expect(formatGuestCountLabel(2, 1)).toBe('2 adults, 1 child')
      expect(formatGuestCountLabel(1, 0)).toBe('1 adult')
    })
  })

  describe('formatCancellationInfo', () => {
    it('handles null / missing cancellation date', () => {
      expect(formatCancellationInfo(null)).toEqual({ available: false, text: 'Free cancellation is not available' })
      expect(formatCancellationInfo(undefined)).toEqual({ available: false, text: 'Free cancellation is not available' })
    })

    it('does not crash on non-string cancellation values', () => {
      expect(formatCancellationInfo(true as never)).toEqual({ available: true, text: 'Free cancellation available' })
      expect(formatCancellationInfo(0 as never)).toEqual({ available: false, text: 'Free cancellation is not available' })
    })

    it('formats future YYYY-MM-DD date string', () => {
      expect(formatCancellationInfo('2029-01-05')).toEqual({ available: true, text: 'Free cancellation until January 5' })
    })

    it('formats expired YYYY-MM-DD date string', () => {
      expect(formatCancellationInfo('2020-01-05')).toEqual({ available: false, text: 'Free cancellation is no longer available for this trip' })
    })
  })

  describe('extractUniqueDestinations', () => {
    it('returns empty array when input is null, undefined, or empty', () => {
      expect(extractUniqueDestinations(undefined)).toEqual([])
      expect(extractUniqueDestinations([])).toEqual([])
    })

    it('extracts unique non-empty destination strings', () => {
      const tours = [
        { destination: 'Santorini, Greece' },
        { destination: 'Kyoto, Japan' },
        { destination: 'Santorini, Greece' },
        { destination: '' },
      ]
      expect(extractUniqueDestinations(tours)).toEqual([
        'Santorini, Greece',
        'Kyoto, Japan',
      ])
    })
  })

  describe('calculateTourPrice enterprise formula tests', () => {
    const mockSupplements = {
      BB: 0,
      HB: 35,
      FB: 60,
      AI: 90,
    }

    it('calculates price correctly with base price, supplement and duration', () => {
      const result = calculateTourPrice({
        basePricePerPerson: 1000,
        numberOfTourists: 2,
        durationDays: 7,
        mealPlan: 'AI',
        mealSupplementsPerDay: { AI: 25 },
      })
      expect(result).toBe(2350)
    })

    it('matches duration specific prices from pricesByDuration map', () => {
      const result = calculateTourPrice({
        basePricePerPerson: 1000,
        numberOfTourists: 2,
        durationDays: 10,
        mealPlan: 'BB',
        pricesByDuration: { '10 days': 1500 },
      })
      expect(result).toBe(3000)
    })

    it('handles lowercase or mixed case meal supplement keys from backend', () => {
      const result = calculateTourPrice({
        basePricePerPerson: 1000,
        numberOfTourists: 2,
        durationDays: 7,
        mealPlan: 'ai',
        mealSupplementsPerDay: { ai: 25 },
      })
      expect(result).toBe(2350)
    })

    it('calculates basic price correctly without supplements for 1 tourist', () => {
      const price = calculateTourPrice({
        basePricePerPerson: 1400,
        numberOfTourists: 1,
        durationDays: 7,
        mealPlan: 'BB',
        mealSupplementsPerDay: mockSupplements,
      })
      expect(price).toBe(1400)
    })

    it('calculates price correctly with daily meal supplement (AI: $90 * 10 days = $900)', () => {
      const price = calculateTourPrice({
        basePricePerPerson: 1400,
        numberOfTourists: 2,
        durationDays: 10,
        mealPlan: 'AI',
        mealSupplementsPerDay: mockSupplements,
      })
      expect(price).toBe(4600)
    })

    it('handles edge cases safely (0 duration, missing supplements, invalid string inputs)', () => {
      const price = calculateTourPrice({
        basePricePerPerson: 1000,
        numberOfTourists: 0,
        durationDays: 0,
        mealPlan: 'UNKNOWN',
        mealSupplementsPerDay: undefined,
      })
      expect(price).toBe(1000)
    })
  })
})
