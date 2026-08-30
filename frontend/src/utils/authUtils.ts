import type { UserRole, RoleInput, User } from '@/types/auth'
import { ROLE_GROUPS } from '@/types/auth'

export { ROLE_GROUPS }

export const RESTRICTED_FALLBACK_USER: User = {
  id: '',
  email: '',
  role: 'Customer',
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  Admin: 3,
  'Travel Agent': 2,
  Customer: 1,
}

/**
 * Normalizes backend/frontend role string representations (case-insensitive)
 * and resolves hierarchy precedence (Admin > Travel Agent > Customer)
 */
export function normalizeUserRole(roleInput?: RoleInput): UserRole {
  if (!roleInput) return 'Customer'

  const roles = Array.isArray(roleInput) ? roleInput : [roleInput]

  let highestRole: UserRole = 'Customer'

  for (const rawRole of roles) {
    if (!rawRole || typeof rawRole !== 'string') continue
    const cleanRole = rawRole.trim().toLowerCase()
    let mappedRole: UserRole = 'Customer'

    if (cleanRole === 'admin' || cleanRole === 'administrator') {
      mappedRole = 'Admin'
    } else if (
      cleanRole === 'travel_agent' ||
      cleanRole === 'travel agent' ||
      cleanRole === 'agent' ||
      cleanRole === 'travelagent'
    ) {
      mappedRole = 'Travel Agent'
    } else if (cleanRole === 'customer' || cleanRole === 'user') {
      mappedRole = 'Customer'
    }

    if (ROLE_HIERARCHY[mappedRole] > ROLE_HIERARCHY[highestRole]) {
      highestRole = mappedRole
    }
  }

  return highestRole
}

/**
 * Checks if a given user role is authorized within allowed roles array
 */
export function isRoleAllowed(
  userRole: RoleInput,
  allowedRoles: UserRole[] | readonly UserRole[]
): boolean {
  if (!userRole) return false
  const normalized = normalizeUserRole(userRole)
  return (allowedRoles as readonly UserRole[]).includes(normalized)
}

/**
 * Pure role type predicate helpers
 */
export function isTravelAgent(roleInput?: RoleInput): boolean {
  return normalizeUserRole(roleInput) === 'Travel Agent'
}

export function isCustomer(roleInput?: RoleInput): boolean {
  return normalizeUserRole(roleInput) === 'Customer'
}

export function isAdmin(roleInput?: RoleInput): boolean {
  return normalizeUserRole(roleInput) === 'Admin'
}

