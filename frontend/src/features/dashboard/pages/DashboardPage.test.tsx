import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'

// Mock dependencies for DashboardPage testing
vi.mock('@/features/tours/pages/AllToursPage/AllToursPage', () => ({
  AllToursPage: () => <div data-testid="all-tours-page-view">All Tours Page View</div>,
}))

vi.mock('@/features/bookings/pages/MyToursPage/MyToursPage', () => ({
  MyToursPage: () => <div data-testid="my-tours-page-view">My Tours Page View</div>,
}))

describe('DashboardPage - Production-Grade TDD Tests', () => {
  const mockUser = {
    id: 'user-1',
    email: 'agent@travel.com',
    firstName: 'Agent',
    lastName: 'Smith',
    role: 'Travel Agent',
  }

  it('renders default "main" tab (AllToursPage) on initial root navigation', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage user={mockUser} role="Travel Agent" />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('all-tours-page-view')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All tours/i })).toBeInTheDocument()
  })

  it('EDGE CASE 3 (URL Search Params Sync): activates "bookings" tab from URL query param ?tab=bookings', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard?tab=bookings']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage user={mockUser} role="Travel Agent" />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('my-tours-page-view')).toBeInTheDocument()
    const bookingsButton = screen.getByRole('button', { name: /Bookings/i })
    expect(bookingsButton).toHaveClass('active')
  })

  it('EDGE CASE 2 & 4 (Sanitization & Dirty State): sanitizes invalid ?tab=hack-tab to "main" and preserves Header UI styling', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard?tab=hack-tab']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage user={mockUser} role="Travel Agent" />} />
        </Routes>
      </MemoryRouter>
    )

    // Main page rendered safely
    expect(screen.getByTestId('all-tours-page-view')).toBeInTheDocument()

    // Header active tab bar preserved on 'All tours' button
    const allToursButton = screen.getByRole('button', { name: /All tours/i })
    expect(allToursButton).toHaveClass('active')
  })
})
