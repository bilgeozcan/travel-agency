import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { TourDetail } from '@/features/tours/types/tours'
import { BookingModal } from './BookingModal'

const mockTour: TourDetail = {
  id: 'tour-caribe-1',
  title: 'Tropical Caribe Hotel',
  hotelName: 'Tropical Caribe Hotel',
  hotelDescription: 'Luxury resort in Punta Cana',
  rating: 5.0,
  reviewsCount: 42,
  heroImages: ['https://example.com/hero.jpg'],
  basePricePerPerson: 700,
  availableStartDates: ['2025-01-15', '2025-02-01'],
  allowedDurations: [7, 10, 12],
  maxParticipants: 10,
  adultsMax: 6,
  childrenMax: 4,
  totalMax: 10,
  availableMealPlans: ['BB', 'HB', 'AI'],
  cancellationPolicy: { freeCancellationUntilDays: 10, description: 'Free cancellation' },
  accommodationDescription: 'Ocean view suite',
  guideLanguages: ['English'],
  transferInfo: 'Airport pickup included',
  isFullyBooked: false,
  destination: 'Punta Cana, Dominican Republic',
  mealSupplementsPerDay: { BB: 0, HB: 25, AI: 50 },
}

describe('BookingModal Component (TDD Specs)', () => {
  it('does not render when isOpen is false', () => {
    render(
      <BookingModal
        isOpen={false}
        onClose={vi.fn()}
        tour={mockTour}
        onConfirmBooking={vi.fn()}
      />
    )
    expect(screen.queryByTestId('booking-modal')).not.toBeInTheDocument()
  })

  it('renders centered modal container (544px shell), backdrop, header, and metadata when isOpen is true', () => {
    render(
      <BookingModal
        isOpen={true}
        onClose={vi.fn()}
        tour={mockTour}
        onConfirmBooking={vi.fn()}
      />
    )

    expect(screen.getByTestId('booking-modal-backdrop')).toBeInTheDocument()
    expect(screen.getByTestId('booking-modal')).toBeInTheDocument()

    // Header section assertions
    expect(screen.getByText('Tropical Caribe Hotel')).toBeInTheDocument()
    expect(screen.getByText('5,0')).toBeInTheDocument()
    expect(screen.getByText('Punta Cana, Dominican Republic')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('renders Personal Details section with dynamic 2-column input fields', () => {
    render(
      <BookingModal
        isOpen={true}
        onClose={vi.fn()}
        tour={mockTour}
        initialSelection={{ adults: 1, children: 1 }}
        onConfirmBooking={vi.fn()}
      />
    )

    expect(screen.getByText('Personal Details (Customer 1)')).toBeInTheDocument()
    expect(screen.getByText('Personal Details (Customer 2)')).toBeInTheDocument()
    const firstNameInputs = screen.getAllByLabelText(/First Name/i)
    const lastNameInputs = screen.getAllByLabelText(/Last Name/i)
    expect(firstNameInputs).toHaveLength(2)
    expect(lastNameInputs).toHaveLength(2)
  })

  it('pre-fills Tour Details section from initialSelection and displays right-aligned total price', () => {
    render(
      <BookingModal
        isOpen={true}
        onClose={vi.fn()}
        tour={mockTour}
        initialSelection={{
          startDate: '2025-01-15',
          duration: 7,
          adults: 2,
          children: 0,
          mealPlan: 'BB',
        }}
        onConfirmBooking={vi.fn()}
      />
    )

    expect(screen.getByText('Tour Details')).toBeInTheDocument()
    expect(screen.getByTestId('booking-modal-total-price')).toHaveTextContent('$1400')
    expect(screen.getByRole('button', { name: /Book Now/i })).toBeInTheDocument()
  })

  it('triggers onClose when close icon button or backdrop is clicked', () => {
    const handleClose = vi.fn()
    render(
      <BookingModal
        isOpen={true}
        onClose={handleClose}
        tour={mockTour}
        onConfirmBooking={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('prevents submission and displays inline error messages when required personal details fields are empty', () => {
    const handleConfirm = vi.fn()
    render(
      <BookingModal
        isOpen={true}
        onClose={vi.fn()}
        tour={mockTour}
        onConfirmBooking={handleConfirm}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Book Now/i }))

    expect(screen.getByText('First name is required')).toBeInTheDocument()
    expect(screen.getByText('Last name is required')).toBeInTheDocument()
    expect(handleConfirm).not.toHaveBeenCalled()
  })

  it('recalculates total price dynamically when meal plan option changes', () => {
    render(
      <BookingModal
        isOpen={true}
        onClose={vi.fn()}
        tour={mockTour}
        initialSelection={{
          startDate: '2025-01-15',
          duration: 7,
          adults: 2,
          children: 0,
          mealPlan: 'BB',
        }}
        onConfirmBooking={vi.fn()}
      />
    )

    // Base price per person: 700, 2 adults, 7 days, BB supplement 0 -> Total: $1400
    expect(screen.getByTestId('booking-modal-total-price')).toHaveTextContent('$1400')

    // Open meal plan select dropdown
    const selectButton = screen.getByRole('button', { name: /Meal plan/i })
    fireEvent.click(selectButton)

    // Select "All inclusive (AI)" (supplement: 50/day/person) -> (700 + (50 * 7)) * 2 = 1050 * 2 = $2100
    const aiOption = screen.getByRole('option', { name: /All inclusive \(AI\)/i })
    fireEvent.click(aiOption)

    expect(screen.getByTestId('booking-modal-total-price')).toHaveTextContent('$2100')
  })

  it('submits form on Enter key press and shows loading spinner during async booking', async () => {
    const handleConfirm = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)))
    render(
      <BookingModal
        isOpen={true}
        onClose={vi.fn()}
        tour={mockTour}
        initialSelection={{ adults: 1, children: 0 }}
        onConfirmBooking={handleConfirm}
      />
    )

    const firstNameInput = screen.getByLabelText(/First Name/i)
    const lastNameInput = screen.getByLabelText(/Last Name/i)

    fireEvent.change(firstNameInput, { target: { value: 'John' } })
    fireEvent.change(lastNameInput, { target: { value: 'Doe' } })

    const form = screen.getByTestId('booking-modal')
    fireEvent.submit(form)

    expect(handleConfirm).toHaveBeenCalledTimes(1)
  })

  it('allows clicking dates in calendar popover when open in modal', () => {
    render(
      <BookingModal
        isOpen={true}
        onClose={vi.fn()}
        tour={mockTour}
        onConfirmBooking={vi.fn()}
      />
    )

    // Open calendar popover
    const dateInput = screen.getByLabelText('Start date and duration')
    fireEvent.click(dateInput)

    // Calendar popover should be rendered inside portal
    expect(screen.getByTestId('calendar-duration-popover')).toBeInTheDocument()

    // Click an available date (e.g. 15 from availableStartDates ['2025-01-15', '2025-02-01'])
    const dateCell = screen.getByText('15')
    fireEvent.click(dateCell)

    expect(dateInput).toHaveValue('Jan 15 - Jan 22, 7 days')
  })
})
