import React from 'react'
import type { NavTab } from '@/components/layout/Header/types'
import type { RoleInput } from '@/types/auth'
import { getTabAllowedRoles } from '@/components/layout/Header/headerNavConfig'
import { isRoleAllowed, isTravelAgent } from '@/utils/authUtils'
import type { TourItem } from '@/features/tours/types/tours'
import { AllToursPage } from '@/features/tours/pages/AllToursPage/AllToursPage'
import { MyToursPage } from '@/features/bookings/pages/MyToursPage/MyToursPage'
import { ReportsPage } from '@/features/reports/pages/ReportsPage/ReportsPage'

export interface DashboardTabContext {
  isAuthenticated: boolean
  userRole?: RoleInput
  onSignInClick?: () => void
  onCreateAccountClick?: () => void
  onSelectTour?: (tour: TourItem) => void
}

export type TabRenderer = (context: DashboardTabContext) => React.ReactNode

/**
 * Resolves generic tab alias 'tours' to role-specific tab ID ('bookings' for Travel Agent vs 'my-tours' for Customer)
 */
const resolveEffectiveTabId = (tabId: NavTab, role?: RoleInput): NavTab => {
  if (tabId === 'tours') {
    return isTravelAgent(role) ? 'bookings' : 'my-tours'
  }
  return tabId
}

/**
 * DRY Helper: Renders AllToursPage with specified or context-derived auth state
 */
const renderAllToursPage = (ctx: DashboardTabContext, overrideAuth?: boolean) => (
  <AllToursPage
    isAuthenticated={overrideAuth ?? ctx.isAuthenticated}
    onNavigateToSignIn={ctx.onSignInClick}
    onNavigateToCreateAccount={ctx.onCreateAccountClick}
    onSelectTour={ctx.onSelectTour}
    onBookTour={ctx.onSelectTour}
  />
)

/**
 * DRY Helper: Wraps protected page components in an SSOT Auth & RBAC Role Guard
 * Automatically looks up allowed roles from NAV_CONFIG via getTabAllowedRoles(tabId).
 */
const withTabRoleGuard = (
  ctx: DashboardTabContext,
  tabId: NavTab,
  protectedPage: React.ReactNode
) => {
  if (!ctx.isAuthenticated) {
    return renderAllToursPage(ctx, false)
  }

  const allowedRoles = getTabAllowedRoles(tabId)
  const isAllowed =
    allowedRoles.length === 0 || isRoleAllowed(ctx.userRole, allowedRoles)

  if (!isAllowed) {
    return renderAllToursPage(ctx, true)
  }

  return protectedPage
}

/**
 * Open-Closed Principle (OCP) Component Registry & Strategy Pattern:
 * Maps each NavTab ID to its corresponding page renderer.
 * Uses Delegation Pattern for the 'tours' alias to delegate to the effective target tab.
 */
export const TAB_COMPONENT_REGISTRY: Record<NavTab, TabRenderer> = {
  main: (ctx) => renderAllToursPage(ctx),
  'my-tours': (ctx) => withTabRoleGuard(ctx, 'my-tours', <MyToursPage />),
  bookings: (ctx) => withTabRoleGuard(ctx, 'bookings', <MyToursPage />),

  // Admin-only: Reports tab renders the reporting dashboard
  reports: (ctx) => withTabRoleGuard(ctx, 'reports', <ReportsPage />),

  // Delegation Pattern: 'tours' alias delegates rendering to the effective target tab ('bookings' vs 'my-tours')
  tours: (ctx) => {
    const effectiveTab = resolveEffectiveTabId('tours', ctx.userRole)
    const targetTab = effectiveTab === 'tours' ? 'my-tours' : effectiveTab
    return TAB_COMPONENT_REGISTRY[targetTab](ctx)
  },
}

/**
 * Pure Whitelist Type Guard verifying if a candidate tab string is a registered NavTab
 */
export function isValidTab(tab: unknown): tab is NavTab {
  return typeof tab === 'string' && tab in TAB_COMPONENT_REGISTRY
}

/**
 * Retrieves the page component for a given activeTab.
 * Safely falls back to 'main' (AllToursPage) if an unrecognized tab ID is provided.
 */
export function getDashboardTabComponent(
  activeTab: NavTab,
  context: DashboardTabContext
): React.ReactNode {
  const safeTab = isValidTab(activeTab) ? activeTab : 'main'
  return TAB_COMPONENT_REGISTRY[safeTab](context)
}
