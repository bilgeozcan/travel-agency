import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TourBookingCard } from './TourBookingCard'

describe('TourBookingCard Component (Strict Slot Architecture)', () => {
  const baseProps = {
    id: 'booking-1',
    status: 'booked' as const,
    tourImageUrls: ['https://example.com/hotel.jpg'],
    tourTitle: 'Grand Resort & Spa',
    tourLocation: 'Antalya, Turkey',
    dateRange: '2026-09-01 (7 days)',
    mealPlan: 'All Inclusive',
    guestsText: '2 Adults',
    totalPrice: 1500,
    documentsCount: 2,
  }

  it('renders common card information (title, location, details)', () => {
    render(
      <TourBookingCard
        {...baseProps}
        sideInfo={<div data-testid="custom-side-info">Side Info Slot Content</div>}
        actions={<button type="button">Custom Action</button>}
      />
    )

    expect(screen.getByText('Grand Resort & Spa')).toBeInTheDocument()
    expect(screen.getByText('Antalya, Turkey')).toBeInTheDocument()
    expect(screen.getByText('2026-09-01 (7 days)')).toBeInTheDocument()
    expect(screen.getByText('All Inclusive')).toBeInTheDocument()
    expect(screen.getByText('2 Adults')).toBeInTheDocument()
    expect(screen.getByText('$1500')).toBeInTheDocument()
  })

  it('renders sideInfo slot content inside the right column', () => {
    render(
      <TourBookingCard
        {...baseProps}
        sideInfo={<div data-testid="agent-info-slot">Agent Info Component</div>}
      />
    )

    expect(screen.getByTestId('agent-info-slot')).toBeInTheDocument()
    expect(screen.getByText('Agent Info Component')).toBeInTheDocument()
  })

  it('renders actions slot content in the footer', () => {
    render(
      <TourBookingCard
        {...baseProps}
        actions={<div data-testid="actions-slot"><button type="button">Check & Confirm</button></div>}
      />
    )

    expect(screen.getByTestId('actions-slot')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check & Confirm' })).toBeInTheDocument()
  })

  it('renders cancellation details when tour status is cancelled', () => {
    render(
      <TourBookingCard
        {...baseProps}
        status="cancelled"
        cancellationDetails={{
          cancelledBy: 'Customer',
          reason: 'Emergency travel restriction',
        }}
        sideInfo={<div>Cancelled Side Info</div>}
      />
    )

    expect(screen.getByText('Cancelled by:')).toBeInTheDocument()
    expect(screen.getByText('Customer')).toBeInTheDocument()
    expect(screen.getByText('Reason:')).toBeInTheDocument()
    expect(screen.getByText('Emergency travel restriction')).toBeInTheDocument()
  })
})
