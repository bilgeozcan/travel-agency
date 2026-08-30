import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import personIcon from '@/assets/icons/Person.svg'
import logoutIcon from '@/assets/icons/log-out.svg'
import { useRoleAccess } from '@/hooks/useRoleAccess'
import { useClickOutside } from '@/hooks/useClickOutside'
import type { ProfileDropdownProps } from './types'
import './ProfileDropdown.css'

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  user,
  role,
  isOpen,
  onClose,
  onNavigateToProfile,
  onLogout,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { isAgent } = useRoleAccess(user, role)

  useClickOutside(dropdownRef, onClose, isOpen)

  const location = useLocation()
  const currentPathname = location.pathname
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (isOpen) {
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPathname])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.email.split('@')[0]

  return (
    <div
      ref={dropdownRef}
      className="profile-dropdown-card"
      role="menu"
      aria-label="User Profile Menu"
    >
      {/* Header Info: Full Name, Email, and Travel Agent Role */}
      <div className="profile-user-summary">
        <h4 className="profile-user-name">{displayName}</h4>
        <p className="profile-user-email text-subtitle">{user.email}</p>
        {isAgent && <span className="profile-user-role">Travel Agent</span>}
      </div>

      <div className="profile-dropdown-divider" />

      {/* Menu Options: My Profile & Logout */}
      <div className="profile-menu-items">
        <button
          type="button"
          className="profile-menu-item"
          onClick={() => {
            onClose()
            onNavigateToProfile?.()
          }}
          role="menuitem"
        >
          <img src={personIcon} alt="" className="menu-item-icon" aria-hidden="true" />
          <span className="menu-item-label">My Profile</span>
        </button>

        <button
          type="button"
          className="profile-menu-item profile-menu-item--logout"
          onClick={() => {
            onClose()
            onLogout?.()
          }}
          role="menuitem"
        >
          <img src={logoutIcon} alt="" className="menu-item-icon" aria-hidden="true" />
          <span className="menu-item-label">Sign Out</span>
        </button>
      </div>
    </div>
  )
}
