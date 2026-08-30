import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CalendarDurationPopover } from './CalendarDurationPopover'

describe('CalendarDurationPopover Component', () => {
  it('does not render when isOpen is false', () => {
    render(
      <CalendarDurationPopover
        isOpen={false}
        onClose={vi.fn()}
        onSelectDateRange={vi.fn()}
        onSelectDurations={vi.fn()}
      />
    )
    expect(screen.queryByTestId('calendar-duration-popover')).not.toBeInTheDocument()
  })

  it('renders popover with Calendar and Duration sections when isOpen is true', () => {
    render(
      <CalendarDurationPopover
        isOpen={true}
        onClose={vi.fn()}
        onSelectDateRange={vi.fn()}
        onSelectDurations={vi.fn()}
      />
    )
    expect(screen.getByTestId('calendar-duration-popover')).toBeInTheDocument()
    expect(screen.getByText('Start date')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('1-3 days')).toBeInTheDocument()
    expect(screen.getByText('4-7 days')).toBeInTheDocument()
  })

  it('handles date selection click', async () => {
    const user = userEvent.setup()
    const handleSelectDateRange = vi.fn()
    const today = new Date()
    const yr = today.getFullYear()
    const mo = String(today.getMonth() + 1).padStart(2, '0')
    const futureDay = today.getDate()
    const dayStr = String(futureDay).padStart(2, '0')
    const futureDate = `${yr}-${mo}-${dayStr}`

    render(
      <CalendarDurationPopover
        isOpen={true}
        onClose={vi.fn()}
        onSelectDateRange={handleSelectDateRange}
        onSelectDurations={vi.fn()}
        availableDates={[futureDate]}
      />
    )

    await user.click(screen.getByText(String(futureDay)))
    expect(handleSelectDateRange).toHaveBeenCalledWith(expect.stringContaining(`-${dayStr}`), '')
  })

  it('triggers onUnavailableDateClick when clicking unavailable date', async () => {
    const user = userEvent.setup()
    const handleUnavailableClick = vi.fn()

    render(
      <CalendarDurationPopover
        isOpen={true}
        onClose={vi.fn()}
        onSelectDateRange={vi.fn()}
        onSelectDurations={vi.fn()}
        availableDates={['2099-12-31']}
        onUnavailableDateClick={handleUnavailableClick}
      />
    )

    const dateCells = screen.getAllByText('15')
    await user.click(dateCells[0])
    expect(handleUnavailableClick).toHaveBeenCalledTimes(1)
  })

  it('handles duration checkbox toggling', async () => {
    const user = userEvent.setup()
    const handleSelectDurations = vi.fn()

    render(
      <CalendarDurationPopover
        isOpen={true}
        onClose={vi.fn()}
        selectedDurations={[]}
        onSelectDateRange={vi.fn()}
        onSelectDurations={handleSelectDurations}
      />
    )

    await user.click(screen.getByText('4-7 days'))
    expect(handleSelectDurations).toHaveBeenCalledWith(['4-7 days'])
  })

  it('navigates next and previous months when nav buttons are clicked', async () => {
    const user = userEvent.setup()

    render(
      <CalendarDurationPopover
        isOpen={true}
        onClose={vi.fn()}
        onSelectDateRange={vi.fn()}
        onSelectDurations={vi.fn()}
      />
    )

    const nextBtn = screen.getByLabelText('Next month')
    await user.click(nextBtn)

    const prevBtn = screen.getByLabelText('Previous month')
    await user.click(prevBtn)
  })
})
