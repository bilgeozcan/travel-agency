import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { ProfileDropdown } from './ProfileDropdown'

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('ProfileDropdown Component', () => {
  const mockUser = {
    email: 'johnsondoe@nomail.com',
    firstName: 'Johnson',
    lastName: 'Doe',
  }

  const defaultProps = {
    user: mockUser,
    isOpen: true,
    onClose: vi.fn(),
    onNavigateToProfile: vi.fn(),
    onLogout: vi.fn(),
  }

  it('renders user name, email, My Profile link, and Sign Out button when isOpen is true', () => {
    renderWithRouter(<ProfileDropdown {...defaultProps} />)

    expect(screen.getByText('Johnson Doe')).toBeInTheDocument()
    expect(screen.getByText('johnsondoe@nomail.com')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /My Profile/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Sign Out/i })).toBeInTheDocument()
  })

  it('does not render when isOpen is false', () => {
    renderWithRouter(<ProfileDropdown {...defaultProps} isOpen={false} />)

    expect(screen.queryByText('Johnson Doe')).not.toBeInTheDocument()
  })

  it('calls onNavigateToProfile and onClose when My Profile item is clicked', () => {
    const handleClose = vi.fn()
    const handleProfile = vi.fn()
    renderWithRouter(
      <ProfileDropdown
        {...defaultProps}
        onClose={handleClose}
        onNavigateToProfile={handleProfile}
      />
    )

    fireEvent.click(screen.getByRole('menuitem', { name: /My Profile/i }))
    expect(handleProfile).toHaveBeenCalledTimes(1)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onLogout and onClose when Sign Out item is clicked', () => {
    const handleClose = vi.fn()
    const handleLogout = vi.fn()
    renderWithRouter(
      <ProfileDropdown {...defaultProps} onClose={handleClose} onLogout={handleLogout} />
    )

    fireEvent.click(screen.getByRole('menuitem', { name: /Sign Out/i }))
    expect(handleLogout).toHaveBeenCalledTimes(1)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('displays Travel Agent role badge when user is registered as a Travel Agent', () => {
    const agentUser = { ...mockUser, role: 'TRAVEL_AGENT' }
    renderWithRouter(<ProfileDropdown {...defaultProps} user={agentUser} />)

    expect(screen.getByText('Travel Agent')).toBeInTheDocument()
  })

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn()
    renderWithRouter(<ProfileDropdown {...defaultProps} onClose={handleClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  describe('Edge Cases & Boundary Conditions', () => {
    it('falls back to email username when firstName and lastName are missing', () => {
      const userWithoutName = { email: 'alex.smith@example.com' }
      renderWithRouter(<ProfileDropdown {...defaultProps} user={userWithoutName} />)

      expect(screen.getByText('alex.smith')).toBeInTheDocument()
    })

    it('displays Travel Agent role badge when role prop is Travel Agent (case insensitive / variations)', () => {
      renderWithRouter(<ProfileDropdown {...defaultProps} role="travel_agent" />)

      expect(screen.getByText('Travel Agent')).toBeInTheDocument()
    })

    it('does not display role badge for Customer or Admin in dropdown summary', () => {
      const { rerender } = renderWithRouter(<ProfileDropdown {...defaultProps} role="CUSTOMER" />)
      expect(screen.queryByText('Travel Agent')).not.toBeInTheDocument()

      rerender(
        <MemoryRouter>
          <ProfileDropdown {...defaultProps} role="ADMIN" />
        </MemoryRouter>
      )
      expect(screen.queryByText('Travel Agent')).not.toBeInTheDocument()
    })

    it('handles keyboard navigation key that is NOT Escape without closing', () => {
      const handleClose = vi.fn()
      renderWithRouter(<ProfileDropdown {...defaultProps} onClose={handleClose} />)

      fireEvent.keyDown(window, { key: 'ArrowDown' })
      expect(handleClose).not.toHaveBeenCalled()
    })
  })
})
