import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Toast } from './Toast'

describe('Toast Component', () => {
  it('renders success toast with title and message', () => {
    render(
      <Toast
        title="Congratulations"
        message="Your account has been created successfully."
        type="success"
      />
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Congratulations')).toBeInTheDocument()
    expect(
      screen.getByText('Your account has been created successfully.')
    ).toBeInTheDocument()
  })

  it('renders error toast with alert role', () => {
    render(
      <Toast
        title="Error"
        message="Registration failed"
        type="error"
      />
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Registration failed')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn()
    render(
      <Toast
        title="Notice"
        message="Test message"
        onClose={handleClose}
      />
    )

    const closeBtn = screen.getByRole('button', { name: /Close notification/i })
    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('automatically parses title when message starts with Congratulations.', () => {
    render(
      <Toast
        message="Congratulations. Your account has been created successfully. Please sign in with your details"
      />
    )

    expect(screen.getByText('Congratulations')).toBeInTheDocument()
    expect(
      screen.getByText('Your account has been created successfully. Please sign in with your details')
    ).toBeInTheDocument()
  })
})
