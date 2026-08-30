import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DestinationDropdownPopover } from './DestinationDropdownPopover'

describe('DestinationDropdownPopover Component', () => {
  it('does not render when isOpen is false or destinations list is empty', () => {
    const { rerender } = render(
      <DestinationDropdownPopover
        isOpen={false}
        destinations={['Punta Cana, Dominican Republic']}
        onSelectDestination={vi.fn()}
      />
    )
    expect(screen.queryByTestId('destination-dropdown-popover')).not.toBeInTheDocument()

    rerender(
      <DestinationDropdownPopover
        isOpen={true}
        destinations={[]}
        onSelectDestination={vi.fn()}
      />
    )
    expect(screen.queryByTestId('destination-dropdown-popover')).not.toBeInTheDocument()
  })

  it('renders destination list when isOpen is true', () => {
    render(
      <DestinationDropdownPopover
        isOpen={true}
        destinations={['Punta Cana, Dominican Republic', 'Barahona, Dominican Republic']}
        onSelectDestination={vi.fn()}
      />
    )
    expect(screen.getByTestId('destination-dropdown-popover')).toBeInTheDocument()
    expect(screen.getByText('Punta Cana, Dominican Republic')).toBeInTheDocument()
    expect(screen.getByText('Barahona, Dominican Republic')).toBeInTheDocument()
  })

  it('triggers onSelectDestination when an item is clicked', async () => {
    const user = userEvent.setup()
    const handleSelect = vi.fn()

    render(
      <DestinationDropdownPopover
        isOpen={true}
        destinations={['Punta Cana, Dominican Republic', 'Barahona, Dominican Republic']}
        onSelectDestination={handleSelect}
      />
    )

    await user.click(screen.getByText('Barahona, Dominican Republic'))
    expect(handleSelect).toHaveBeenCalledWith('Barahona, Dominican Republic')
  })
})
