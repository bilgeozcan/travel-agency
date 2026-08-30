import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookingConfirmationModal } from './BookingConfirmationModal'
import type { TravelAgentInfo } from '../../types/bookings'

describe('BookingConfirmationModal Component', () => {
  const mockTravelAgent: TravelAgentInfo = {
    name: 'Tyrone Boyer',
    email: 'tyroneboyer@gmail.com',
    phone: '480-221-1885',
    messenger: 'https://m.me/tyroneboyer',
  }

  const defaultProps = {
    isOpen: true,
    hotelName: 'Tropical Caribe Hotel',
    startDate: '2025-01-15',
    durationDays: 7,
    mealPlan: 'Breakfast (BB)',
    adultsCount: 1,
    childrenCount: 0,
    travelAgent: mockTravelAgent,
    bookingDate: '2025-01-01',
    freeCancellationUntilDate: '2025-01-05',
    onClose: vi.fn(),
    onNavigateToMyTours: vi.fn(),
  }

  it('does not render when isOpen is false', () => {
    render(<BookingConfirmationModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByTestId('booking-confirmation-modal')).toBeNull()
  })

  it('does not render free cancellation banner when the API provides no deadline', () => {
    render(<BookingConfirmationModal {...defaultProps} freeCancellationUntilDate="" />)
    expect(screen.queryByTestId('free-cancellation-banner')).toBeNull()
  })

  it('renders exact Acceptance Criteria UI texts for cancellation, booking details, and document upload', () => {
    render(<BookingConfirmationModal {...defaultProps} />)

    // Header
    expect(screen.getByText('Booking Confirmed!')).toBeDefined()

    // AC Free Cancellation Text
    expect(
      screen.getByText('Free cancellation is possible until January 5, 2025.')
    ).toBeDefined()

    // AC Booking Details Summary Text
    expect(
      screen.getByText(
        'You have successfully booked a tour at Tropical Caribe Hotel, starting date January 15, 2025 (7 days), Breakfast (BB) for 1 adult.'
      )
    ).toBeDefined()

    // Travel documents upload instruction
    expect(
      screen.getByText(/upload your travel documents \(passports, payment confirmations\) on the/i)
    ).toBeDefined()
  })

  it('handles guest count pluralization correctly for adults and children edge cases', () => {
    render(
      <BookingConfirmationModal
        {...defaultProps}
        adultsCount={2}
        childrenCount={1}
      />
    )

    expect(
      screen.getByText(
        'You have successfully booked a tour at Tropical Caribe Hotel, starting date January 15, 2025 (7 days), Breakfast (BB) for 2 adults, 1 child.'
      )
    ).toBeDefined()
  })

  it('renders Travel Agent details card correctly when provided', () => {
    render(<BookingConfirmationModal {...defaultProps} />)

    expect(screen.getByTestId('travel-agent-card')).toBeDefined()
    expect(screen.getByText('Tyrone Boyer')).toBeDefined()
    expect(screen.getByText(/tyroneboyer@gmail\.com/i)).toBeDefined()
    expect(screen.getByText(/480-221-1885/i)).toBeDefined()
  })

  it('does NOT render green cancellation banner if free cancellation period is over (conditional rendering)', () => {
    render(
      <BookingConfirmationModal
        {...defaultProps}
        startDate="2025-01-15"
        bookingDate="2025-01-10"
      />
    )

    expect(screen.queryByTestId('free-cancellation-banner')).toBeNull()
  })

  it('triggers onClose when clicking close icon button and backdrop', () => {
    const onClose = vi.fn()
    render(<BookingConfirmationModal {...defaultProps} onClose={onClose} />)

    // Click close icon
    const closeBtn = screen.getByRole('button', { name: /close confirmation modal/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)

    // Click backdrop
    const backdrop = screen.getByTestId('booking-confirmation-backdrop')
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('triggers onClose on Escape key press', () => {
    const onClose = vi.fn()
    render(<BookingConfirmationModal {...defaultProps} onClose={onClose} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('triggers onNavigateToMyTours when clicking "My Tours" primary button', () => {
    const onNavigateToMyTours = vi.fn()
    const onClose = vi.fn()

    render(
      <BookingConfirmationModal
        {...defaultProps}
        onClose={onClose}
        onNavigateToMyTours={onNavigateToMyTours}
      />
    )

    const btn = screen.getByTestId('my-tours-button')
    fireEvent.click(btn)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onNavigateToMyTours).toHaveBeenCalledTimes(1)
  })
})
