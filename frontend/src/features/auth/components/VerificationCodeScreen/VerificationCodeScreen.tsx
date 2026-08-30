import React, { useState } from 'react'
import { InputField } from '@/components/ui/InputField/InputField'
import { Button } from '@/components/ui/Button/Button'
import { Toast } from '@/components/ui/Toast/Toast'
import { HeaderGroup } from '@/components/ui/HeaderGroup/HeaderGroup'
import { AuthHeroCard } from '../AuthHeroCard/AuthHeroCard'
import { authService } from '@/api/services/auth.service'
import { ApiError } from '@/api/client/apiError'
import { useCountdownTimer } from '@/hooks/useCountdownTimer'
import '../AuthLayout.css'
import './VerificationCodeScreen.css'

export interface VerificationCodeScreenProps {
  email?: string
  onNavigateToResetPassword?: (email: string, resetToken?: string, code?: string) => void
  onNavigateBackToEmail?: () => void
}


export const VerificationCodeScreen: React.FC<VerificationCodeScreenProps> = ({
  email = '',
  onNavigateToResetPassword,
}) => {
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)

  const { secondsLeft, isExpired, restart } = useCountdownTimer(
    60,
    undefined,
    `verification_resend_${email}`
  )

  const isButtonDisabled = !code.trim()

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value)
    if (codeError) {
      setCodeError(null)
    }
  }

  const handleResend = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isExpired || isResending) return

    setIsResending(true)
    setToastMessage(null)
    setCodeError(null)

    try {
      await authService.requestPasswordReset(email)
      restart(60)
      setCode('')
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        setToastMessage(error.message || 'Failed to resend verification code. Please try again.')
      } else if (error instanceof TypeError) {
        setToastMessage('Network error. Please check your internet connection and try again.')
      } else {
        setToastMessage(error instanceof Error ? error.message : 'An error occurred')
      }
    } finally {
      setIsResending(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isButtonDisabled) return

    setCodeError(null)
    setToastMessage(null)

    if (onNavigateToResetPassword) {
      onNavigateToResetPassword(email, undefined, code.trim())
    }
  }

  return (
    <div className="auth-page-wrapper">
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="error"
          onClose={() => setToastMessage(null)}
        />
      )}

      <div className="auth-container">
        {/* Left Card: Verification Code Form */}
        <div className="auth-card verification-code-form">
          <div className="auth-card-content">
            {/* Header Group (Title: Enter verification code) */}
            <HeaderGroup
              title="Enter verification code"
              className="auth-header-group"
            />

            <p className="verification-code-description">
              The verification code has been sent to your email {email}
            </p>

            {/* Inputs Group */}
            <form onSubmit={handleSubmit} noValidate className="auth-inputs-group">
              {/* Verification Code Input Field */}
              <InputField
                label="Verification code"
                name="code"
                type="text"
                placeholder="Enter verification code"
                value={code}
                onChange={handleCodeChange}
                error={codeError ?? undefined}
                autoComplete="one-time-code"
              />

              {/* Resend Helper Text / Link */}
              <div className="resend-container">
                <span className="resend-text">
                  Not received yet?{' '}
                  {isExpired ? (
                    <a
                      href="#resend"
                      className="resend-link"
                      onClick={handleResend}
                    >
                      {isResending ? 'Resending...' : 'Resend'}
                    </a>
                  ) : (
                    `Resend in ${secondsLeft} seconds`
                  )}
                </span>
              </div>

              {/* Continue Button */}
              <Button type="submit" disabled={isButtonDisabled}>
                Continue
              </Button>
            </form>
          </div>
        </div>

        {/* Right Side Beach Hero Card */}
        <AuthHeroCard headline="Let's plan your next trip!" />
      </div>
    </div>
  )
}
