import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InputField } from './InputField'

describe('InputField Primitive Component', () => {
  it('renders label and ties it to input element via generated id', () => {
    render(<InputField label="First Name" />)
    
    const input = screen.getByLabelText(/First Name/i)
    expect(input).toBeInTheDocument()
    expect(input.id).toBe('input-first-name')
  })

  it('renders custom id when provided', () => {
    render(<InputField label="Email" id="custom-email-id" />)
    
    const input = screen.getByLabelText(/Email/i)
    expect(input.id).toBe('custom-email-id')
  })

  it('displays helper text when no error is present', () => {
    render(<InputField label="Username" helperText="Enter 4-12 characters" />)
    
    expect(screen.getByText('Enter 4-12 characters')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('displays error message and adds input-error class when error is present', () => {
    render(<InputField label="Email" error="Invalid email address" helperText="Helper text" />)
    
    const errorText = screen.getByRole('alert')
    expect(errorText).toHaveTextContent('Invalid email address')
    expect(errorText).toHaveClass('input-error-text')
    
    // Helper text should be hidden when error is present
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument()

    const input = screen.getByLabelText(/Email/i)
    expect(input).toHaveClass('input-error')
  })

  it('renders rightElement node when provided', () => {
    render(<InputField label="Search" rightElement={<span data-testid="right-icon">🔍</span>} />)
    
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
  })

  it('passes standard HTML input props (onChange, placeholder, value, disabled)', () => {
    const handleChange = vi.fn()
    render(
      <InputField
        label="Test Input"
        placeholder="Enter text"
        value="Initial"
        onChange={handleChange}
        disabled
      />
    )

    const input = screen.getByLabelText(/Test Input/i) as HTMLInputElement
    expect(input.placeholder).toBe('Enter text')
    expect(input.value).toBe('Initial')
    expect(input).toBeDisabled()

    fireEvent.change(input, { target: { value: 'New Value' } })
    expect(handleChange).toHaveBeenCalled()
  })
})
