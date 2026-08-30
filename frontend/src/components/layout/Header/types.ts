// Header Component Types & Interfaces
import type { AuthenticatedUser } from '@/features/auth/types/auth'

export type NavTab = 'main' | 'tours' | 'my-tours' | 'bookings' | 'reports'

export interface ProfileDropdownProps {
  user: AuthenticatedUser
  role?: string | null
  isOpen: boolean
  onClose: () => void
  onNavigateToProfile?: () => void
  onLogout?: () => void
}

export interface HeaderProps {
  activeTab?: NavTab
  user?: AuthenticatedUser | null
  role?: string | null
  isAuthenticated?: boolean
  onTabChange?: (tab: NavTab) => void
  onProfileClick?: () => void
  onNavigateToProfile?: () => void
  onLogout?: () => void
  onSignInClick?: () => void
}
