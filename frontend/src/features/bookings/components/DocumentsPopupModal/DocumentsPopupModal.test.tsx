import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { DocumentsPopupModal } from './DocumentsPopupModal'
import type { TourBooking } from '../../types/bookings'
import { bookingsService } from '@/api/services/bookings.service'

vi.mock('@/api/services/bookings.service', () => ({
  bookingsService: {
    getBookingDocuments: vi.fn(),
    getDocumentDownloadUrl: vi.fn(),
  },
}))

const mockBooking: TourBooking = {
  id: 'b1',
  tourId: 't1',
  tourTitle: 'Tropical Resort Special',
  destination: 'Maldives',
  hotelName: 'Grand Resort',
  heroImage: '',
  startDate: '2026-09-01',
  endDate: '2026-09-07',
  durationDays: 6,
  adultsCount: 2,
  childrenCount: 0,
  guestsCount: 2,
  guests: [
    { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
    { firstName: 'Jane', lastName: 'Doe' },
  ],
  mealPlan: 'BB',
  totalPrice: 1200,
  currency: 'USD',
  status: 'BOOKED',
  documentsUploaded: true,
}

describe('DocumentsPopupModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(bookingsService.getBookingDocuments).mockResolvedValue([
      { id: 'doc-passport', name: 'Passport_John_Doe.pdf', url: '', fileFormat: 'PDF' },
    ])
  })

  it('does not render when isOpen is false or booking is null', () => {
    const { container } = render(
      <DocumentsPopupModal isOpen={false} booking={mockBooking} onClose={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('fetches documents once when opened without supplied documents', async () => {
    render(<DocumentsPopupModal isOpen={true} booking={mockBooking} onClose={vi.fn()} />)

    await waitFor(() => expect(screen.getByText(/Passport_John_Doe.pdf/i)).toBeInTheDocument())
    expect(bookingsService.getBookingDocuments).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('download-doc-doc-passport')).toBeInTheDocument()
  })

  it('renders provided custom documents list', () => {
    const customDocs = [
      { id: 'd1', name: 'Voucher.pdf', url: 'http://example.com/voucher.pdf', fileFormat: 'PDF' },
    ]

    render(
      <DocumentsPopupModal
        isOpen={true}
        booking={mockBooking}
        documents={customDocs}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Voucher.pdf')).toBeInTheDocument()
    expect(screen.getByTestId('download-doc-d1')).toBeInTheDocument()
    expect(bookingsService.getBookingDocuments).not.toHaveBeenCalled()
  })

  it('calls onClose when close icon is clicked', () => {
    const onCloseMock = vi.fn()
    render(<DocumentsPopupModal isOpen={true} booking={mockBooking} onClose={onCloseMock} />)

    const closeBtn = screen.getByRole('button', { name: /close modal/i })
    fireEvent.click(closeBtn)

    expect(onCloseMock).toHaveBeenCalledTimes(1)
  })
})
