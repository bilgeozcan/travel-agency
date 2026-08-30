import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HeaderProfile } from './HeaderProfile'

describe('HeaderProfile Component', () => {
  it('renders avatar icon for all users', () => {
    render(<HeaderProfile user={{ email: 'user@test.com' }} role="Customer" />)
    expect(screen.getByAltText('User Avatar')).toBeInTheDocument()
  })

  it('renders "Travel Agent" role badge when role is Travel Agent or TRAVEL_AGENT', () => {
    const { rerender } = render(
      <HeaderProfile user={{ email: 'agent@test.com' }} role="TRAVEL_AGENT" />
    )
    expect(screen.getByTestId('header-role-badge')).toHaveTextContent('Travel Agent')

    rerender(<HeaderProfile user={{ email: 'agent@test.com' }} role="Travel Agent" />)
    expect(screen.getByTestId('header-role-badge')).toHaveTextContent('Travel Agent')
  })

  it('renders "Admin" role badge when role is Admin or ADMIN', () => {
    const { rerender } = render(
      <HeaderProfile user={{ email: 'admin@test.com' }} role="ADMIN" />
    )
    expect(screen.getByTestId('header-role-badge')).toHaveTextContent('Admin')

    rerender(<HeaderProfile user={{ email: 'admin@test.com' }} role="Admin" />)
    expect(screen.getByTestId('header-role-badge')).toHaveTextContent('Admin')
  })

  it('does NOT render role badge for Customer role', () => {
    const { rerender } = render(
      <HeaderProfile user={{ email: 'customer@test.com' }} role="CUSTOMER" />
    )
    expect(screen.queryByTestId('header-role-badge')).toBeNull()

    rerender(<HeaderProfile user={{ email: 'customer@test.com' }} role="Customer" />)
    expect(screen.queryByTestId('header-role-badge')).toBeNull()
  })

  it('does NOT render role badge when role is null or missing', () => {
    render(<HeaderProfile user={{ email: 'guest@test.com' }} role={null} />)
    expect(screen.queryByTestId('header-role-badge')).toBeNull()
  })

  it('calls onClick handler when profile button is clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(
      <HeaderProfile
        user={{ email: 'agent@test.com' }}
        role="Travel Agent"
        onClick={handleClick}
      />
    )

    await user.click(screen.getByRole('button', { name: /user profile menu/i }))
    expect(handleClick, 'onClick callback should be invoked exactly once on user click').toHaveBeenCalledTimes(1)
  })

  /* --- Edge Case, Boundary & Unhappy Path Tests --- */

  describe('Edge Cases & Malformed Inputs (Unhappy Paths)', () => {
    it('handles null user object gracefully without crashing and hides badge', () => {
      render(<HeaderProfile user={null} role={null} />)
      expect(screen.getByAltText('User Avatar'), 'Avatar icon must render even when user is null').toBeInTheDocument()
      expect(screen.queryByTestId('header-role-badge'), 'Role badge must not be rendered when user and role are null').toBeNull()
    })

    it('handles undefined user object and empty string role without crashing', () => {
      render(<HeaderProfile user={undefined} role="" />)
      expect(screen.getByAltText('User Avatar')).toBeInTheDocument()
      expect(screen.queryByTestId('header-role-badge'), 'Role badge must not render for empty string role').toBeNull()
    })

    it('handles unrecognized / invalid role string gracefully by falling back to Customer (no badge)', () => {
      render(<HeaderProfile user={{ email: 'hacker@test.com' }} role="SUPER_ADMIN_HACK" />)
      expect(screen.queryByTestId('header-role-badge'), 'Unrecognized roles must default to Customer and hide badge').toBeNull()
    })

    it('prioritizes explicit role prop over user.role property when both are supplied', () => {
      render(
        <HeaderProfile
          user={{ email: 'agent@test.com', role: 'Customer' }}
          role="Travel Agent"
        />
      )
      expect(screen.getByTestId('header-role-badge'), 'Explicit role prop must take precedence over user.role').toHaveTextContent('Travel Agent')
    })

    it('falls back to user.role property when explicit role prop is missing/null', () => {
      render(
        <HeaderProfile
          user={{ email: 'admin@test.com', role: 'ADMIN' }}
          role={null}
        />
      )
      expect(screen.getByTestId('header-role-badge'), 'Should fall back to user.role when role prop is null').toHaveTextContent('Admin')
    })

    it('handles role arrays by choosing highest priority role (Admin > Travel Agent)', () => {
      render(
        <HeaderProfile
          user={{ email: 'super@test.com', role: ['CUSTOMER', 'TRAVEL_AGENT', 'ADMIN'] as unknown as string }}
        />
      )
      expect(screen.getByTestId('header-role-badge'), 'Highest priority role in array (Admin) must be rendered').toHaveTextContent('Admin')
    })

    it('renders avatar without role badge when role is whitespace or empty string', () => {
      render(<HeaderProfile user={{ email: 'user@test.com' }} role="   " />)
      expect(screen.getByAltText('User Avatar')).toBeInTheDocument()
      expect(screen.queryByTestId('header-role-badge')).toBeNull()
    })

    it('handles user with null/undefined email or properties gracefully', () => {
      render(<HeaderProfile user={{ email: undefined, name: undefined, role: undefined }} role={null} />)
      expect(screen.getByAltText('User Avatar')).toBeInTheDocument()
      expect(screen.queryByTestId('header-role-badge')).toBeNull()
    })
  })
})
