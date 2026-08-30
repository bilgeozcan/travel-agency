import { describe, expect, it } from 'vitest'
import {
  isRoleAllowed,
  normalizeUserRole,
  RESTRICTED_FALLBACK_USER,
  ROLE_HIERARCHY,
} from '../utils/authUtils'

describe('auth types & RBAC utilities', () => {
  describe('normalizeUserRole', () => {
    it('normalizes string variations for Travel Agent case-insensitively', () => {
      expect(normalizeUserRole('TRAVEL_AGENT')).toBe('Travel Agent')
      expect(normalizeUserRole('travel agent')).toBe('Travel Agent')
      expect(normalizeUserRole('AGENT')).toBe('Travel Agent')
      expect(normalizeUserRole('Travel Agent')).toBe('Travel Agent')
    })

    it('normalizes string variations for Customer case-insensitively', () => {
      expect(normalizeUserRole('CUSTOMER')).toBe('Customer')
      expect(normalizeUserRole('customer')).toBe('Customer')
      expect(normalizeUserRole('Customer')).toBe('Customer')
    })

    it('normalizes string variations for Admin case-insensitively', () => {
      expect(normalizeUserRole('ADMIN')).toBe('Admin')
      expect(normalizeUserRole('administrator')).toBe('Admin')
      expect(normalizeUserRole('Admin')).toBe('Admin')
    })

    it('defaults to Customer for null/undefined/empty input', () => {
      expect(normalizeUserRole(null), 'null role input must safely default to Customer').toBe('Customer')
      expect(normalizeUserRole(undefined), 'undefined role input must safely default to Customer').toBe('Customer')
      expect(normalizeUserRole(''), 'empty string role input must safely default to Customer').toBe('Customer')
    })

    it('resolves hierarchy precedence (Admin > Travel Agent > Customer) for role arrays', () => {
      expect(normalizeUserRole(['CUSTOMER', 'TRAVEL_AGENT']), 'Array with Customer and Travel Agent must resolve to Travel Agent').toBe('Travel Agent')
      expect(normalizeUserRole(['CUSTOMER', 'TRAVEL_AGENT', 'ADMIN']), 'Array containing Admin must resolve to Admin').toBe('Admin')
      expect(normalizeUserRole(['CUSTOMER']), 'Array with single Customer role must resolve to Customer').toBe('Customer')
    })

    it('handles malformed and non-string inputs safely without crashing', () => {
      expect(normalizeUserRole(['UNKNOWN_ROLE_1', 'UNKNOWN_ROLE_2']), 'Array of unknown roles must safely fall back to Customer').toBe('Customer')
    })
  })

  describe('isRoleAllowed', () => {

    it('returns true when user role is in allowed roles', () => {
      expect(isRoleAllowed('TRAVEL_AGENT', ['Travel Agent', 'Admin']), 'Travel Agent should be allowed').toBe(true)
      expect(isRoleAllowed('ADMIN', ['Admin']), 'Admin should be allowed').toBe(true)
      expect(isRoleAllowed('Customer', ['Customer']), 'Customer should be allowed').toBe(true)
    })

    it('returns false when user role is not in allowed roles', () => {
      expect(isRoleAllowed('Customer', ['Travel Agent', 'Admin']), 'Customer should NOT be allowed access to agent/admin routes').toBe(false)
      expect(isRoleAllowed('TRAVEL_AGENT', ['Admin']), 'Travel Agent should NOT be allowed access to admin-only routes').toBe(false)
      expect(isRoleAllowed(null, ['Customer', 'Admin']), 'null role should NOT be allowed access').toBe(false)
      expect(isRoleAllowed('INVALID_ROLE', ['Travel Agent']), 'Unrecognized role should NOT be allowed access').toBe(false)
    })

    it('handles empty allowedRoles array by denying all access', () => {
      expect(isRoleAllowed('Admin', []), 'Empty allowed roles list must reject all user roles').toBe(false)
      expect(isRoleAllowed('Travel Agent', []), 'Empty allowed roles list must reject Travel Agent').toBe(false)
    })
  })

  describe('ROLE_HIERARCHY & RESTRICTED_FALLBACK_USER', () => {
    it('defines expected role levels', () => {
      expect(ROLE_HIERARCHY.Admin, 'Admin level must be strictly higher than Travel Agent level').toBeGreaterThan(ROLE_HIERARCHY['Travel Agent'])
      expect(ROLE_HIERARCHY['Travel Agent'], 'Travel Agent level must be strictly higher than Customer level').toBeGreaterThan(ROLE_HIERARCHY.Customer)
    })

    it('has valid fallback user', () => {
      expect(RESTRICTED_FALLBACK_USER.role, 'Fallback user role must be Customer').toBe('Customer')
      expect(RESTRICTED_FALLBACK_USER.email, 'Fallback user email must be empty').toBe('')
    })
  })
})
