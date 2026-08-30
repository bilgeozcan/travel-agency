import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TourTypeDropdownPopover } from './TourTypeDropdownPopover'

describe('TourTypeDropdownPopover Component', () => {
  it('does not render when isOpen is false', () => {
    render(
      <TourTypeDropdownPopover
        isOpen={false}
        selectedTourTypes={[]}
        onToggleTourType={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.queryByTestId('tour-type-dropdown-popover')).not.toBeInTheDocument()
  })

  it('renders all tour type options when isOpen is true', () => {
    render(
      <TourTypeDropdownPopover
        isOpen={true}
        selectedTourTypes={['RESORT']}
        onToggleTourType={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByTestId('tour-type-dropdown-popover')).toBeInTheDocument()
    expect(screen.getByText('Resorts')).toBeInTheDocument()
    expect(screen.getByText('Cruises')).toBeInTheDocument()
    expect(screen.getByText('Hikes')).toBeInTheDocument()
  })

  it('triggers onToggleTourType when an option is clicked', async () => {
    const user = userEvent.setup()
    const handleToggle = vi.fn()

    render(
      <TourTypeDropdownPopover
        isOpen={true}
        selectedTourTypes={[]}
        onToggleTourType={handleToggle}
        onClose={vi.fn()}
      />
    )

    await user.click(screen.getByText('Cruises'))
    expect(handleToggle).toHaveBeenCalledWith('CRUISE')
  })
})
