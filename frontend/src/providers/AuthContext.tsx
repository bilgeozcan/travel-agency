import React, { createContext, useContext, useEffect, useState } from 'react'
import { authService } from '@/api/services/auth.service'
import type { AuthenticatedUser, AuthSession } from '@/features/auth/types/auth'
import { useLoading } from '@/providers/LoadingContext'

export interface AuthState {
  isLoading: boolean
  isAuthenticated: boolean
  user: AuthenticatedUser | null
  role: string | null
  expiresAt: number | null
}

interface AuthContextValue extends AuthState {
  signIn: (session: AuthSession) => void
  signOut: () => Promise<void>
  restoreSession: () => Promise<void>
  updateUser: (user: AuthenticatedUser) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const toState = (session: AuthSession | null, isLoading: boolean): AuthState => ({
  isLoading,
  isAuthenticated: session !== null,
  user: session?.user ?? null,
  role: session?.user.role ?? null,
  expiresAt: session?.expiresAt ?? null,
})

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [state, setState] = useState<AuthState>(() => toState(null, true))
  const { startLoading, stopLoading } = useLoading()

  const restoreSession = async () => {
    startLoading('auth')
    try {
      const existingSession = authService.getSession ? authService.getSession() : null

      if (existingSession) {
        setState(toState(existingSession, false))
        return
      }

      const refreshedSession = authService.refreshSession
        ? await authService.refreshSession()
        : null
      setState(toState(refreshedSession, false))
    } finally {
      stopLoading('auth')
    }
  }

  useEffect(() => {
    restoreSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!state.isAuthenticated || !state.expiresAt) return

    const timeRemaining = state.expiresAt - Date.now()
    if (timeRemaining <= 0) {
      authService.refreshSession().then((session) => {
        if (session) {
          setState(toState(session, false))
        }
      })
      return
    }

    const timer = setTimeout(() => {
      authService.refreshSession().then((session) => {
        // Update session if refresh succeeds, or reset state to null to keep UI in sync
        setState(toState(session, false))
      })
    }, timeRemaining)

    return () => clearTimeout(timer)
  }, [state.isAuthenticated, state.expiresAt])

  const signIn = (session: AuthSession) => {
    authService.saveSession(session)
    setState(toState(session, false))
  }

  const signOut = async (): Promise<void> => {
    await authService.signOut()
    setState(toState(null, false))
  }

  const updateUser = (user: AuthenticatedUser) => {
    setState((previousState) => {
      const updatedUser: AuthenticatedUser = {
        ...previousState.user,
        ...user,
        email: user.email || previousState.user?.email || '',
      }

      const currentSession = authService.getSession()
      if (currentSession) {
        authService.saveSession({
          ...currentSession,
          user: updatedUser,
        })
      }

      return {
        ...previousState,
        user: updatedUser,
        role: updatedUser.role ?? null,
      }
    })
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, restoreSession, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
