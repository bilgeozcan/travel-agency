import type { UserRole } from '@/types/auth'
import { ROLE_GROUPS } from '@/utils/authUtils'
import { PATHS } from './paths'

export interface AppRouteConfig {
  path: string
  allowedRoles?: UserRole[]
  guestOnly?: boolean
}

export const APP_ROUTES_CONFIG: AppRouteConfig[] = [
  { path: '/', allowedRoles: undefined },
  { path: PATHS.LOGIN, guestOnly: true },
  { path: PATHS.REGISTER, guestOnly: true },
  { path: PATHS.RESET_PASSWORD, guestOnly: true },
  { path: PATHS.RESET_PASSWORD_VERIFY, guestOnly: true },
  { path: PATHS.RESET_PASSWORD_NEW, guestOnly: true },
  { path: PATHS.DASHBOARD, allowedRoles: undefined },
  { path: PATHS.PROFILE, allowedRoles: ['Customer', 'Travel Agent', 'Admin'] },
  { path: PATHS.MANAGE_TOURS, allowedRoles: [...ROLE_GROUPS.STAFF_ONLY] },
  { path: PATHS.TOUR_DETAILS, allowedRoles: undefined },
]

/**
 * Retrieves allowed roles for a given route path from APP_ROUTES_CONFIG (SSOT)
 */
export function getRouteAllowedRoles(path: string): UserRole[] | undefined {
  const route = APP_ROUTES_CONFIG.find((r) => r.path === path)
  return route?.allowedRoles
}
