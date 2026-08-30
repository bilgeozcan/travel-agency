import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GuestsPopover } from './GuestsPopover'

describe('GuestsPopover Component', () => {
  it('does not render when isOpen is false', () => {
    render(
      <GuestsPopover
        isOpen={false}
        adults={1}
        childrenCount={0}
        onChangeAdults={vi.fn()}
        onChangeChildren={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.queryByTestId('guests-popover')).not.toBeInTheDocument()
  })

  it('renders Adults and Children controls when isOpen is true', () => {
    render(
      <GuestsPopover
        isOpen={true}
        adults={2}
        childrenCount={1}
        onChangeAdults={vi.fn()}
        onChangeChildren={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByTestId('guests-popover')).toBeInTheDocument()
    expect(screen.getByText('Adults')).toBeInTheDocument()
    expect(screen.getByText('Children')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('handles adult increment and decrement buttons', async () => {
    const user = userEvent.setup()
    const handleAdultsChange = vi.fn()

    render(
      <GuestsPopover
        isOpen={true}
        adults={2}
        childrenCount={0}
        onChangeAdults={handleAdultsChange}
        onChangeChildren={vi.fn()}
        onClose={vi.fn()}
      />
    )

    await user.click(screen.getByLabelText('Increase adults'))
    expect(handleAdultsChange).toHaveBeenCalledWith(3)

    await user.click(screen.getByLabelText('Decrease adults'))
    expect(handleAdultsChange).toHaveBeenCalledWith(1)
  })

  it('disables decrease adults button when adults is 1', () => {
    render(
      <GuestsPopover
        isOpen={true}
        adults={1}
        childrenCount={0}
        onChangeAdults={vi.fn()}
        onChangeChildren={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Decrease adults')).toBeDisabled()
  })

  it('disables increase buttons when totalMax limit is reached', () => {
    render(
      <GuestsPopover
        isOpen={true}
        adults={3}
        childrenCount={2}
        totalMax={5}
        onChangeAdults={vi.fn()}
        onChangeChildren={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Increase adults')).toBeDisabled()
    expect(screen.getByLabelText('Increase children')).toBeDisabled()
  })
})
