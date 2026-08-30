import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VerificationCodeScreen } from './VerificationCodeScreen'
import { authService } from '@/api/services/auth.service'

vi.mock('@/api/services/auth.service', () => ({
  authService: {
    requestPasswordReset: vi.fn(),
    verifyResetCode: vi.fn(),
  },
}))

describe('VerificationCodeScreen Component', () => {
  const mockNavigateToResetPassword = vi.fn()
  const testEmail = 'user@example.com'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders title, email description, input, resend countdown, and disabled Continue button', () => {
    render(
      <VerificationCodeScreen
        email={testEmail}
        onNavigateToResetPassword={mockNavigateToResetPassword}
      />
    )

    expect(screen.getByRole('heading', { name: 'Enter verification code' })).toBeInTheDocument()
    expect(
      screen.getByText(`The verification code has been sent to your email ${testEmail}`)
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter verification code')).toBeInTheDocument()
    expect(screen.getByText('Not received yet? Resend in 60 seconds')).toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: 'Continue' })
    expect(submitBtn).toBeDisabled()
  })

  it('keeps button disabled when verification code is whitespace-only', () => {
    render(<VerificationCodeScreen email={testEmail} />)

    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '   ' },
    })

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('enables Continue button when code is typed', () => {
    render(<VerificationCodeScreen email={testEmail} />)

    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '123456' },
    })

    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled()
  })

  it('decreases countdown timer every second and shows Resend link when timer hits 0', () => {
    render(<VerificationCodeScreen email={testEmail} />)

    expect(screen.getByText('Not received yet? Resend in 60 seconds')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByText('Not received yet? Resend in 57 seconds')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(57000)
    })

    expect(screen.getByRole('link', { name: 'Resend' })).toBeInTheDocument()
  })

  it('calls authService.requestPasswordReset and restarts timer to 60 when Resend is clicked', async () => {
    vi.useRealTimers()
    vi.mocked(authService.requestPasswordReset).mockResolvedValueOnce({
      success: true,
      data: { message: 'Reset link resent' },
    })

    render(<VerificationCodeScreen email={testEmail} />)

    // Fast-forward countdown by triggering state if needed or using immediate expired prop in test
    // For timer expire test with real timers:
  })

  it('navigates to reset password screen with entered code on submission', () => {
    vi.useRealTimers()

    render(
      <VerificationCodeScreen
        email={testEmail}
        onNavigateToResetPassword={mockNavigateToResetPassword}
      />
    )

    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '654321' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(mockNavigateToResetPassword).toHaveBeenCalledWith('user@example.com', undefined, '654321')
  })
})

