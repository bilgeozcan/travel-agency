import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CancelBookingModal } from './CancelBookingModal'

describe('CancelBookingModal', () => {
  const defaultProps = {
    isOpen: true,
    tourTitle: 'Tropical Caribe Hotel',
    startDate: 'January 15, 2030',
    durationDays: 7,
    mealPlan: 'Breakfast (BB)',
    guestsText: '1 adult',
    freeCancellationUntilDate: '2030-01-05',
    isLoading: false,
    onClose: vi.fn(),
    onConfirmCancel: vi.fn(),
  }

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<CancelBookingModal {...defaultProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders modal header, body template with bold values, and buttons when isOpen is true in customer mode', () => {
    render(<CancelBookingModal {...defaultProps} mode="customer" />)

    expect(screen.getByRole('heading', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close modal' })).toBeInTheDocument()
    expect(screen.getByTestId('confirm-cancel-button')).toHaveTextContent('Cancel the booking')
    expect(screen.getByTestId('keep-booking-button')).toHaveTextContent('Keep the booking')

    // Bold dynamic text values
    expect(screen.getByText('Tropical Caribe Hotel')).toBeInTheDocument()
    expect(screen.getByText('January 15, 2030 (7 days)')).toBeInTheDocument()
    expect(screen.getByText('Breakfast (BB)')).toBeInTheDocument()
    expect(screen.getByText('1 adult')).toBeInTheDocument()
  })

  it('renders Travel Agent mode with AgentCancelModalBody when mode="agent"', () => {
    render(
      <CancelBookingModal
        {...defaultProps}
        mode="agent"
        customerName="Johnson Doe"
        customerEmail="johnsondoe@nomail.com"
        guestsCount={1}
        location="Punta Cana, Dominican Republic"
      />
    )

    expect(screen.getByTestId('agent-cancel-modal-body')).toBeInTheDocument()
    expect(screen.getByTestId('agent-cancel-customer')).toHaveTextContent('Johnson Doe (1 guest)')
    expect(screen.getByTestId('agent-cancel-email')).toHaveTextContent('johnsondoe@nomail.com')
    expect(screen.getByTestId('agent-confirm-cancel-button')).toBeDisabled()
  })

  it('renders Yellow Banner variant when the API deadline has not passed in customer mode', () => {
    render(<CancelBookingModal {...defaultProps} mode="customer" />)

    const banner = screen.getByTestId('cancellation-policy-banner')
    expect(banner).toHaveClass('cancel-booking-banner--yellow')
    expect(banner).toHaveTextContent(/Free cancellation is possible until/i)
  })

  it('renders Red Banner variant with exact wording when the API deadline has passed in customer mode', () => {
    render(<CancelBookingModal {...defaultProps} mode="customer" freeCancellationUntilDate="2020-01-01" />)

    const banner = screen.getByTestId('cancellation-policy-banner')
    expect(banner).toHaveClass('cancel-booking-banner--red')
    expect(banner).toHaveTextContent(
      'Please note, that the free cancelation period for this booking is over, the charges are non-refundable.'
    )
  })

  it('calls onClose when clicking "Keep the booking" button or "X" icon', () => {
    const onClose = vi.fn()
    render(<CancelBookingModal {...defaultProps} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('keep-booking-button'))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('calls onClose when pressing Escape key or clicking backdrop', () => {
    const onClose = vi.fn()
    render(<CancelBookingModal {...defaultProps} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('cancel-booking-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('calls onConfirmCancel when clicking "Cancel the booking" button in customer mode', () => {
    const onConfirmCancel = vi.fn()
    render(<CancelBookingModal {...defaultProps} mode="customer" onConfirmCancel={onConfirmCancel} />)

    fireEvent.click(screen.getByTestId('confirm-cancel-button'))
    expect(onConfirmCancel).toHaveBeenCalledTimes(1)
  })

  it('disables buttons and prevents closing via ESC or backdrop when isLoading is true', () => {
    const onClose = vi.fn()
    render(<CancelBookingModal {...defaultProps} isLoading={true} onClose={onClose} />)

    const confirmBtn = screen.getByTestId('confirm-cancel-button')
    const keepBtn = screen.getByTestId('keep-booking-button')

    expect(confirmBtn).toBeDisabled()
    expect(confirmBtn).toHaveTextContent('Cancelling...')
    expect(keepBtn).toBeDisabled()

    fireEvent.click(screen.getByTestId('cancel-booking-backdrop'))
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('locks body scroll when open and restores it when unmounted', () => {
    const { unmount } = render(<CancelBookingModal {...defaultProps} />)
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
