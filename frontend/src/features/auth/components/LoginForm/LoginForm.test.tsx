import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginForm } from './LoginForm'
import { authService } from '../../../../api/services/auth.service'
import { ApiError } from '../../../../api/client/apiError'

vi.mock('../../../../api/services/auth.service', () => ({
  authService: {
    login: vi.fn(),
    saveSession: vi.fn(),
  },
}))

describe('LoginForm Component', () => {
  const mockNavigateToRegister = vi.fn()
  const mockLoginSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form with overline, title, email, password, forgot password link, and disabled button', () => {
    render(
      <LoginForm
        onNavigateToRegister={mockNavigateToRegister}
        onLoginSuccess={mockLoginSuccess}
      />
    )

    expect(screen.getByText('WELCOME BACK')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sign in to your account' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByText('Forgot password?')).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: 'Sign in' })
    expect(submitBtn).toBeDisabled()
  })

  it('shows an initial success toast after an email-change redirect', () => {
    render(<LoginForm initialToastMessage="Your email has been changed successfully" />)

    expect(screen.getByRole('status')).toHaveTextContent('Your email has been changed successfully')
  })

  it('shows and consumes the stored email-change success toast', () => {
    sessionStorage.setItem('email-change-success-toast', 'Your email has been changed successfully')

    render(<LoginForm />)

    expect(screen.getByRole('status')).toHaveTextContent('Your email has been changed successfully')
    expect(sessionStorage.getItem('email-change-success-toast')).toBeNull()
  })

  it('shows a success toast when the redirect message arrives after render', () => {
    const { rerender } = render(<LoginForm />)

    rerender(<LoginForm initialToastMessage="Your email has been changed successfully" />)

    expect(screen.getByRole('status')).toHaveTextContent('Your email has been changed successfully')
  })

  it('keeps Sign in button disabled when only email is filled', () => {
    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    })

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
  })

  it('keeps Sign in button disabled when only password is filled', () => {
    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Password123!' },
    })

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
  })

  it('enables Sign in button when both email and password are filled', () => {
    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Password123!' },
    })

    expect(screen.getByRole('button', { name: 'Sign in' })).not.toBeDisabled()
  })

  it('shows an error without submitting an invalid email address', () => {
    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: '123' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: '123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByLabelText('Email')).toHaveClass('input-error')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid email address. Please ensure it follows the format: username@domain.com'
    )
    expect(document.querySelector('.login-error-banner')).not.toBeInTheDocument()
    expect(authService.login).not.toHaveBeenCalled()
  })

  it('calls onNavigateToForgotPassword when clicking Forgot password?', () => {
    const mockNavigateToForgotPassword = vi.fn()
    render(<LoginForm onNavigateToForgotPassword={mockNavigateToForgotPassword} />)

    fireEvent.click(screen.getByText('Forgot password?'))

    expect(mockNavigateToForgotPassword).toHaveBeenCalledTimes(1)
  })

  it('calls authService.login and onLoginSuccess on valid submission', async () => {
    const mockSession = {
      accessToken: 'mock-access-token',
      expiresAt: Date.now() + 60_000,
      user: {
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      },
    }
    vi.mocked(authService.login).mockResolvedValueOnce(mockSession)

    render(
      <LoginForm
        onNavigateToRegister={mockNavigateToRegister}
        onLoginSuccess={mockLoginSuccess}
      />
    )

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'john@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Password123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        email: 'john@example.com',
        password: 'Password123!',
      })
      expect(authService.saveSession).not.toHaveBeenCalled()
      expect(mockLoginSuccess).toHaveBeenCalledWith(mockSession)
    })
  })

  it('displays the credential error below both inputs when login credentials are invalid', async () => {
    vi.mocked(authService.login).mockRejectedValueOnce(
      new ApiError(
        { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        401
      )
    )

    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'wrong@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'WrongPass123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      const errorMessages = screen.getAllByRole('alert')
      expect(errorMessages).toHaveLength(2)
      errorMessages.forEach((errorMessage) => {
        expect(errorMessage).toHaveTextContent(
          'Incorrect email or password. Try again or create an account.'
        )
      })
      expect(document.querySelector('.login-error-banner')).not.toBeInTheDocument()
    })
  })

  it('keeps the banner for non-credential login errors', async () => {
    vi.mocked(authService.login).mockRejectedValueOnce(
      new ApiError(
        { code: 'AUTHENTICATION_SERVICE_UNAVAILABLE', message: 'Authentication service is temporarily unavailable' },
        503
      )
    )

    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Password123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Authentication service is temporarily unavailable'
    )
    expect(document.querySelector('.login-error-banner')).toBeInTheDocument()
  })

  it('clears credential errors when user starts typing again', async () => {
    vi.mocked(authService.login).mockRejectedValueOnce(
      new ApiError(
        { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        401
      )
    )

    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'wrong@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'WrongPass!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(screen.getAllByRole('alert')).toHaveLength(2)
    })

    // Typing again should clear the error
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' },
    })

    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })

  it('calls onNavigateToRegister when clicking Create an account link', () => {
    render(<LoginForm onNavigateToRegister={mockNavigateToRegister} />)

    fireEvent.click(screen.getByText('Create an account'))

    expect(mockNavigateToRegister).toHaveBeenCalledTimes(1)
  })

  it('does not submit form when button is disabled (empty fields)', () => {
    render(<LoginForm />)

    const submitBtn = screen.getByRole('button', { name: 'Sign in' })
    fireEvent.click(submitBtn)

    expect(authService.login).not.toHaveBeenCalled()
  })
})
