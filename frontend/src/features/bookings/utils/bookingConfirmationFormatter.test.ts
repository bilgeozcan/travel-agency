import { describe, expect, it } from 'vitest'
import {
  formatBookingConfirmationGuestSummary,
  formatBookingConfirmationDate,
  calculateBookingConfirmationRefDate,
} from './bookingConfirmationFormatter'

describe('bookingConfirmationFormatter Utilities', () => {
  describe('formatBookingConfirmationGuestSummary', () => {
    it('formats single adult correctly', () => {
      expect(formatBookingConfirmationGuestSummary(1, 0)).toBe('1 adult')
    })

    it('formats multiple adults correctly', () => {
      expect(formatBookingConfirmationGuestSummary(2, 0)).toBe('2 adults')
    })

    it('formats adults and children correctly with proper pluralization', () => {
      expect(formatBookingConfirmationGuestSummary(1, 1)).toBe('1 adult, 1 child')
      expect(formatBookingConfirmationGuestSummary(2, 3)).toBe('2 adults, 3 children')
    })
  })

  describe('formatBookingConfirmationDate', () => {
    it('formats YYYY-MM-DD into long US date format', () => {
      expect(formatBookingConfirmationDate('2025-01-15')).toBe('January 15, 2025')
    })

    it('returns raw string fallback if parsing fails', () => {
      expect(formatBookingConfirmationDate('')).toBe('')
    })
  })

  describe('calculateBookingConfirmationRefDate', () => {
    it('returns explicit bookingDate if provided', () => {
      const explicitDate = new Date('2025-01-01')
      const ref = calculateBookingConfirmationRefDate('2025-01-15', explicitDate)
      expect(ref.getTime()).toBe(explicitDate.getTime())
    })

    it('calculates historical fallback date when startDate is prior to system clock', () => {
      const ref = calculateBookingConfirmationRefDate('2020-05-20')
      expect(ref.getFullYear()).toBe(2020)
      expect(ref.getMonth()).toBe(4) // May
      expect(ref.getDate()).toBe(6) // 20 - 14 = 6
    })
  })
})
