import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/providers/AuthContext'
import { PATHS } from '@/routes/paths'
import type { NavTab } from '@/components/layout/Header/types'

/**
 * Centralized custom hook for Header navigation & profile state.
 * Eliminates repetitive event handlers across page & route components.
 */
export function useHeaderNavigation() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user, role, signOut } = useAuth()
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  // Derive activeTab automatically from current URL path
  const getActiveTab = (): NavTab | undefined => {
    if (location.pathname === '/' || location.pathname === PATHS.DASHBOARD) {
      return 'main'
    }
    return undefined
  }

  const handleTabChange = (tab: NavTab) => {
    if (tab === 'main') {
      navigate('/')
    } else if (tab === 'tours') {
      navigate(PATHS.DASHBOARD, { state: { tab: 'tours' } })
    }
  }

  const handleProfileClick = () => {
    setIsProfileOpen((prev) => !prev)
  }

  const handleCloseProfile = () => {
    setIsProfileOpen(false)
  }

  const handleNavigateToProfile = () => {
    setIsProfileOpen(false)
    navigate(PATHS.PROFILE)
  }

  const handleLogout = async () => {
    setIsProfileOpen(false)
    await signOut()
    navigate(PATHS.LOGIN, { replace: true })
  }

  const handleSignInClick = () => {
    navigate(PATHS.LOGIN)
  }

  return {
    activeTab: getActiveTab(),
    user,
    role,
    isAuthenticated,
    isProfileOpen,
    onTabChange: handleTabChange,
    onProfileClick: handleProfileClick,
    onCloseProfile: handleCloseProfile,
    onNavigateToProfile: handleNavigateToProfile,
    onLogout: handleLogout,
    onSignInClick: handleSignInClick,
    navigate,
  }
}
