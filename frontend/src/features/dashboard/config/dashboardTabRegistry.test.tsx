import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import {
  getDashboardTabComponent,
  isValidTab,
  TAB_COMPONENT_REGISTRY,
} from './dashboardTabRegistry'

// Mock sub-pages for pure unit testing
vi.mock('@/features/tours/pages/AllToursPage/AllToursPage', () => ({
  AllToursPage: (props: any) => (
    <div data-testid="all-tours-page-mock">
      All Tours Page Mock (Auth: {String(props?.isAuthenticated)})
    </div>
  ),
}))

vi.mock('@/features/bookings/pages/MyToursPage/MyToursPage', () => ({
  MyToursPage: () => <div data-testid="my-tours-page-mock">My Tours Page Mock</div>,
}))

describe('Dashboard Tab Registry (dashboardTabRegistry) - Production-Grade TDD Tests', () => {
  const customerContext = { isAuthenticated: true, userRole: 'Customer' }
  const agentContext = { isAuthenticated: true, userRole: 'Travel Agent' }
  const adminContext = { isAuthenticated: true, userRole: 'Admin' }
  const unauthContext = { isAuthenticated: false }

  describe('isValidTab (Whitelist Type Guard)', () => {
    it('returns true for registered valid tab IDs', () => {
      expect(isValidTab('main')).toBe(true)
      expect(isValidTab('my-tours')).toBe(true)
      expect(isValidTab('bookings')).toBe(true)
      expect(isValidTab('tours')).toBe(true)
    })

    it('returns false for invalid, null, or dirty tab IDs', () => {
      expect(isValidTab('hack-tab')).toBe(false)
      expect(isValidTab('invalid-id')).toBe(false)
      expect(isValidTab(null)).toBe(false)
      expect(isValidTab(undefined)).toBe(false)
      expect(isValidTab(123)).toBe(false)
    })
  })

  describe('TAB_COMPONENT_REGISTRY & RBAC Role Guards', () => {
    it('contains registered renderers for main, my-tours, bookings, and tours tabs', () => {
      expect(TAB_COMPONENT_REGISTRY['main']).toBeDefined()
      expect(TAB_COMPONENT_REGISTRY['my-tours']).toBeDefined()
      expect(TAB_COMPONENT_REGISTRY['bookings']).toBeDefined()
      expect(TAB_COMPONENT_REGISTRY['tours']).toBeDefined()
    })

    it('renders AllToursPage for "main" tab regardless of auth or role state', () => {
      render(
        <MemoryRouter>
          {getDashboardTabComponent('main', customerContext)}
        </MemoryRouter>
      )
      expect(screen.getByTestId('all-tours-page-mock')).toBeInTheDocument()
    })

    it('RBAC GUARD: Customer can access "my-tours" tab, but NOT "bookings" tab', () => {
      const { rerender } = render(
        <MemoryRouter>
          {getDashboardTabComponent('my-tours', customerContext)}
        </MemoryRouter>
      )
      expect(screen.getByTestId('my-tours-page-mock')).toBeInTheDocument()

      rerender(
        <MemoryRouter>
          {getDashboardTabComponent('bookings', customerContext)}
        </MemoryRouter>
      )
      expect(screen.getByTestId('all-tours-page-mock')).toBeInTheDocument()
      expect(screen.queryByTestId('my-tours-page-mock')).not.toBeInTheDocument()
    })

    it('RBAC GUARD: Travel Agent can access "bookings" tab, but NOT "my-tours" tab', () => {
      const { rerender } = render(
        <MemoryRouter>
          {getDashboardTabComponent('bookings', agentContext)}
        </MemoryRouter>
      )
      expect(screen.getByTestId('my-tours-page-mock')).toBeInTheDocument()

      rerender(
        <MemoryRouter>
          {getDashboardTabComponent('my-tours', agentContext)}
        </MemoryRouter>
      )
      expect(screen.getByTestId('all-tours-page-mock')).toBeInTheDocument()
      expect(screen.queryByTestId('my-tours-page-mock')).not.toBeInTheDocument()
    })

    it('RBAC GUARD: Admin cannot access Customer "my-tours" tab without Customer role', () => {
      render(
        <MemoryRouter>
          {getDashboardTabComponent('my-tours', adminContext)}
        </MemoryRouter>
      )
      expect(screen.getByTestId('all-tours-page-mock')).toBeInTheDocument()
      expect(screen.queryByTestId('my-tours-page-mock')).not.toBeInTheDocument()
    })

    it('EDGE CASE 1 (Auth Leak Guard): falls back to AllToursPage when unauthenticated user requests protected tabs', () => {
      const { rerender } = render(
        <MemoryRouter>
          {getDashboardTabComponent('my-tours', unauthContext)}
        </MemoryRouter>
      )
      expect(screen.getByTestId('all-tours-page-mock')).toBeInTheDocument()
      expect(screen.queryByTestId('my-tours-page-mock')).not.toBeInTheDocument()

      rerender(
        <MemoryRouter>
          {getDashboardTabComponent('bookings', unauthContext)}
        </MemoryRouter>
      )
      expect(screen.getByTestId('all-tours-page-mock')).toBeInTheDocument()
      expect(screen.queryByTestId('my-tours-page-mock')).not.toBeInTheDocument()
    })

    it('EDGE CASE 2 (Sanitization): safely falls back to "main" for unrecognized tab IDs', () => {
      render(
        <MemoryRouter>
          {getDashboardTabComponent('hack-tab' as any, customerContext)}
        </MemoryRouter>
      )
      expect(screen.getByTestId('all-tours-page-mock')).toBeInTheDocument()
    })
  })
})
