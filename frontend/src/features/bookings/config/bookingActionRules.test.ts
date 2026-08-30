import { describe, expect, it } from 'vitest'
import { isBookingActionAllowed } from './bookingActionRules'

describe('BOOKING_ACTION_RULES permission matrix', () => {
  describe('cancel action', () => {
    it('allows Customer, Travel Agent, and Admin for BOOKED and CONFIRMED statuses', () => {
      expect(isBookingActionAllowed('cancel', 'Customer', 'BOOKED')).toBe(true)
      expect(isBookingActionAllowed('cancel', 'Customer', 'CONFIRMED')).toBe(true)
      expect(isBookingActionAllowed('cancel', 'Travel Agent', 'BOOKED')).toBe(true)
      expect(isBookingActionAllowed('cancel', 'Travel Agent', 'CONFIRMED')).toBe(true)
      expect(isBookingActionAllowed('cancel', 'Admin', 'BOOKED')).toBe(true)
    })

    it('denies cancel for STARTED, FINISHED, and CANCELED statuses', () => {
      expect(isBookingActionAllowed('cancel', 'Customer', 'STARTED')).toBe(false)
      expect(isBookingActionAllowed('cancel', 'Customer', 'FINISHED')).toBe(false)
      expect(isBookingActionAllowed('cancel', 'Customer', 'CANCELED')).toBe(false)
    })
  })

  describe('edit action', () => {
    it('allows Edit ONLY for BOOKED status', () => {
      expect(isBookingActionAllowed('edit', 'Customer', 'BOOKED')).toBe(true)
      expect(isBookingActionAllowed('edit', 'Travel Agent', 'BOOKED')).toBe(true)
    })

    it('denies Edit for CONFIRMED status per Jira AC', () => {
      expect(isBookingActionAllowed('edit', 'Customer', 'CONFIRMED')).toBe(false)
      expect(isBookingActionAllowed('edit', 'Travel Agent', 'CONFIRMED')).toBe(false)
    })
  })

  describe('checkAndConfirm action', () => {
    it('allows Check & Confirm ONLY for Travel Agent on BOOKED status', () => {
      expect(isBookingActionAllowed('checkAndConfirm', 'Travel Agent', 'BOOKED')).toBe(true)
      expect(isBookingActionAllowed('checkAndConfirm', 'Customer', 'BOOKED')).toBe(false)
    })

    it('denies Check & Confirm when status is CONFIRMED', () => {
      expect(isBookingActionAllowed('checkAndConfirm', 'Travel Agent', 'CONFIRMED')).toBe(false)
    })
  })

  describe('uploadDocuments action', () => {
    it('allows Upload Documents for Customer on BOOKED and CONFIRMED statuses', () => {
      expect(isBookingActionAllowed('uploadDocuments', 'Customer', 'BOOKED')).toBe(true)
      expect(isBookingActionAllowed('uploadDocuments', 'Customer', 'CONFIRMED')).toBe(true)
    })

    it('denies Upload Documents for Travel Agent', () => {
      expect(isBookingActionAllowed('uploadDocuments', 'Travel Agent', 'BOOKED')).toBe(false)
    })
  })

  describe('giveFeedback action', () => {
    it('allows Give Feedback ONLY for Customer on STARTED and FINISHED statuses', () => {
      expect(isBookingActionAllowed('giveFeedback', 'Customer', 'STARTED')).toBe(true)
      expect(isBookingActionAllowed('giveFeedback', 'Customer', 'FINISHED')).toBe(true)
      expect(isBookingActionAllowed('giveFeedback', 'Customer', 'BOOKED')).toBe(false)
    })
  })
})
