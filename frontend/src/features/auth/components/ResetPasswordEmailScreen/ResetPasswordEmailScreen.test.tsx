import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ResetPasswordEmailScreen } from './ResetPasswordEmailScreen'
import { authService } from '@/api/services/auth.service'
import { ApiError } from '@/api/client/apiError'

vi.mock('@/api/services/auth.service', () => ({
  authService: {
    requestPasswordReset: vi.fn(),
  },
}))

describe('ResetPasswordEmailScreen Component', () => {
  const mockNavigateToRegister = vi.fn()
  const mockNavigateToVerify = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Reset password screen with title, email input, disabled button, and register link', () => {
    render(
      <ResetPasswordEmailScreen
        onNavigateToRegister={mockNavigateToRegister}
        onNavigateToVerify={mockNavigateToVerify}
      />
    )

    expect(screen.getByRole('heading', { name: 'Reset password' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument()
    expect(screen.getByText('e.g. username@domain.com')).toBeInTheDocument()
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument()
    expect(screen.getByText('Create an account')).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: 'Request a reset link' })
    expect(submitBtn).toBeDisabled()
  })

  it('keeps button disabled when email field contains only whitespace', () => {
    render(<ResetPasswordEmailScreen />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: '   ' },
    })

    expect(screen.getByRole('button', { name: 'Request a reset link' })).toBeDisabled()
  })

  it('enables button when email is entered', () => {
    render(<ResetPasswordEmailScreen />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    })

    expect(screen.getByRole('button', { name: 'Request a reset link' })).not.toBeDisabled()
  })

  it('displays validation error message when invalid email is submitted', () => {
    render(<ResetPasswordEmailScreen />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'invalid-email' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Request a reset link' }))

    expect(screen.getByLabelText('Email')).toHaveClass('input-error')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid email address. Please ensure it follows the format: username@domain.com'
    )
    expect(authService.requestPasswordReset).not.toHaveBeenCalled()
  })

  it('clears error when email input is modified after validation failure', () => {
    render(<ResetPasswordEmailScreen />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'invalid-email' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Request a reset link' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'valid@example.com' },
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('calls authService.requestPasswordReset and navigates to verify on valid submit', async () => {
    vi.mocked(authService.requestPasswordReset).mockResolvedValueOnce({
      success: true,
      data: { message: 'Reset link sent' },
    })

    render(
      <ResetPasswordEmailScreen
        onNavigateToRegister={mockNavigateToRegister}
        onNavigateToVerify={mockNavigateToVerify}
      />
    )

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'USER@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Request a reset link' }))

    await waitFor(() => {
      expect(authService.requestPasswordReset).toHaveBeenCalledWith('USER@example.com')
      expect(screen.getByRole('heading', { name: 'Email sent' })).toBeInTheDocument()
      expect(
        screen.getByText(
          'We sent an email to user@example.com with a link to reset your password. Please follow the instructions in the email.'
        )
      ).toBeInTheDocument()
    })
  })

  it('navigates to verify on ApiError 404 for email anti-enumeration protection', async () => {
    vi.mocked(authService.requestPasswordReset).mockRejectedValueOnce(
      new ApiError({ code: 'USER_NOT_FOUND', message: 'User not found' }, 404)
    )

    render(
      <ResetPasswordEmailScreen
        onNavigateToRegister={mockNavigateToRegister}
        onNavigateToVerify={mockNavigateToVerify}
      />
    )

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'nonexistent@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Request a reset link' }))

    await waitFor(() => {
      expect(mockNavigateToVerify).toHaveBeenCalledWith('nonexistent@example.com')
    })
  })

  it('shows error toast when ApiError 500 internal server error occurs', async () => {
    vi.mocked(authService.requestPasswordReset).mockRejectedValueOnce(
      new ApiError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database connection failed' }, 500)
    )

    render(<ResetPasswordEmailScreen />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Request a reset link' }))

    await waitFor(() => {
      expect(screen.getByText('Database connection failed')).toBeInTheDocument()
    })
  })

  it('shows toast notification when a fetch TypeError connectivity error occurs', async () => {
    vi.mocked(authService.requestPasswordReset).mockRejectedValueOnce(
      new TypeError('Failed to fetch')
    )

    render(<ResetPasswordEmailScreen />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Request a reset link' }))

    await waitFor(() => {
      expect(
        screen.getByText('Network error. Please check your internet connection and try again.')
      ).toBeInTheDocument()
    })
  })

  it('calls onNavigateToRegister when clicking Create an account link', () => {
    render(
      <ResetPasswordEmailScreen
        onNavigateToRegister={mockNavigateToRegister}
        onNavigateToVerify={mockNavigateToVerify}
      />
    )

    fireEvent.click(screen.getByText('Create an account'))

    expect(mockNavigateToRegister).toHaveBeenCalledTimes(1)
  })
})
