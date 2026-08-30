import { useMemo } from 'react'
import type { RoleInput, UserRole } from '@/types/auth'
import { isAdmin, isCustomer, isRoleAllowed, isTravelAgent, normalizeUserRole, ROLE_GROUPS } from '@/utils/authUtils'

export interface RoleAccessResult {
  userRole: UserRole
  isCustomer: boolean
  isTravelAgent: boolean
  isAgent: boolean
  isAdmin: boolean
  isStaff: boolean
  canAccess: (allowedRoles: UserRole[] | readonly UserRole[]) => boolean
}

/**
 * Custom Hook: useRoleAccess
 * Centralizes user role normalization, RBAC evaluation, and staff status checking into a single reactive hook.
 */
export function useRoleAccess(
  user?: { role?: RoleInput } | null,
  roleInput?: RoleInput
): RoleAccessResult {
  const userRole = useMemo(() => {
    return normalizeUserRole(roleInput || user?.role || null)
  }, [user?.role, roleInput])

  return useMemo(
    () => {
      const agentCheck = isTravelAgent(userRole)
      return {
        userRole,
        isCustomer: isCustomer(userRole),
        isTravelAgent: agentCheck,
        isAgent: agentCheck,
        isAdmin: isAdmin(userRole),
        isStaff: isRoleAllowed(userRole, ROLE_GROUPS.STAFF_ONLY),
        canAccess: (allowedRoles) => isRoleAllowed(userRole, allowedRoles),
      }
    },
    [userRole]
  )
}
