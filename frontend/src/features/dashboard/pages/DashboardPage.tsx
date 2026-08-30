import React from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Header, type NavTab } from '@/components/layout/Header/Header'
import type { AuthenticatedUser } from '@/features/auth/types/auth'
import type { TourItem } from '@/features/tours/types/tours'
import {
  getDashboardTabComponent,
  isValidTab,
} from '../config/dashboardTabRegistry'
import { tourDetailsPath } from '@/routes/paths'
import { useRoleAccess } from '@/hooks/useRoleAccess'
import './DashboardPage.css'

export interface DashboardPageProps {
  user?: AuthenticatedUser | null
  role?: string | null
  onLogout?: () => void
  onNavigateToProfile?: () => void
  onSignInClick?: () => void
  onCreateAccountClick?: () => void
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  user,
  role,
  onLogout,
  onNavigateToProfile,
  onSignInClick,
  onCreateAccountClick,
}) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  // Extract raw candidate tab string from URL Search Params or Router State fallback
  const rawTabFromUrl = searchParams.get('tab')
  const rawTabFromState = (location.state as { tab?: NavTab } | null)?.tab
  const candidateTab = rawTabFromUrl || rawTabFromState || 'main'

  // Whitelist Sanitization: Guarantee activeTab is strictly a valid NavTab ID (or defaults to 'main')
  const activeTab: NavTab = isValidTab(candidateTab) ? candidateTab : 'main'

  const handleTabChange = (nextTab: NavTab) => {
    const safeTab = isValidTab(nextTab) ? nextTab : 'main'
    setSearchParams({ tab: safeTab }, { replace: true })
  }

  const { userRole } = useRoleAccess(user, role)

  const handleSelectTour = (tour: TourItem) => {
    navigate(tourDetailsPath(tour.id))
  }

  return (
    <div className="dashboard-page-wrapper">
      {/* Top Header with Sanitized Active Tab State */}
      <Header
        activeTab={activeTab}
        user={user}
        role={role}
        onTabChange={handleTabChange}
        onLogout={onLogout}
        onNavigateToProfile={onNavigateToProfile}
        onSignInClick={onSignInClick}
      />

      {/* Main Content Area: Pure Dumb Container delegating to Tab Registry */}
      <main className="dashboard-content">
        <div className="dashboard-tab-panel dashboard-tab-panel--active">
          {getDashboardTabComponent(activeTab, {
            isAuthenticated: Boolean(user),
            userRole,
            onSignInClick,
            onCreateAccountClick,
            onSelectTour: handleSelectTour,
          })}
        </div>
      </main>
    </div>
  )
}
