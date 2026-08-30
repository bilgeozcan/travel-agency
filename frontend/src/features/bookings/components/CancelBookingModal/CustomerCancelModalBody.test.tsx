import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CustomerCancelModalBody } from './CustomerCancelModalBody'

describe('CustomerCancelModalBody Component', () => {
  it('renders confirmation message and policy banner', () => {
    const onConfirmCancel = vi.fn()
    const onClose = vi.fn()

    render(
      <CustomerCancelModalBody
        tourTitle="Swiss Alps Ski Retreat"
        startDate="2025-01-15"
        durationDays={7}
        mealPlan="Breakfast (BB)"
        guestsText="2 adults"
        onClose={onClose}
        onConfirmCancel={onConfirmCancel}
      />
    )

    expect(screen.getByTestId('cancellation-policy-banner')).toBeInTheDocument()
    expect(screen.getByText(/Swiss Alps Ski Retreat/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel the booking' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep the booking' })).toBeInTheDocument()
  })
})
