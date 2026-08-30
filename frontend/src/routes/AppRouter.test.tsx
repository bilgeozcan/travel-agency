import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { authService } from '@/api/services/auth.service'
import { AppRouter } from './AppRouter'
import { PATHS } from './paths'

vi.mock('@/api/services/auth.service', () => ({
  authService: {
    clearSession: vi.fn(),
    getSession: vi.fn(),
    login: vi.fn(),
    saveSession: vi.fn(),
  },
}))

const setPath = (path: string): void => {
  window.history.replaceState({}, '', path)
}

function renderAppRouter() {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return render(
    <QueryClientProvider client={testQueryClient}>
      <AppRouter />
    </QueryClientProvider>
  )
}

describe('AppRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authService.getSession).mockReturnValue(null)
  })

  it('renders guest main page with Guest Header on root path', async () => {
    setPath('/')
    renderAppRouter()

    await waitFor(() => expect(screen.getByText('Search for your next tour')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /All tours/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Sign in$/i })).toBeInTheDocument()
  })

  it('navigates guest to login page when clicking Sign in button in Header', async () => {
    setPath('/')
    renderAppRouter()

    await waitFor(() => expect(screen.getByRole('button', { name: /^Sign in$/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^Sign in$/i }))

    await waitFor(() => expect(window.location.pathname).toBe(PATHS.LOGIN))
    expect(screen.getByText(/WELCOME BACK/i)).toBeInTheDocument()
  })

  it('redirects authenticated users from login route to the dashboard', async () => {
    vi.mocked(authService.getSession).mockReturnValue({
      accessToken: 'mock-access-token',
      expiresAt: Date.now() + 60_000,
      user: { email: 'user@example.com' },
    })
    setPath(PATHS.LOGIN)
    renderAppRouter()

    await waitFor(() => expect(window.location.pathname).toBe(PATHS.DASHBOARD))
  })

  it('navigates authenticated user from tour details page to My tours when My tours tab is clicked', async () => {
    vi.mocked(authService.getSession).mockReturnValue({
      accessToken: 'mock-access-token',
      expiresAt: Date.now() + 60_000,
      user: { email: 'user@example.com', role: 'Customer' },
    })
    setPath('/tours/tour-1')
    renderAppRouter()

    await waitFor(() => expect(screen.getByRole('button', { name: /^My tours$/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^My tours$/i }))

    await waitFor(() => {
      expect(window.location.pathname).toBe(PATHS.DASHBOARD)
      expect(screen.getByRole('button', { name: /^All tours$/i })).toBeInTheDocument()
    })
  })

  it('allows authenticated customers to access the profile page', async () => {
    vi.mocked(authService.getSession).mockReturnValue({
      accessToken: 'mock-access-token',
      expiresAt: Date.now() + 60_000,
      user: { email: 'customer@example.com', role: 'Customer', firstName: 'Jane', lastName: 'Doe' },
    })
    setPath(PATHS.PROFILE)
    renderAppRouter()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'My profile' })).toBeInTheDocument())
    expect(window.location.pathname).toBe(PATHS.PROFILE)
  })

  it('navigates from login page to reset password screen when clicking Forgot password link', async () => {
    setPath(PATHS.LOGIN)
    renderAppRouter()

    await waitFor(() => expect(screen.getByText('Forgot password?')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Forgot password?'))

    await waitFor(() => {
      expect(window.location.pathname).toBe(PATHS.RESET_PASSWORD)
      expect(screen.getByRole('heading', { name: 'Reset password' })).toBeInTheDocument()
    })
  })
})
