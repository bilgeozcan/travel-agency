import React from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PATHS } from './paths'
import { getRouteAllowedRoles } from './routesConfig'
import { RegisterForm } from '@/features/auth/components/RegisterForm/RegisterForm'
import { LoginForm } from '@/features/auth/components/LoginForm/LoginForm'
import { ResetPasswordEmailScreen } from '@/features/auth/components/ResetPasswordEmailScreen/ResetPasswordEmailScreen'
import { VerificationCodeScreen } from '@/features/auth/components/VerificationCodeScreen/VerificationCodeScreen'
import { NewPasswordScreen } from '@/features/auth/components/NewPasswordScreen/NewPasswordScreen'

import { DashboardPage } from '@/features/dashboard/pages/DashboardPage'
import { TourDetailsPage } from '@/features/tours/pages/TourDetailsPage/TourDetailsPage'
import { ManageToursPage } from '@/features/tours/pages/ManageToursPage/ManageToursPage'
import { ProfilePage } from '@/features/profile/pages/ProfilePage/ProfilePage'
import { AuthProvider, useAuth } from '@/providers/AuthContext'
import { LoadingProvider } from '@/providers/LoadingContext'
import { PageLoader } from '@/components/ui/PageLoader/PageLoader'
import { Header } from '@/components/layout/Header/Header'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { PendingEditsNotification } from '@/features/bookings/components/PendingEditsNotification/PendingEditsNotification'
import type { AuthSession } from '@/features/auth/types/auth'
import type { AuthenticatedUser } from '@/features/auth/types/auth'

interface NavigationState {
  from?: { pathname: string }
  toastMessage?: string
}

interface ResetPasswordVerifyState {
  email?: string
}

const AppRoutes: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isLoading, user, role, signIn, signOut } = useAuth()
  const navigationState = location.state as NavigationState | null

  const handleLoginSuccess = (session: AuthSession) => {
    signIn(session)
    navigate(navigationState?.from?.pathname ?? PATHS.DASHBOARD, { replace: true })
  }

  const handleLogout = async () => {
    await signOut()
    navigate(PATHS.LOGIN, { replace: true })
  }

  if (isLoading) return <PageLoader />

  return (
    <>
      <PendingEditsNotification />
      <Routes>
        <Route path="/" element={<Navigate replace to={PATHS.DASHBOARD} />} />
        <Route
          path={PATHS.LOGIN}
          element={
            isAuthenticated ? (
              <Navigate replace to={PATHS.DASHBOARD} />
            ) : (
              <LoginForm
                onNavigateToRegister={() => navigate(PATHS.REGISTER)}
                onNavigateToForgotPassword={() => navigate(PATHS.RESET_PASSWORD)}
                onLoginSuccess={handleLoginSuccess}
                initialToastMessage={navigationState?.toastMessage}
              />
            )
          }
        />
        <Route
          path={PATHS.REGISTER}
          element={
            isAuthenticated ? (
              <Navigate replace to={PATHS.DASHBOARD} />
            ) : (
              <RegisterForm onNavigateToLogin={() => navigate(PATHS.LOGIN)} />
            )
          }
        />
        <Route
          path={PATHS.RESET_PASSWORD}
          element={
            isAuthenticated ? (
              <Navigate replace to={PATHS.DASHBOARD} />
            ) : (
              <ResetPasswordEmailScreen
                onNavigateToRegister={() => navigate(PATHS.REGISTER)}
                onNavigateToVerify={(email) =>
                  navigate(PATHS.RESET_PASSWORD_VERIFY, { state: { email } })
                }
                onNavigateToLogin={() => navigate(PATHS.LOGIN)}
              />
            )
          }
        />
        <Route
          path={PATHS.RESET_PASSWORD_VERIFY}
          element={
            isAuthenticated ? (
              <Navigate replace to={PATHS.DASHBOARD} />
            ) : (
              <VerificationCodeRoute
                onNavigateToResetPassword={(email, resetToken, code) =>
                  navigate(PATHS.RESET_PASSWORD_NEW, { state: { email, resetToken, code } })
                }
                onNavigateBackToEmail={() => navigate(PATHS.RESET_PASSWORD)}
              />
            )
          }
        />
        <Route
          path={PATHS.RESET_PASSWORD_NEW}
          element={
            isAuthenticated ? (
              <Navigate replace to={PATHS.DASHBOARD} />
            ) : (
              <NewPasswordRoute onNavigateToLogin={(toastMessage) => navigate(PATHS.LOGIN, { state: { toastMessage } })} />
            )
          }
        />
        <Route
          path={PATHS.DASHBOARD}
          element={
            <DashboardPage
              user={user}
              role={role}
              onLogout={handleLogout}
              onNavigateToProfile={() => navigate(PATHS.PROFILE)}
              onSignInClick={() => navigate(PATHS.LOGIN)}
              onCreateAccountClick={() => navigate(PATHS.REGISTER)}
            />
          }
        />
        <Route
          path={PATHS.PROFILE}
          element={
            <ProtectedRoute allowedRoles={getRouteAllowedRoles(PATHS.PROFILE)}>
              <ProfilePage
                user={user}
                role={role}
                onLogout={handleLogout}
                onNavigateToProfile={() => navigate(PATHS.PROFILE)}
                onSignInClick={() => navigate(PATHS.LOGIN)}
                onCreateAccountClick={() => navigate(PATHS.REGISTER)}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path={PATHS.MANAGE_TOURS}
          element={
            <ProtectedRoute allowedRoles={getRouteAllowedRoles(PATHS.MANAGE_TOURS)}>
              <ManageToursPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={PATHS.TOUR_DETAILS}
          element={
            <TourDetailsRoute
              user={user}
              role={role}
              isAuthenticated={isAuthenticated}
              onLogout={handleLogout}
              onNavigateToProfile={() => navigate(PATHS.PROFILE)}
              onSignInClick={() => navigate(PATHS.LOGIN)}
              onNavigateToMainPage={() => navigate('/')}
              onNavigateToSignIn={() => navigate(PATHS.LOGIN)}
              onNavigateToCreateAccount={() => navigate(PATHS.REGISTER)}
              onNavigateToMyTours={() => navigate(PATHS.DASHBOARD, { state: { tab: 'tours' } })}
            />
          }
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </>
  )
}

interface VerificationCodeRouteProps {
  onNavigateToResetPassword: (email: string, resetToken?: string, code?: string) => void
  onNavigateBackToEmail: () => void
}

const VerificationCodeRoute: React.FC<VerificationCodeRouteProps> = ({
  onNavigateToResetPassword,
  onNavigateBackToEmail,
}) => {
  const location = useLocation()
  const state = location.state as ResetPasswordVerifyState | null

  // Security Route Guard: Redirect to start of reset password flow if email missing (e.g. F5 or direct URL access)
  if (!state?.email) {
    return <Navigate replace to={PATHS.RESET_PASSWORD} />
  }

  return (
    <VerificationCodeScreen
      email={state.email}
      onNavigateToResetPassword={onNavigateToResetPassword}
      onNavigateBackToEmail={onNavigateBackToEmail}
    />
  )
}

interface ResetPasswordNewState {
  email?: string
  code?: string
  resetToken?: string
}

interface NewPasswordRouteProps {
  onNavigateToLogin: (toastMessage?: string) => void
}

const NewPasswordRoute: React.FC<NewPasswordRouteProps> = ({ onNavigateToLogin }) => {
  const location = useLocation()
  const state = location.state as ResetPasswordNewState | null

  // Security Route Guard: Redirect to start of reset password flow if email or code missing
  if (!state?.email || !state?.code) {
    return <Navigate replace to={PATHS.RESET_PASSWORD} />
  }

  return (
    <NewPasswordScreen
      email={state.email}
      confirmationCode={state.code}
      onNavigateToLogin={onNavigateToLogin}
    />
  )
}


interface TourDetailsRouteProps {
  user?: AuthenticatedUser | null
  role?: string | null
  isAuthenticated: boolean
  onLogout: () => void
  onNavigateToProfile: () => void
  onSignInClick: () => void
  onNavigateToMainPage: () => void
  onNavigateToSignIn: () => void
  onNavigateToCreateAccount: () => void
  onNavigateToMyTours?: () => void
}

const TourDetailsRoute: React.FC<TourDetailsRouteProps> = ({
  user,
  role,
  isAuthenticated,
  onLogout,
  onNavigateToProfile,
  onSignInClick,
  onNavigateToMainPage,
  onNavigateToSignIn,
  onNavigateToCreateAccount,
  onNavigateToMyTours,
}) => {
  const { tourId } = useParams<{ tourId: string }>()

  if (!tourId) {
    return <Navigate replace to="/" />
  }

  return (
    <div className="dashboard-page-wrapper">
      <Header
        activeTab="main"
        user={user}
        role={role}
        onTabChange={(tab) => {
          if (tab === 'main') {
            onNavigateToMainPage()
          } else if (tab === 'tours') {
            if (onNavigateToMyTours) {
              onNavigateToMyTours()
            }
          }
        }}
        onLogout={onLogout}
        onNavigateToProfile={onNavigateToProfile}
        onSignInClick={onSignInClick}
      />
      <main className="dashboard-content">
        <TourDetailsPage
          tourId={tourId}
          isAuthenticated={isAuthenticated}
          onNavigateToMainPage={onNavigateToMainPage}
          onNavigateToSignIn={onNavigateToSignIn}
          onNavigateToCreateAccount={onNavigateToCreateAccount}
          onNavigateToMyTours={onNavigateToMyTours}
        />
      </main>
    </div>
  )
}

export const AppRouter: React.FC = () => (
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    {/* LoadingProvider, AuthProvider'Ã„Â±n ÃƒÂ¼stÃƒÂ¼nde olmalÃ„Â± Ã¢â‚¬â€
        AuthContext, useLoading() hook'unu kullanabilmek iÃƒÂ§in
        LoadingProvider tree'sinin iÃƒÂ§inde olmasÃ„Â± Ã…Å¸arttÃ„Â±r. */}
    <LoadingProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </LoadingProvider>
  </BrowserRouter>
)
