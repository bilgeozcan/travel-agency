import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute'
import { useAuth } from '@/providers/AuthContext'

vi.mock('@/providers/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)

describe('ProtectedRoute', () => {
  it('renders PageLoader while auth is loading', () => {
    mockedUseAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: null,
      role: null,
      expiresAt: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      restoreSession: vi.fn(),
      updateUser: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.queryByText('Protected Content')).toBeNull()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('redirects unauthenticated users to /login preserving target location', () => {
    mockedUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      role: null,
      expiresAt: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      restoreSession: vi.fn(),
      updateUser: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).toBeNull()
  })

  it('redirects users without allowed role to /dashboard', () => {
    mockedUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { email: 'customer@test.com', role: 'Customer' },
      role: 'Customer',
      expiresAt: Date.now() + 3600000,
      signIn: vi.fn(),
      signOut: vi.fn(),
      restoreSession: vi.fn(),
      updateUser: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/agent-only']}>
        <Routes>
          <Route
            path="/agent-only"
            element={
              <ProtectedRoute allowedRoles={['Travel Agent', 'Admin']}>
                <div>Agent Only Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
    expect(screen.queryByText('Agent Only Content')).toBeNull()
  })

  it('renders children when authenticated user has allowed role', () => {
    mockedUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { email: 'agent@test.com', role: 'TRAVEL_AGENT' },
      role: 'TRAVEL_AGENT',
      expiresAt: Date.now() + 3600000,
      signIn: vi.fn(),
      signOut: vi.fn(),
      restoreSession: vi.fn(),
      updateUser: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/agent-only']}>
        <Routes>
          <Route
            path="/agent-only"
            element={
              <ProtectedRoute allowedRoles={['Travel Agent', 'Admin']}>
                <div>Agent Only Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Agent Only Content')).toBeInTheDocument()
  })
})
