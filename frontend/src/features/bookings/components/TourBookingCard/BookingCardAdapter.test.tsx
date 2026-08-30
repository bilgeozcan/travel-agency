import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BookingCardAdapter } from './BookingCardAdapter'
import type { TourBooking } from '../../types/bookings'

describe('BookingCardAdapter Component', () => {
  const mockBooking: TourBooking = {
    id: 'booking-101',
    tourId: 'tour-swiss',
    tourTitle: 'Swiss Alps Ski Retreat',
    destination: 'Zermatt, Switzerland',
    hotelName: 'Swiss Alps Ski Retreat',
    heroImage: 'https://example.com/swiss.jpg',
    startDate: 'Jan 15, 2025',
    endDate: 'Jan 22, 2025',
    durationDays: 7,
    adultsCount: 2,
    childrenCount: 0,
    guestsCount: 2,
    guests: [{ firstName: 'Taylor', lastName: 'Smith' }],
    mealPlan: 'BB',
    totalPrice: 1400,
    currency: 'USD',
    status: 'BOOKED',
    documentsUploaded: true,
    customerEmail: 'taylor.smith@example.com',
    travelAgent: {
      name: 'Tyrone Boyer',
      email: 'tyroneboyer@gmail.com',
      phone: '+1 555 123 4567',
      messenger: 'https://m.me/tyroneboyer',
    },
  }

  it('renders Customer view with TravelAgentInfoSection and guest summary in left column', () => {
    render(<BookingCardAdapter booking={mockBooking} userRole="Customer" />)

    expect(screen.getByText('Travel agent')).toBeInTheDocument()
    expect(screen.getByText('Tyrone Boyer')).toBeInTheDocument()
    expect(screen.getByText('Taylor Smith (2 adults)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('renders Travel Agent view with CustomerInfoSection and omits guest summary from left column', () => {
    render(<BookingCardAdapter booking={mockBooking} userRole="Travel Agent" />)

    expect(screen.getByText('Customer details')).toBeInTheDocument()
    expect(screen.getByText('taylor.smith@example.com')).toBeInTheDocument()
    expect(screen.queryByText('Taylor Smith (2 adults)')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /check (and|&) confirm/i })).toBeInTheDocument()
  })

  it('renders document-rejection banner when booking status is BOOKED and reason is present', () => {
    render(
      <BookingCardAdapter
        booking={{
          ...mockBooking,
          status: 'BOOKED',
          documentRejectionReason: 'Please upload a clearer passport copy.',
        }}
        userRole="Customer"
      />
    )

    expect(screen.getByTestId('doc-rejection-banner')).toBeInTheDocument()
    expect(screen.getByText('Please upload a clearer passport copy.')).toBeInTheDocument()
    expect(screen.getByText('Documents rejected:')).toBeInTheDocument()
  })

  it('hides a stale document-rejection message once the booking is confirmed', () => {
    render(
      <BookingCardAdapter
        booking={{
          ...mockBooking,
          status: 'CONFIRMED',
          documentRejectionReason: 'Please upload a clearer passport copy.',
        }}
        userRole="Customer"
      />
    )

    expect(screen.queryByTestId('doc-rejection-banner')).not.toBeInTheDocument()
  })
})
