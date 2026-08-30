import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GuestsPopupModal } from './GuestsPopupModal'
import type { TourBooking } from '../../types/bookings'

const mockBooking: TourBooking = {
  id: 'b1',
  tourId: 't1',
  tourTitle: 'Alpine Adventure',
  destination: 'Switzerland',
  hotelName: 'Alpine Chalet',
  heroImage: '',
  startDate: '2026-10-01',
  endDate: '2026-10-08',
  durationDays: 7,
  adultsCount: 2,
  childrenCount: 1,
  guestsCount: 3,
  guests: [
    { firstName: 'Alice', lastName: 'Smith' },
    { firstName: 'Bob', lastName: 'Smith' },
    { firstName: 'Charlie', lastName: 'Smith' },
  ],
  mealPlan: 'HB',
  totalPrice: 2500,
  currency: 'USD',
  status: 'BOOKED',
  documentsUploaded: false,
}

describe('GuestsPopupModal', () => {
  it('does not render when isOpen is false or booking is null', () => {
    const { container } = render(
      <GuestsPopupModal isOpen={false} booking={mockBooking} onClose={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders list of all guests with full names and primary badge for first guest', () => {
    render(<GuestsPopupModal isOpen={true} booking={mockBooking} onClose={vi.fn()} />)

    expect(screen.getByTestId('guests-popup-content')).toBeInTheDocument()
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Primary Customer')).toBeInTheDocument()
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
    expect(screen.getByText('Charlie Smith')).toBeInTheDocument()
  })

  it('calls onClose when close icon is clicked', () => {
    const onCloseMock = vi.fn()
    render(<GuestsPopupModal isOpen={true} booking={mockBooking} onClose={onCloseMock} />)

    const closeBtn = screen.getByRole('button', { name: /close modal/i })
    fireEvent.click(closeBtn)

    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })
})
