import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookingCardActions } from './BookingCardActions'

describe('BookingCardActions Component', () => {
  const handlers = {
    onCancel: vi.fn(),
    onEdit: vi.fn(),
    onUploadDocuments: vi.fn(),
    onCheckAndConfirm: vi.fn(),
    onGiveFeedback: vi.fn(),
  }

  it('renders Customer actions for status "booked"', () => {
    render(<BookingCardActions role="Customer" status="booked" handlers={handlers} />)

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload documents' })).toBeInTheDocument()
  })

  it('triggers onCancel and onEdit callbacks when clicked', () => {
    render(<BookingCardActions role="Customer" status="booked" handlers={handlers} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(handlers.onCancel).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(handlers.onEdit).toHaveBeenCalledTimes(1)
  })

  it('renders Travel Agent actions for status "booked" including "Check & Confirm"', () => {
    render(<BookingCardActions role="Travel Agent" status="booked" handlers={handlers} />)

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /check (and|&) confirm/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upload documents' })).not.toBeInTheDocument()
  })

  it('strictly hides Edit and Check & Confirm buttons when status is "confirmed"', () => {
    render(<BookingCardActions role="Travel Agent" status="confirmed" handlers={handlers} />)

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /check (and|&) confirm/i })).not.toBeInTheDocument()
  })

  it('disables "Check and confirm" button and shows tooltip when isPendingApproval is true', () => {
    render(
      <BookingCardActions
        role="Travel Agent"
        status="booked"
        handlers={handlers}
        isPendingApproval={true}
      />
    )

    const confirmBtn = screen.getByRole('button', { name: /check (and|&) confirm/i })
    expect(confirmBtn).toBeDisabled()
    expect(screen.getByText('Waiting for changes approval from customer')).toBeInTheDocument()
  })

  it('renders nothing when status is "cancelled"', () => {
    const { container } = render(
      <BookingCardActions role="Customer" status="cancelled" handlers={handlers} />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders "Give feedback" button for Customer when status is STARTED/FINISHED and hasFeedback is false', () => {
    render(<BookingCardActions role="Customer" status="STARTED" handlers={handlers} hasFeedback={false} />)

    const feedbackBtn = screen.getByRole('button', { name: 'Give feedback' })
    expect(feedbackBtn).toBeInTheDocument()

    fireEvent.click(feedbackBtn)
    expect(handlers.onGiveFeedback).toHaveBeenCalledTimes(1)
  })

  it('renders "Update feedback" button for Customer when status is STARTED/FINISHED and hasFeedback is true', () => {
    render(<BookingCardActions role="Customer" status="FINISHED" handlers={handlers} hasFeedback={true} />)

    const updateFeedbackBtn = screen.getByRole('button', { name: 'Update feedback' })
    expect(updateFeedbackBtn).toBeInTheDocument()
  })
})
