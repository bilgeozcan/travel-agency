import { describe, expect, it } from 'vitest'
import { isRoleAllowed, normalizeUserRole, ROLE_HIERARCHY } from './authUtils'

describe('authUtils', () => {
  describe('normalizeUserRole', () => {
    it('defaults to "Customer" when input is undefined or empty', () => {
      expect(normalizeUserRole()).toBe('Customer')
      expect(normalizeUserRole(undefined)).toBe('Customer')
      expect(normalizeUserRole([])).toBe('Customer')
    })

    it('normalizes string variants of Admin case-insensitively', () => {
      expect(normalizeUserRole('admin')).toBe('Admin')
      expect(normalizeUserRole('ADMIN')).toBe('Admin')
      expect(normalizeUserRole('administrator')).toBe('Admin')
      expect(normalizeUserRole('  Admin  ')).toBe('Admin')
    })

    it('normalizes string variants of Travel Agent case-insensitively', () => {
      expect(normalizeUserRole('travel_agent')).toBe('Travel Agent')
      expect(normalizeUserRole('TRAVEL_AGENT')).toBe('Travel Agent')
      expect(normalizeUserRole('travel agent')).toBe('Travel Agent')
      expect(normalizeUserRole('agent')).toBe('Travel Agent')
      expect(normalizeUserRole('travelagent')).toBe('Travel Agent')
    })

    it('normalizes string variants of Customer case-insensitively', () => {
      expect(normalizeUserRole('customer')).toBe('Customer')
      expect(normalizeUserRole('CUSTOMER')).toBe('Customer')
      expect(normalizeUserRole('user')).toBe('Customer')
      expect(normalizeUserRole('unknown_role')).toBe('Customer')
    })

    it('resolves highest role when array of roles is provided', () => {
      expect(normalizeUserRole(['Customer', 'Travel Agent'])).toBe('Travel Agent')
      expect(normalizeUserRole(['user', 'administrator', 'agent'])).toBe('Admin')
      expect(normalizeUserRole(['customer'])).toBe('Customer')
    })
  })

  describe('ROLE_HIERARCHY', () => {
    it('enforces correct precedence (Admin > Travel Agent > Customer)', () => {
      expect(ROLE_HIERARCHY['Admin']).toBeGreaterThan(ROLE_HIERARCHY['Travel Agent'])
      expect(ROLE_HIERARCHY['Travel Agent']).toBeGreaterThan(ROLE_HIERARCHY['Customer'])
    })
  })

  describe('isRoleAllowed', () => {
    it('returns false when userRole is empty or falsy', () => {
      expect(isRoleAllowed(undefined as any, ['Admin'])).toBe(false)
    })

    it('correctly checks if normalized role is included in allowedRoles', () => {
      expect(isRoleAllowed('travel_agent', ['Travel Agent', 'Admin'])).toBe(true)
      expect(isRoleAllowed('customer', ['Travel Agent', 'Admin'])).toBe(false)
      expect(isRoleAllowed(['customer', 'admin'], ['Admin'])).toBe(true)
    })
  })
})
