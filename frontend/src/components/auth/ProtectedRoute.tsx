import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/providers/AuthContext'
import { isRoleAllowed } from '@/utils/authUtils'
import type { UserRole } from '@/types/auth'
import { PageLoader } from '@/components/ui/PageLoader/PageLoader'
import { PATHS } from '@/routes/paths'

export interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
  children: React.ReactElement
  redirectTo?: string
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  children,
  redirectTo = PATHS.DASHBOARD,
}) => {
  const { isAuthenticated, isLoading, role, user } = useAuth()
  const location = useLocation()

  // Preventing false redirects on F5 reload while auth session is restoring
  if (isLoading) {
    return <PageLoader />
  }

  // Unauthenticated users are redirected to /login preserving target location
  if (!isAuthenticated) {
    return <Navigate to={PATHS.LOGIN} state={{ from: location }} replace />
  }

  // Role validation when allowedRoles is specified
  const effectiveRole = role || user?.role
  if (allowedRoles && allowedRoles.length > 0) {
    if (!isRoleAllowed(effectiveRole, allowedRoles)) {
      return <Navigate to={redirectTo} replace />
    }
  }

  return children
}
