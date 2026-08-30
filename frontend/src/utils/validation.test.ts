import { describe, it, expect } from 'vitest'
import {
  isValidName,
  isValidEmail,
  normalizeEmail,
  getPasswordChecks,
  getPasswordError,
  validateRegisterForm,
  ERROR_MESSAGES,
} from './validation'

describe('Validation Utilities', () => {
  describe('isValidName', () => {
    it('validates Latin letters, spaces, hyphens, and apostrophes up to 50 chars', () => {
      expect(isValidName('John')).toBe(true)
      expect(isValidName("O'Connor")).toBe(true)
      expect(isValidName('Anne-Marie')).toBe(true)
      expect(isValidName('John Doe')).toBe(true)
      expect(isValidName('John123')).toBe(false)
    })

    it('validates boundary lengths (50 chars valid, 51 chars invalid)', () => {
      const fiftyChars = 'a'.repeat(50)
      const fiftyOneChars = 'a'.repeat(51)
      expect(isValidName(fiftyChars)).toBe(true)
      expect(isValidName(fiftyOneChars)).toBe(false)
    })
  })

  describe('isValidEmail', () => {
    it('validates standard email formats', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true)
      expect(isValidEmail('invalid-email')).toBe(false)
      expect(isValidEmail('@domain.com')).toBe(false)
      expect(isValidEmail('user@.com')).toBe(false)
    })

    it('enforces 254 char max email length limit', () => {
      const longDomain = 'a'.repeat(245) + '@example.com'
      expect(longDomain.length).toBeGreaterThan(254)
      expect(isValidEmail(longDomain)).toBe(false)
    })
  })

  describe('normalizeEmail', () => {
    it('trims whitespace and converts email to lowercase', () => {
      expect(normalizeEmail('  User@Domain.COM  ')).toBe('user@domain.com')
    })
  })

  describe('getPasswordChecks & getPasswordError', () => {
    it('detects missing requirements individually', () => {
      expect(getPasswordError(getPasswordChecks('short1!'))).toBe('Password must be 8-64 characters long')
      expect(getPasswordError(getPasswordChecks('lowercase1!'))).toBe('At least one uppercase letter required')
      expect(getPasswordError(getPasswordChecks('UPPERCASE1!'))).toBe('At least one lowercase letter required')
      expect(getPasswordError(getPasswordChecks('NoNumberHere!'))).toBe('At least one number required')
      expect(getPasswordError(getPasswordChecks('NoSpecialChar123'))).toBe('At least one special character required')
      expect(getPasswordError(getPasswordChecks('Password123!'))).toBe(ERROR_MESSAGES.passwordBreached)
    })

    it('returns undefined for strong, unique password', () => {
      const checks = getPasswordChecks('UniqueSecurePass2026!')
      expect(getPasswordError(checks)).toBeUndefined()
    })
  })

  describe('validateRegisterForm', () => {
    it('returns empty errors object for valid registration data', () => {
      const validData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'ValidPass123!',
        confirmPassword: 'ValidPass123!',
      }
      expect(validateRegisterForm(validData)).toEqual({})
    })

    it('returns name errors for invalid names', () => {
      const invalidData = {
        firstName: 'John123',
        lastName: 'Doe456',
        email: 'john@example.com',
        password: 'ValidPass123!',
        confirmPassword: 'ValidPass123!',
      }
      const errors = validateRegisterForm(invalidData)
      expect(errors.firstName).toBe(ERROR_MESSAGES.firstName)
      expect(errors.lastName).toBe(ERROR_MESSAGES.lastName)
    })

    it('returns password mismatch error when passwords do not match', () => {
      const mismatchData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'ValidPass123!',
        confirmPassword: 'DifferentPass123!',
      }
      const errors = validateRegisterForm(mismatchData)
      expect(errors.confirmPassword).toBe(ERROR_MESSAGES.confirmPassword)
    })
  })
})
