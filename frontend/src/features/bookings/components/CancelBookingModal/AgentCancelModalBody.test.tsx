import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AgentCancelModalBody } from './AgentCancelModalBody'

describe('AgentCancelModalBody Component', () => {
  const defaultProps = {
    tourTitle: 'Tropical Caribe Hotel',
    location: 'Punta Cana, Dominican Republic',
    startDate: 'January 15, 2025',
    durationDays: 7,
    mealPlan: 'Breakfast (BB)',
    guestsText: '1 adult',
    customerName: 'Johnson Doe',
    customerEmail: 'johnsondoe@nomail.com',
    guestsCount: 1,
    onClose: vi.fn(),
    onConfirmCancel: vi.fn(),
  }

  it('renders booking details grid correctly', () => {
    render(<AgentCancelModalBody {...defaultProps} />)

    expect(screen.getByText('Booking details')).toBeInTheDocument()
    expect(screen.getByTestId('agent-cancel-customer')).toHaveTextContent('Johnson Doe (1 guest)')
    expect(screen.getByTestId('agent-cancel-email')).toHaveTextContent('johnsondoe@nomail.com')
    expect(screen.getByTestId('agent-cancel-tour-name')).toHaveTextContent('Tropical Caribe Hotel')
    expect(screen.getByTestId('agent-cancel-location')).toHaveTextContent('Punta Cana, Dominican Republic')
    expect(screen.getByTestId('agent-cancel-tour-type')).toHaveTextContent('N/A')
  })

  it('renders formatted tour type when provided', () => {
    render(<AgentCancelModalBody {...defaultProps} tourType="CRUISE" />)
    expect(screen.getByTestId('agent-cancel-tour-type')).toHaveTextContent('Cruise')
  })

  it('disables Cancel the booking button until a cancellation reason is selected', () => {
    render(<AgentCancelModalBody {...defaultProps} />)

    const confirmButton = screen.getByTestId('agent-confirm-cancel-button')
    expect(confirmButton).toBeDisabled()

    const selectTrigger = screen.getByTestId('cancellation-reason-select')
    fireEvent.click(selectTrigger)

    const option = screen.getByRole('option', { name: "Customer's Emergency" })
    fireEvent.click(option)

    expect(confirmButton).not.toBeDisabled()
  })

  it('calls onConfirmCancel with selected reason when confirm button is clicked', () => {
    const onConfirmCancel = vi.fn()
    render(<AgentCancelModalBody {...defaultProps} onConfirmCancel={onConfirmCancel} />)

    const selectTrigger = screen.getByTestId('cancellation-reason-select')
    fireEvent.click(selectTrigger)

    const option = screen.getByRole('option', { name: 'Hotel Emergency' })
    fireEvent.click(option)

    const confirmButton = screen.getByTestId('agent-confirm-cancel-button')
    fireEvent.click(confirmButton)

    expect(onConfirmCancel).toHaveBeenCalledWith('Hotel Emergency')
  })
})
