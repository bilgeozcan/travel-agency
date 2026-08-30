import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useHeaderNavigation } from './useHeaderNavigation'
import { useAuth } from '@/providers/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { PATHS } from '@/routes/paths'

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
  useLocation: vi.fn(),
}))

vi.mock('@/providers/AuthContext', () => ({
  useAuth: vi.fn(),
}))

describe('useHeaderNavigation Custom Hook', () => {
  const mockNavigate = vi.fn()
  const mockSignOut = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)
    vi.mocked(useLocation).mockReturnValue({ pathname: '/' } as any)
    vi.mocked(useAuth).mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
      role: 'User',
      expiresAt: Date.now() + 3600,
      signOut: mockSignOut,
      restoreSession: vi.fn(),
      signIn: vi.fn(),
      updateUser: vi.fn(),
    })
  })

  it('derives activeTab as "main" when pathname is "/" or DASHBOARD', () => {
    vi.mocked(useLocation).mockReturnValue({ pathname: '/' } as any)
    const { result, rerender } = renderHook(() => useHeaderNavigation())
    expect(result.current.activeTab).toBe('main')

    vi.mocked(useLocation).mockReturnValue({ pathname: PATHS.DASHBOARD } as any)
    rerender()
    expect(result.current.activeTab).toBe('main')

    vi.mocked(useLocation).mockReturnValue({ pathname: '/other' } as any)
    rerender()
    expect(result.current.activeTab).toBeUndefined()
  })

  it('handles tab changes correctly', () => {
    const { result } = renderHook(() => useHeaderNavigation())

    act(() => {
      result.current.onTabChange('main')
    })
    expect(mockNavigate).toHaveBeenCalledWith('/')

    act(() => {
      result.current.onTabChange('tours')
    })
    expect(mockNavigate).toHaveBeenCalledWith(PATHS.DASHBOARD, { state: { tab: 'tours' } })
  })

  it('toggles and closes profile dropdown state', () => {
    const { result } = renderHook(() => useHeaderNavigation())
    expect(result.current.isProfileOpen).toBe(false)

    act(() => {
      result.current.onProfileClick()
    })
    expect(result.current.isProfileOpen).toBe(true)

    act(() => {
      result.current.onCloseProfile()
    })
    expect(result.current.isProfileOpen).toBe(false)
  })

  it('navigates to profile and closes dropdown', () => {
    const { result } = renderHook(() => useHeaderNavigation())

    act(() => {
      result.current.onProfileClick()
    })
    expect(result.current.isProfileOpen).toBe(true)

    act(() => {
      result.current.onNavigateToProfile()
    })
    expect(result.current.isProfileOpen).toBe(false)
    expect(mockNavigate).toHaveBeenCalledWith(PATHS.PROFILE)
  })

  it('handles logout flow cleanly with async signOut and redirect', async () => {
    const { result } = renderHook(() => useHeaderNavigation())

    await act(async () => {
      await result.current.onLogout()
    })

    expect(result.current.isProfileOpen).toBe(false)
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith(PATHS.LOGIN, { replace: true })
  })

  it('navigates to login page when onSignInClick is called', () => {
    const { result } = renderHook(() => useHeaderNavigation())

    act(() => {
      result.current.onSignInClick()
    })

    expect(mockNavigate).toHaveBeenCalledWith(PATHS.LOGIN)
  })
})
