import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CheckConfirmModal } from './CheckConfirmModal'
import type { TourBooking } from '../../types/bookings'
import { bookingsService } from '@/api/services/bookings.service'

vi.mock('@/api/services/bookings.service', () => ({
  bookingsService: {
    getBookingDocuments: vi.fn(),
    getDocumentDownloadUrl: vi.fn(),
  },
}))

const mockBooking: TourBooking = {
  id: 'b-999',
  tourId: 't-111',
  tourTitle: 'Grand Luxury Villa',
  destination: 'Bodrum, Turkey',
  hotelName: 'Bodrum Bay Resort',
  heroImage: '/images/resort.jpg',
  startDate: '2026-10-15',
  endDate: '2026-10-22',
  durationDays: 7,
  adultsCount: 2,
  childrenCount: 0,
  guestsCount: 2,
  mealPlan: 'AI',
  totalPrice: 3500,
  currency: 'USD',
  status: 'BOOKED',
  customerEmail: 'sarah.connor@example.com',
  documentsUploaded: true,
  guests: [
    { firstName: 'Sarah', lastName: 'Connor', email: 'sarah.connor@example.com' },
    { firstName: 'John', lastName: 'Connor' },
  ],
}

describe('CheckConfirmModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(bookingsService.getBookingDocuments).mockResolvedValue([
      { id: 'doc-passport', name: 'Passport_Sarah_Connor.pdf', url: '', fileFormat: 'PDF' },
    ])
  })

  it('renders nothing when isOpen is false or booking is null', () => {
    const { container } = render(
      <CheckConfirmModal
        isOpen={false}
        booking={mockBooking}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders booking overview, customer details, price, and uploaded documents correctly', async () => {
    render(
      <CheckConfirmModal
        isOpen={true}
        booking={mockBooking}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByText('Bodrum Bay Resort')).toBeInTheDocument()
    expect(screen.getByText(/Bodrum, Turkey/i)).toBeInTheDocument()
    expect(screen.getByText('Sarah Connor ( 2 adults )')).toBeInTheDocument()
    expect(screen.getByText('sarah.connor@example.com')).toBeInTheDocument()
    expect(screen.getByText('7 days')).toBeInTheDocument()
    expect(screen.getByText(/All inclusive \(AI\)/i)).toBeInTheDocument()
    expect(screen.getByText('$3500')).toBeInTheDocument()

    // Verify document download links
    await waitFor(() => expect(screen.getByText('Passport_Sarah_Connor.pdf')).toBeInTheDocument())
    expect(screen.getByTestId('download-link-doc-passport')).toBeInTheDocument()
  })

  it('triggers onConfirm callback when Confirm button is clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined)
    render(
      <CheckConfirmModal
        isOpen={true}
        booking={mockBooking}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    const confirmBtn = screen.getByTestId('confirm-booking-button')
    fireEvent.click(confirmBtn)

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith('b-999')
  })

  it('triggers onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <CheckConfirmModal
        isOpen={true}
        booking={mockBooking}
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    )

    const closeBtn = screen.getByLabelText('Close booking modal')
    fireEvent.click(closeBtn)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('disables confirm button when isLoading is true', () => {
    render(
      <CheckConfirmModal
        isOpen={true}
        booking={mockBooking}
        isLoading={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByTestId('confirm-booking-button')).toBeDisabled()
  })
})
