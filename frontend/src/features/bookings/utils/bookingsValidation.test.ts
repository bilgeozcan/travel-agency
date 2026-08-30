import { describe, expect, it } from 'vitest'
import { validateGuestInputs, BOOKING_ERRORS, getCancellationPolicyStatus, parseLocalDate, validateFeedbackInput } from './bookingsValidation'

describe('bookingsValidation Utilities', () => {
  describe('validateGuestInputs', () => {
    it('validates populated guest list cleanly', () => {
      const result = validateGuestInputs([
        { firstName: 'John', lastName: 'Doe' },
        { firstName: 'Jane', lastName: 'Smith' },
      ])
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual({})
    })

    it('detects empty first and last name fields and returns field-level error messages', () => {
      const result = validateGuestInputs([
        { firstName: '', lastName: '  ' },
      ])
      expect(result.isValid).toBe(false)
      expect(result.errors['customer_0_firstName']).toBe(BOOKING_ERRORS.FIRST_NAME_REQUIRED)
      expect(result.errors['customer_0_lastName']).toBe(BOOKING_ERRORS.LAST_NAME_REQUIRED)
    })
  })

  describe('parseLocalDate - Adversarial Edge Cases', () => {
    it('parses valid YYYY-MM-DD date strings at local midnight', () => {
      const parsed = parseLocalDate('2025-01-15')
      expect(parsed).not.toBeNull()
      expect(parsed?.getFullYear()).toBe(2025)
      expect(parsed?.getMonth()).toBe(0) // January is 0
      expect(parsed?.getDate()).toBe(15)
    })

    it('handles trimmed inputs and single-digit months/days correctly', () => {
      const parsed = parseLocalDate('  2025-9-5 ')
      expect(parsed).not.toBeNull()
      expect(parsed?.getFullYear()).toBe(2025)
      expect(parsed?.getMonth()).toBe(8) // September is 8
      expect(parsed?.getDate()).toBe(5)
    })

    it('returns null for non-string, empty, or malformed inputs without throwing', () => {
      expect(parseLocalDate('')).toBeNull()
      expect(parseLocalDate('   ')).toBeNull()
      expect(parseLocalDate(null as unknown as string)).toBeNull()
      expect(parseLocalDate(undefined as unknown as string)).toBeNull()
      expect(parseLocalDate('invalid-date-string')).toBeNull()
      expect(parseLocalDate('2025-13-45')).toBeNull()
    })
  })

  describe('getCancellationPolicyStatus', () => {
    it('uses the exact API-provided deadline, including the deadline day', () => {
      const status = getCancellationPolicyStatus({
        startDate: '2026-08-15',
        freeCancellationUntilDate: '2026-08-07',
        currentDate: new Date('2026-08-07T12:00:00'),
      })

      expect(status.isFree).toBe(true)
      expect(status.cutoffDateFormatted).toBe('August 7, 2026')
    })

    it('marks cancellation as non-refundable after the API deadline', () => {
      const status = getCancellationPolicyStatus({
        startDate: '2026-08-15',
        freeCancellationUntilDate: '2026-08-07',
        currentDate: new Date('2026-08-08T00:00:00'),
      })

      expect(status.isFree).toBe(false)
    })

    it('uses ten days before the start date only when the API omits the deadline', () => {
      const status = getCancellationPolicyStatus({
        startDate: '2026-08-15',
        currentDate: new Date('2026-08-05T12:00:00'),
      })

      expect(status.isFree).toBe(true)
      expect(status.cutoffDateFormatted).toBe('August 5, 2026')
    })

    it('does not apply the fallback when the API explicitly says free cancellation is unavailable', () => {
      const status = getCancellationPolicyStatus({
        startDate: '2026-08-15',
        freeCancellationUntilDate: null,
        currentDate: new Date('2026-08-05T12:00:00'),
      })

      expect(status.isFree).toBe(false)
    })

    it('uses the selected tour policy instead of the legacy fallback', () => {
      const status = getCancellationPolicyStatus({
        startDate: '2026-08-15',
        freeCancellationUntilDate: null,
        freeCancellationUntilDays: 7,
        currentDate: new Date('2026-08-08T12:00:00'),
      })

      expect(status.isFree).toBe(true)
      expect(status.cutoffDateFormatted).toBe('August 8, 2026')
    })

    it('keeps tours with a zero-day policy non-refundable', () => {
      const status = getCancellationPolicyStatus({
        startDate: '2026-08-15',
        freeCancellationUntilDays: 0,
        currentDate: new Date('2026-08-01T12:00:00'),
      })

      expect(status.isFree).toBe(false)
    })
  })

  describe('validateFeedbackInput - Validation & Edge Cases', () => {
    it('returns isSubmitDisabled true when rating is 0', () => {
      const res = validateFeedbackInput(0, '')
      expect(res.isSubmitDisabled).toBe(true)
      expect(res.showLowRatingWarning).toBe(false)
      expect(res.isValid).toBe(false)
    })

    it('edge case: negative ratings return disabled without showing warning', () => {
      const res = validateFeedbackInput(-1, 'Some text')
      expect(res.isSubmitDisabled).toBe(true)
      expect(res.showLowRatingWarning).toBe(false)
    })

    it('edge case: whitespace-only comments (tabs, newlines, spaces) trigger low rating warning for 1-3 stars', () => {
      const whitespaceVariations = ['  ', '\t', '\n\n  \t', '     \n  ']
      whitespaceVariations.forEach((comment) => {
        const res = validateFeedbackInput(2, comment)
        expect(res.isSubmitDisabled).toBe(true)
        expect(res.showLowRatingWarning).toBe(true)
        expect(res.isValid).toBe(false)
      })
    })

    it('edge case: non-empty comment for 1-3 stars enables submit and hides warning', () => {
      const res = validateFeedbackInput(1, 'Poor guide')
      expect(res.isSubmitDisabled).toBe(false)
      expect(res.showLowRatingWarning).toBe(false)
      expect(res.isValid).toBe(true)
    })

    it('edge case: 4-5 stars with empty comment allows submit without warning', () => {
      const res4 = validateFeedbackInput(4, '')
      expect(res4.isSubmitDisabled).toBe(false)
      expect(res4.showLowRatingWarning).toBe(false)

      const res5 = validateFeedbackInput(5, '   ')
      expect(res5.isSubmitDisabled).toBe(false)
      expect(res5.showLowRatingWarning).toBe(false)
    })

    it('edge case: handles unicode / emoji comments cleanly', () => {
      const res = validateFeedbackInput(3, 'Harika tur! 🌟✈️')
      expect(res.isSubmitDisabled).toBe(false)
      expect(res.showLowRatingWarning).toBe(false)
      expect(res.isValid).toBe(true)
    })

    it('edge case: comment at exactly 500 characters limit', () => {
      const comment500 = 'x'.repeat(500)
      const res = validateFeedbackInput(2, comment500)
      expect(res.isSubmitDisabled).toBe(false)
      expect(res.showLowRatingWarning).toBe(false)
      expect(res.isValid).toBe(true)
    })
  })
})
