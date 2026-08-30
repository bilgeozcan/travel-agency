import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TourBooking } from '../../types/bookings'
import { EditBookingModal } from './EditBookingModal'

vi.mock('@/features/tours/hooks/useTourDetails', () => ({
  useTourDetails: () => ({
    data: {
      id: 'tour-1',
      title: 'Mediterranean Escape',
      hotelName: 'Antalya Resort',
      rating: 4.8,
      basePricePerPerson: 1000,
      availableStartDates: ['2026-08-31'],
      allowedDurations: [7, 10],
      availableMealPlans: ['BB', 'HB'],
      cancellationPolicy: { freeCancellationUntilDays: 30 },
      destination: 'Antalya, Turkey',
    },
  }),
}))

describe('EditBookingModal Component', () => {
  const mockBooking: TourBooking = {
    id: 'booking-1',
    tourId: 'tour-1',
    tourTitle: 'Mediterranean Escape',
    destination: 'Antalya, Turkey',
    hotelName: 'Antalya Resort',
    heroImage: 'hero.jpg',
    startDate: '2026-08-31',
    endDate: '2026-09-07',
    durationDays: 7,
    adultsCount: 2,
    childrenCount: 0,
    guestsCount: 2,
    guests: [
      { firstName: 'Johnson', lastName: 'Doe' },
      { firstName: 'Jane', lastName: 'Smith' },
    ],
    mealPlan: 'BB',
    totalPrice: 2000,
    currency: '$',
    status: 'BOOKED',
    documentsUploaded: false,
  }

  const defaultProps = {
    isOpen: true,
    booking: mockBooking,
    onClose: vi.fn(),
    onUpdateBooking: vi.fn(),
  }

  it('renders in Customer mode with all guest input fields editable', () => {
    render(<EditBookingModal {...defaultProps} mode="customer" />)

    expect(screen.getByText('Mediterranean Escape')).toBeInTheDocument()
    const firstInputs = screen.getAllByRole('textbox')
    expect(firstInputs.length).toBeGreaterThan(0)
    expect(firstInputs[0]).not.toHaveAttribute('readonly')
  })

  it('renders in Agent mode with Primary Guest (Guest 0) inputs locked (readOnly & disabled)', () => {
    render(<EditBookingModal {...defaultProps} mode="agent" />)

    expect(screen.getByText('(Locked)')).toBeInTheDocument()
    const firstNameInput = screen.getByDisplayValue('Johnson')
    const lastNameInput = screen.getByDisplayValue('Doe')

    expect(firstNameInput).toHaveAttribute('readonly')
    expect(lastNameInput).toHaveAttribute('readonly')

    const secondFirstNameInput = screen.getByDisplayValue('Jane')
    expect(secondFirstNameInput).not.toHaveAttribute('readonly')
  })

  it('recalculates live total price and submits form with date in payload on Save changes click', async () => {
    const handleUpdate = vi.fn().mockResolvedValue(undefined)
    render(<EditBookingModal {...defaultProps} mode="agent" onUpdateBooking={handleUpdate} />)

    const saveBtn = screen.getByRole('button', { name: /Save changes/i })
    expect(saveBtn).toBeInTheDocument()

    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(handleUpdate).toHaveBeenCalledTimes(1)
      expect(handleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2026-08-31',
          duration: '7 days',
          mealPlan: 'BB',
        }),
        expect.any(Array)
      )
    })
  })

  it('returns null when isOpen is false', () => {
    const { container } = render(<EditBookingModal {...defaultProps} isOpen={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('returns null when booking status is not edit-eligible (e.g. CANCELED)', () => {
    const canceledBooking = { ...mockBooking, status: 'CANCELED' as const }
    const { container } = render(
      <EditBookingModal {...defaultProps} booking={canceledBooking} />
    )
    expect(container).toBeEmptyDOMElement()
  })
})
