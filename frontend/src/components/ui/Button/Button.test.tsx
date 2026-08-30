import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button Primitive Component', () => {
  it('renders children text correctly', () => {
    render(<Button>Submit Form</Button>)
    expect(screen.getByRole('button', { name: /Submit Form/i })).toBeInTheDocument()
  })

  it('applies default classes (btn, btn-primary, w-full)', () => {
    render(<Button>Click Me</Button>)
    const button = screen.getByRole('button', { name: /Click Me/i })
    expect(button).toHaveClass('btn', 'btn-primary', 'w-full')
  })

  it('renders custom variant and handles fullWidth=false', () => {
    render(<Button variant="outline" fullWidth={false}>Outline Button</Button>)
    const button = screen.getByRole('button', { name: /Outline Button/i })
    expect(button).toHaveClass('btn', 'btn-outline')
    expect(button).not.toHaveClass('w-full')
  })

  it('handles disabled state and applies btn-disabled class', () => {
    render(<Button disabled>Disabled Button</Button>)
    const button = screen.getByRole('button', { name: /Disabled Button/i })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('btn-disabled')
  })

  it('triggers onClick handler when clicked and enabled', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Active Button</Button>)
    
    fireEvent.click(screen.getByRole('button', { name: /Active Button/i }))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not trigger onClick handler when disabled', () => {
    const handleClick = vi.fn()
    render(<Button disabled onClick={handleClick}>Disabled Click</Button>)
    
    fireEvent.click(screen.getByRole('button', { name: /Disabled Click/i }))
    expect(handleClick).not.toHaveBeenCalled()
  })
})
