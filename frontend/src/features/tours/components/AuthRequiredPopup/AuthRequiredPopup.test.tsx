import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthRequiredPopup } from './AuthRequiredPopup'

describe('AuthRequiredPopup', () => {
  it('does not render when popup is closed', () => {
    render(
      <AuthRequiredPopup
        isOpen={false}
        onClose={vi.fn()}
        onSignIn={vi.fn()}
        onCreateAccount={vi.fn()}
      />
    )

    expect(screen.queryByTestId('auth-required-popup')).not.toBeInTheDocument()
  })

  it('renders provided guest-auth message and actions when open', () => {
    render(
      <AuthRequiredPopup
        isOpen={true}
        onClose={vi.fn()}
        onSignIn={vi.fn()}
        onCreateAccount={vi.fn()}
      />
    )

    expect(screen.getByTestId('auth-required-popup')).toBeInTheDocument()
    expect(screen.getByText('To book a tour please sign in or create an account')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeInTheDocument()
  })

  it('calls respective handlers for close and action buttons', async () => {
    const user = userEvent.setup()
    const handleClose = vi.fn()
    const handleSignIn = vi.fn()
    const handleCreateAccount = vi.fn()

    render(
      <AuthRequiredPopup
        isOpen={true}
        onClose={handleClose}
        onSignIn={handleSignIn}
        onCreateAccount={handleCreateAccount}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await user.click(screen.getByRole('button', { name: 'Create an account' }))
    await user.click(screen.getByRole('button', { name: 'Close sign-in popup' }))

    expect(handleSignIn).toHaveBeenCalledTimes(1)
    expect(handleCreateAccount).toHaveBeenCalledTimes(1)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
