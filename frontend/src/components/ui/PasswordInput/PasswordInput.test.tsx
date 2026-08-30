import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PasswordInput } from './PasswordInput'

describe('PasswordInput Primitive Component', () => {
  it('renders input with type "password" by default', () => {
    render(<PasswordInput label="Password" />)
    
    const input = screen.getByLabelText(/^Password$/i) as HTMLInputElement
    expect(input.type).toBe('password')
  })

  it('renders eye toggle button by default and switches type on click', async () => {
    render(<PasswordInput label="Password" />)

    const input = screen.getByLabelText(/^Password$/i) as HTMLInputElement
    const toggleBtn = screen.getByRole('button', { name: /Show password/i })

    expect(toggleBtn).toBeInTheDocument()
    expect(input.type).toBe('password')

    // Click to show password
    await userEvent.click(toggleBtn)
    expect(input.type).toBe('text')
    expect(screen.getByRole('button', { name: /Hide password/i })).toBeInTheDocument()

    // Click to hide password
    await userEvent.click(screen.getByRole('button', { name: /Hide password/i }))
    expect(input.type).toBe('password')
  })

  it('hides eye toggle button when showToggle is false', () => {
    render(<PasswordInput label="Password" showToggle={false} />)

    expect(screen.queryByRole('button', { name: /password/i })).not.toBeInTheDocument()
  })

  it('passes error prop down to InputField', () => {
    render(<PasswordInput label="Password" error="Password required" />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Password required')
  })
})
