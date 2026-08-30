import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/Logo/Logo'
import { ProfileDropdown } from '@/components/layout/Header/ProfileDropdown'
import { HeaderProfile } from '@/components/layout/Header/HeaderProfile'
import { getHeaderTabs } from './headerNavConfig'
import type { HeaderProps, NavTab } from './types'
import './Header.css'

export type { HeaderProps, NavTab }

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  user,
  role,
  isAuthenticated,
  onTabChange,
  onProfileClick,
  onNavigateToProfile,
  onLogout,
  onSignInClick,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const isLoggedIn = Boolean(user || isAuthenticated)

  const handleUserIconClick = () => {
    setIsProfileOpen((prev) => !prev)
    onProfileClick?.()
  }

  const activeRole = role || user?.role || null
  const currentUser = user ?? { email: '' }
  const navTabs = getHeaderTabs(isLoggedIn, activeRole)

  return (
    <header className="app-header">
      {/* Sol: Logo (Blue/Blue 05 variant) */}
      <Link to="/" className="header-logo-section" aria-label="Go to homepage">
        <Logo variant="blue" size="md" />
      </Link>

      {/* Orta: Navigasyon Linkleri */}
      <nav className="header-nav" aria-label="Main Navigation">
        <div className="nav-items-container">
          {navTabs.map((tab) => {
            const isTabActive =
              activeTab === tab.id ||
              (activeTab === 'tours' && (tab.id === 'my-tours' || tab.id === 'bookings'))

            return (
              <button
                key={tab.id}
                type="button"
                className={`nav-link ${isTabActive ? 'active' : ''}`}
                onClick={() => onTabChange?.(tab.id === 'my-tours' || tab.id === 'bookings' ? 'tours' : tab.id)}
              >
                <span>{tab.label}</span>
                {isLoggedIn && isTabActive && <span className="active-bar" />}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Sağ: User Profile Icon Dropdown veya Sign In Butonu */}
      <div className="header-user-section">
        {isLoggedIn ? (
          <>
            <HeaderProfile
              user={currentUser}
              role={activeRole}
              isOpen={isProfileOpen}
              onClick={handleUserIconClick}
            />

            <ProfileDropdown
              user={currentUser}
              role={activeRole}
              isOpen={isProfileOpen}
              onClose={() => setIsProfileOpen(false)}
              onNavigateToProfile={onNavigateToProfile}
              onLogout={onLogout}
            />
          </>
        ) : (
          <button
            type="button"
            className="header-sign-in-btn"
            onClick={onSignInClick}
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  )
}

