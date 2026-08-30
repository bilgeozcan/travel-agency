import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CheckboxListPopover } from './CheckboxListPopover'

describe('CheckboxListPopover Component', () => {
  const options = [
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' },
  ]

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CheckboxListPopover
        isOpen={false}
        options={options}
        selectedValues={[]}
        onToggleOption={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders options and indicates selected values', () => {
    render(
      <CheckboxListPopover
        isOpen={true}
        options={options}
        selectedValues={['opt1']}
        onToggleOption={vi.fn()}
      />
    )

    expect(screen.getByText('Option 1')).toBeInTheDocument()
    expect(screen.getByText('Option 2')).toBeInTheDocument()
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('calls onToggleOption when an item is clicked', async () => {
    const handleToggle = vi.fn()
    const user = userEvent.setup()

    render(
      <CheckboxListPopover
        isOpen={true}
        options={options}
        selectedValues={[]}
        onToggleOption={handleToggle}
      />
    )

    await user.click(screen.getByText('Option 2'))
    expect(handleToggle).toHaveBeenCalledWith('opt2')
  })
})
