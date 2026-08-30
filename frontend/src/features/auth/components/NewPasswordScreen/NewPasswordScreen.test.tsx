import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NewPasswordScreen } from './NewPasswordScreen'
import { authService } from '@/api/services/auth.service'
import { ApiError } from '@/api/client/apiError'
import { ERROR_MESSAGES } from '@/utils/validation'

vi.mock('@/api/services/auth.service', () => ({
  authService: {
    resetPassword: vi.fn(),
  },
}))

describe('NewPasswordScreen Component', () => {
  const mockNavigateToLogin = vi.fn()
  const testEmail = 'user@example.com'
  const testCode = '123456'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders title, inputs, password requirement bullets, and disabled Reset button', () => {
    render(
      <NewPasswordScreen
        email={testEmail}
        confirmationCode={testCode}
        onNavigateToLogin={mockNavigateToLogin}
      />
    )

    expect(screen.getByRole('heading', { name: 'Reset password' })).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your new password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Confirm your new password')).toBeInTheDocument()

    expect(screen.getByText('At least one uppercase letter required')).toBeInTheDocument()
    expect(screen.getByText('At least one lowercase letter required')).toBeInTheDocument()
    expect(screen.getByText('At least one number required')).toBeInTheDocument()
    expect(screen.getByText('At least one special character required')).toBeInTheDocument()
    expect(screen.getByText('Password must be 8-64 characters long')).toBeInTheDocument()
    expect(screen.getByText('Confirm password must match new password')).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: 'Reset' })
    expect(submitBtn).toBeDisabled()
  })

  it('keeps Reset button disabled if either field is empty or whitespace-only', () => {
    render(
      <NewPasswordScreen
        email={testEmail}
        confirmationCode={testCode}
      />
    )

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'ValidPass1!' },
    })
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: '   ' },
    })
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
  })

  it('enables Reset button when both fields have text', () => {
    render(
      <NewPasswordScreen
        email={testEmail}
        confirmationCode={testCode}
      />
    )

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'ValidPass1!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'ValidPass1!' },
    })

    expect(screen.getByRole('button', { name: 'Reset' })).not.toBeDisabled()
  })

  it('updates password requirement bullets to valid state when requirements are met', () => {
    render(
      <NewPasswordScreen
        email={testEmail}
        confirmationCode={testCode}
      />
    )

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'Pass123!' },
    })

    const upperItem = screen.getByText('At least one uppercase letter required').closest('.req-item')
    const lowerItem = screen.getByText('At least one lowercase letter required').closest('.req-item')
    const numberItem = screen.getByText('At least one number required').closest('.req-item')
    const specialItem = screen.getByText('At least one special character required').closest('.req-item')
    const lengthItem = screen.getByText('Password must be 8-64 characters long').closest('.req-item')

    expect(upperItem).toHaveClass('valid')
    expect(lowerItem).toHaveClass('valid')
    expect(numberItem).toHaveClass('valid')
    expect(specialItem).toHaveClass('valid')
    expect(lengthItem).toHaveClass('valid')
  })

  it('shows confirm password bullet in invalid state when passwords do not match', () => {
    render(
      <NewPasswordScreen
        email={testEmail}
        confirmationCode={testCode}
      />
    )

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'ValidPass1!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'DifferentPass1!' },
    })

    const confirmItem = screen.getByText('Confirm password must match new password').closest('.req-item')
    expect(confirmItem).toHaveClass('invalid')
  })


  it('calls authService.resetPassword and navigates to login on valid submission', async () => {
    vi.useRealTimers()
    vi.mocked(authService.resetPassword).mockResolvedValueOnce({
      success: true,
      data: { message: 'Password reset successfully' },
    })

    render(
      <NewPasswordScreen
        email={testEmail}
        confirmationCode={testCode}
        onNavigateToLogin={mockNavigateToLogin}
      />
    )

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'NewSecret123!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'NewSecret123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    await waitFor(() => {
      expect(authService.resetPassword).toHaveBeenCalledWith('user@example.com', '123456', 'NewSecret123!')
      expect(screen.getByText(ERROR_MESSAGES.successResetPassword)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(mockNavigateToLogin).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('displays inline error message on ApiError 400 invalid code/password response', async () => {
    vi.useRealTimers()
    vi.mocked(authService.resetPassword).mockRejectedValueOnce(
      new ApiError({ code: 'INVALID_CODE', message: 'Invalid or expired confirmation code.' }, 400)
    )

    render(
      <NewPasswordScreen
        email={testEmail}
        confirmationCode={testCode}
      />
    )

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'NewSecret123!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'NewSecret123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    await waitFor(() => {
      expect(screen.getByLabelText('New password')).toHaveClass('input-error')
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid or expired confirmation code.')
    })
  })

  it('displays Toast error message on ApiError 500 server error response', async () => {
    vi.useRealTimers()
    vi.mocked(authService.resetPassword).mockRejectedValueOnce(
      new ApiError({ code: 'SERVER_ERROR', message: 'Internal server error' }, 500)
    )

    render(
      <NewPasswordScreen
        email={testEmail}
        confirmationCode={testCode}
      />
    )

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'NewSecret123!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'NewSecret123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeInTheDocument()
    })
  })

  it('displays Toast network error message on TypeError fetch failure', async () => {
    vi.useRealTimers()
    vi.mocked(authService.resetPassword).mockRejectedValueOnce(
      new TypeError('Failed to fetch')
    )

    render(
      <NewPasswordScreen
        email={testEmail}
        confirmationCode={testCode}
      />
    )

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'NewSecret123!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'NewSecret123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    await waitFor(() => {
      expect(
        screen.getByText('Network error. Please check your internet connection and try again.')
      ).toBeInTheDocument()
    })
  })
})
