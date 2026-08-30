import type { RoleInput, UserRole } from '@/types/auth'
import { isRoleAllowed, ROLE_GROUPS } from '@/utils/authUtils'
import type { NavTab } from './types'

export interface NavTabConfigItem {
  id: NavTab
  label: string
  requiresAuth?: boolean
  allowedRoles?: UserRole[]
}

/**
 * Pure Data Navigation Configuration (OCP Compliance)
 * Uses ROLE_GROUPS SSOT for allowedRoles.
 * Adding a new tab or permission rule requires only adding an entry here.
 */
export const NAV_CONFIG: NavTabConfigItem[] = [
  {
    id: 'main',
    label: 'All tours',
    requiresAuth: false,
  },
  {
    id: 'my-tours',
    label: 'My tours',
    requiresAuth: true,
    // Customer only — Admin must NOT see this tab
    allowedRoles: ['Customer'],
  },
  {
    id: 'bookings',
    label: 'Bookings',
    requiresAuth: true,
    // Travel Agent only — Admin must NOT see this tab
    allowedRoles: ['Travel Agent'],
  },
  {
    id: 'reports',
    label: 'Reports',
    requiresAuth: true,
    allowedRoles: [...ROLE_GROUPS.ADMIN_ONLY],
  },
]

/**
 * Pure evaluation function checking authentication and RBAC permissions for a single tab
 */
export function canAccessTab(
  tab: NavTabConfigItem,
  isLoggedIn: boolean,
  userRole?: RoleInput
): boolean {
  if (tab.requiresAuth && !isLoggedIn) return false
  if (tab.allowedRoles && tab.allowedRoles.length > 0) {
    const effectiveRole = userRole || (isLoggedIn ? 'Customer' : undefined)
    if (!isRoleAllowed(effectiveRole, tab.allowedRoles)) return false
  }
  return true
}

/**
 * Retrieves allowed roles for a given tab ID from NAV_CONFIG (SSOT)
 */
export function getTabAllowedRoles(tabId: NavTab): UserRole[] {
  const item = NAV_CONFIG.find((t) => t.id === tabId)
  return item?.allowedRoles ?? []
}

/**
 * Generates active header tabs for a given session and role context
 */
export function getHeaderTabs(
  isLoggedIn: boolean,
  userRole?: RoleInput
): NavTabConfigItem[] {
  return NAV_CONFIG.filter((tab) => canAccessTab(tab, isLoggedIn, userRole))
}
