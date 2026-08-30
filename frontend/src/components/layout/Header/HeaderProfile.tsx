import React from 'react'
import userIcon from '@/assets/icons/user.svg'
import { useRoleAccess } from '@/hooks/useRoleAccess'
import type { UserRole } from '@/types/auth'
import './HeaderProfile.css'

export interface HeaderProfileProps {
  user?: {
    email?: string
    name?: string
    role?: string
  } | null
  role?: string | null
  onClick?: () => void
  isOpen?: boolean
}

/**
 * HeaderProfile Component
 * Read-only user profile trigger component displaying avatar icon and role badge
 * (Role badge displayed ONLY for staff roles: 'Travel Agent' and 'Admin')
 */
export const HeaderProfile: React.FC<HeaderProfileProps> = ({
  user,
  role,
  onClick,
  isOpen = false,
}) => {
  const { userRole, isStaff } = useRoleAccess(user, role)

  const getRoleLabel = (r: UserRole): string => {
    if (r === 'Travel Agent') return 'Travel Agent'
    if (r === 'Admin') return 'Admin'
    return ''
  }

  const getRoleModifierClass = (r: UserRole): string => {
    if (r === 'Travel Agent') return 'header-profile__role-badge--agent'
    if (r === 'Admin') return 'header-profile__role-badge--admin'
    return ''
  }

  return (
    <button
      type="button"
      className="header-profile"
      onClick={onClick}
      aria-label="User profile menu"
      aria-haspopup="true"
      aria-expanded={isOpen}
    >
      <img src={userIcon} alt="User Avatar" className="header-profile__avatar" />

      {isStaff && (
        <span
          className={`header-profile__role-badge ${getRoleModifierClass(userRole)}`}
          data-testid="header-role-badge"
        >
          {getRoleLabel(userRole)}
        </span>
      )}
    </button>
  )
}
