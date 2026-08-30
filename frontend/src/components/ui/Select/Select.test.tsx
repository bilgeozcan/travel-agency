import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'

describe('Select Component', () => {
  const options = [
    { label: 'Option 1', value: 'opt1' },
    { label: 'Option 2', value: 'opt2' },
  ]

  it('renders label and options correctly', () => {
    render(<Select label="Test Select" options={options} value="opt1" />)

    expect(screen.getByRole('button', { name: 'Test Select' })).toBeInTheDocument()
    expect(screen.getByText('Option 1')).toBeInTheDocument()
  })

  it('calls onChange handler when selecting an option', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Select label="Test Select" options={options} value="opt1" onChange={handleChange} />)

    await user.click(screen.getByRole('button', { name: 'Test Select' }))
    await user.click(screen.getByRole('option', { name: 'Option 2' }))
    expect(handleChange).toHaveBeenCalledWith('opt2')
  })

  it('displays error text when provided', () => {
    render(<Select label="Test Select" options={options} errorText="Required field" />)
    expect(screen.getByText('Required field')).toBeInTheDocument()
  })
})
