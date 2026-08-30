import { describe, expect, it } from 'vitest'
import {
  formatGuestSummary,
  formatCancellationRole,
  cleanCanceledBy,
  cleanCancellationReason,
} from './bookingFormatter'

describe('bookingFormatter', () => {
  describe('formatGuestSummary', () => {
    it('formats single adult without children correctly', () => {
      const result = formatGuestSummary({
        guests: [{ firstName: 'Alice', lastName: 'Smith' }],
        adultsCount: 1,
        childrenCount: 0,
      })
      expect(result).toBe('Alice Smith (1 adult)')
    })

    it('formats multiple adults with 1 child correctly', () => {
      const result = formatGuestSummary({
        guests: [
          { firstName: 'Alice', lastName: 'Smith' },
          { firstName: 'Bob', lastName: 'Smith' },
        ],
        adultsCount: 2,
        childrenCount: 1,
      })
      expect(result).toBe('Alice Smith, Bob Smith (2 adults, 1 child)')
    })

    it('formats multiple adults with multiple children correctly', () => {
      const result = formatGuestSummary({
        guests: [{ firstName: 'Alice', lastName: 'Smith' }],
        adultsCount: 2,
        childrenCount: 3,
      })
      expect(result).toBe('Alice Smith (2 adults, 3 children)')
    })

    it('falls back to "Guest" when guests array is empty', () => {
      const result = formatGuestSummary({
        guests: [],
        adultsCount: 1,
        childrenCount: 0,
      })
      expect(result).toBe('Guest (1 adult)')
    })
  })

  describe('formatCancellationRole', () => {
    it('returns undefined for missing or empty input', () => {
      expect(formatCancellationRole(undefined)).toBeUndefined()
      expect(formatCancellationRole(null)).toBeUndefined()
      expect(formatCancellationRole('')).toBeUndefined()
    })

    it('identifies admin roles with precedence', () => {
      expect(formatCancellationRole('ADMIN')).toBe('Admin')
      expect(formatCancellationRole('admin_user')).toBe('Admin')
    })

    it('identifies agent roles', () => {
      expect(formatCancellationRole('TRAVEL_AGENT')).toBe('Travel agent')
      expect(formatCancellationRole('agent')).toBe('Travel agent')
      expect(formatCancellationRole('agent@travel.com')).toBe('Travel agent')
    })

    it('identifies customer/tourist roles', () => {
      expect(formatCancellationRole('CUSTOMER')).toBe('Tourist')
      expect(formatCancellationRole('tourist')).toBe('Tourist')
      expect(formatCancellationRole('user')).toBe('Tourist')
    })
  })

  describe('cleanCanceledBy', () => {
    it('returns undefined for empty/falsy raw values', () => {
      expect(cleanCanceledBy(undefined)).toBeUndefined()
      expect(cleanCanceledBy(null)).toBeUndefined()
      expect(cleanCanceledBy('')).toBeUndefined()
    })

    it('formats raw string and explicit rawRole correctly', () => {
      expect(cleanCanceledBy('customer@example.com', 'CUSTOMER')).toBe('customer@example.com (Tourist)')
      expect(cleanCanceledBy('agent@example.com', 'TRAVEL_AGENT')).toBe('agent@example.com (Travel agent)')
      expect(cleanCanceledBy('admin@example.com', 'ADMIN')).toBe('admin@example.com (Admin)')
      expect(cleanCanceledBy(null, 'CUSTOMER')).toBe('Tourist')
      expect(cleanCanceledBy(null, 'TRAVEL_AGENT')).toBe('Travel agent')
    })
  })

  describe('cleanCancellationReason', () => {
    it('returns "-" for empty or missing cancellation reason', () => {
      expect(cleanCancellationReason(undefined)).toBe('-')
      expect(cleanCancellationReason(null)).toBe('-')
      expect(cleanCancellationReason('')).toBe('-')
      expect(cleanCancellationReason('   ')).toBe('-')
    })

    it('returns trimmed cancellation reason when provided', () => {
      expect(cleanCancellationReason('Flight cancelled by airline')).toBe('Flight cancelled by airline')
      expect(cleanCancellationReason('  Change of plans  ')).toBe('Change of plans')
    })
  })
})
