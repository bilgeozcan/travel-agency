import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { Header } from './Header'

describe('Header Component', () => {
  const mockUser = {
    email: 'johnsondoe@nomail.com',
    firstName: 'Johnson',
    lastName: 'Doe',
  }

  it('renders logged-in header state with All tours, My tours, active bar, and user avatar', () => {
    render(
      <MemoryRouter>
        <Header activeTab="main" user={mockUser} />
      </MemoryRouter>
    )

    expect(screen.getByText('Travel Agency')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All tours/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /My tours/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /User profile menu/i })).toBeInTheDocument()
  })

  it('renders Bookings tab label when user role is TRAVEL_AGENT', () => {
    render(
      <MemoryRouter>
        <Header activeTab="main" user={mockUser} role="TRAVEL_AGENT" />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: /Bookings/i })).toBeInTheDocument()
  })

  it('renders active-bar indicator on Bookings tab when activeTab is tours or bookings for Travel Agent', () => {
    const { container } = render(
      <MemoryRouter>
        <Header activeTab="tours" user={mockUser} role="TRAVEL_AGENT" />
      </MemoryRouter>
    )

    const bookingsButton = screen.getByRole('button', { name: /Bookings/i })
    expect(bookingsButton).toHaveClass('active')
    expect(container.querySelector('.active-bar')).toBeInTheDocument()
    expect(bookingsButton.querySelector('.active-bar')).toBeInTheDocument()
  })

  it('triggers onTabChange callback when Travel Agent clicks Bookings tab', () => {
    const handleTabChange = vi.fn()
    render(
      <MemoryRouter>
        <Header activeTab="main" user={mockUser} role="TRAVEL_AGENT" onTabChange={handleTabChange} />
      </MemoryRouter>
    )

    const bookingsButton = screen.getByRole('button', { name: /Bookings/i })
    fireEvent.click(bookingsButton)

    expect(handleTabChange).toHaveBeenCalledWith('tours')
  })

  it('renders unauthenticated guest header state with All tours, no My tours, no active bar, and Sign in button', () => {
    const handleSignInClick = vi.fn()
    render(
      <MemoryRouter>
        <Header user={null} onSignInClick={handleSignInClick} />
      </MemoryRouter>
    )

    expect(screen.getByText('Travel Agency')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /All tours/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /My tours/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('User profile menu')).not.toBeInTheDocument()

    const signInBtn = screen.getByRole('button', { name: /Sign in/i })
    expect(signInBtn).toBeInTheDocument()

    fireEvent.click(signInBtn)
    expect(handleSignInClick).toHaveBeenCalledTimes(1)
  })

  it('triggers onTabChange callback when nav links are clicked', () => {
    const handleTabChange = vi.fn()
    render(
      <MemoryRouter>
        <Header activeTab="main" user={mockUser} onTabChange={handleTabChange} />
      </MemoryRouter>
    )

    const toursButton = screen.getByRole('button', { name: /My tours/i })
    fireEvent.click(toursButton)

    expect(handleTabChange).toHaveBeenCalledWith('tours')
  })

  it('toggles ProfileDropdown when user icon is clicked', () => {
    render(
      <MemoryRouter>
        <Header activeTab="main" user={mockUser} />
      </MemoryRouter>
    )

    const profileButton = screen.getByRole('button', { name: /User profile menu/i })
    expect(screen.queryByText('Johnson Doe')).not.toBeInTheDocument()

    // Click to open
    fireEvent.click(profileButton)
    expect(screen.getByText('Johnson Doe')).toBeInTheDocument()
    expect(screen.getByText('johnsondoe@nomail.com')).toBeInTheDocument()

    // Click to close
    fireEvent.click(profileButton)
    expect(screen.queryByText('Johnson Doe')).not.toBeInTheDocument()
  })
})
