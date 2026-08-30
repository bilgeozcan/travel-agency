export type UserRole = 'Customer' | 'Travel Agent' | 'Admin'

export type RoleInput = UserRole | string | string[] | null | undefined

/**
 * Single Source of Truth (SSOT) Role Groups for Application Permissions
 */
export const ROLE_GROUPS = {
  ALL_AUTHENTICATED: ['Customer', 'Travel Agent', 'Admin'] as UserRole[],
  STAFF_ONLY: ['Travel Agent', 'Admin'] as UserRole[],
  CUSTOMER_ONLY: ['Customer', 'Admin'] as UserRole[],
  ADMIN_ONLY: ['Admin'] as UserRole[],
} as const

export interface User {
  readonly id: string
  readonly email: string
  readonly role: UserRole | string | string[]
  readonly name?: string
  readonly firstName?: string
  readonly lastName?: string
}

export interface AuthenticatedUser {
  id?: string
  email: string
  firstName?: string
  lastName?: string
  role?: UserRole | string
}

export interface AuthSession {
  accessToken: string
  expiresAt: number
  user: AuthenticatedUser
}
