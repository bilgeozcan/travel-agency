import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DocumentFeedbackModal } from './DocumentFeedbackModal'
import type { TourBooking } from '../../types/bookings'

const mockBooking: TourBooking = {
  id: 'b1',
  tourId: 't1',
  tourTitle: 'Beach Getaway',
  destination: 'Antalya',
  hotelName: 'Sun Resort',
  heroImage: '',
  startDate: '2026-09-10',
  endDate: '2026-09-17',
  durationDays: 7,
  adultsCount: 1,
  childrenCount: 0,
  guestsCount: 1,
  guests: [{ firstName: 'David', lastName: 'Miller' }],
  mealPlan: 'AI',
  totalPrice: 1500,
  currency: 'USD',
  status: 'BOOKED',
  documentsUploaded: true,
}

describe('DocumentFeedbackModal', () => {
  it('does not render when isOpen is false or booking is null', () => {
    const { container } = render(
      <DocumentFeedbackModal
        isOpen={false}
        booking={mockBooking}
        onClose={vi.fn()}
        onSubmitFeedback={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders heading and textarea, disabled Send button when comment is empty', () => {
    render(
      <DocumentFeedbackModal
        isOpen={true}
        booking={mockBooking}
        onClose={vi.fn()}
        onSubmitFeedback={vi.fn()}
      />
    )

    expect(
      screen.getByText('Please report what is wrong with the documents')
    ).toBeInTheDocument()
    const sendBtn = screen.getByTestId('send-doc-feedback-button')
    expect(sendBtn).toBeDisabled()
  })

  it('enables Send button when user types comment and submits feedback', async () => {
    const onSubmitMock = vi.fn().mockResolvedValue(undefined)
    render(
      <DocumentFeedbackModal
        isOpen={true}
        booking={mockBooking}
        onClose={vi.fn()}
        onSubmitFeedback={onSubmitMock}
      />
    )

    const textarea = screen.getByTestId('doc-feedback-textarea')
    fireEvent.change(textarea, { target: { value: 'Passport image is blurry' } })

    const sendBtn = screen.getByTestId('send-doc-feedback-button')
    expect(sendBtn).toBeEnabled()

    fireEvent.click(sendBtn)

    await waitFor(() => {
      expect(onSubmitMock).toHaveBeenCalledWith('b1', 'Passport image is blurry')
    })
  })
})
