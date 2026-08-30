import React, { useState } from 'react'
import { InputField } from '@/components/ui/InputField/InputField'
import { Button } from '@/components/ui/Button/Button'
import { Toast } from '@/components/ui/Toast/Toast'
import { HeaderGroup } from '@/components/ui/HeaderGroup/HeaderGroup'
import { AuthHeroCard } from '../AuthHeroCard/AuthHeroCard'
import { authService } from '@/api/services/auth.service'
import { ApiError } from '@/api/client/apiError'
import {
  ERROR_MESSAGES,
  isValidEmail,
  MAX_EMAIL_LENGTH,
  normalizeEmail,
} from '@/utils/validation'
import '../AuthLayout.css'
import './ResetPasswordEmailScreen.css'

export interface ResetPasswordEmailScreenProps {
  onNavigateToRegister?: () => void
  onNavigateToVerify?: (email: string) => void
  onNavigateToLogin?: () => void
}

export const ResetPasswordEmailScreen: React.FC<ResetPasswordEmailScreenProps> = ({
  onNavigateToRegister,
  onNavigateToVerify,
}) => {
  const [email, setEmail] = useState('')
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isButtonDisabled = !email.trim()

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    if (emailError) {
      setEmailError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isButtonDisabled || isLoading) return

    if (!isValidEmail(email)) {
      setEmailError(ERROR_MESSAGES.email)
      return
    }

    setIsLoading(true)
    setEmailError(null)
    setToastMessage(null)

    const normalized = normalizeEmail(email)

    try {
      await authService.requestPasswordReset(email)
      setSubmittedEmail(normalized)
      setIsSubmitted(true)
      if (onNavigateToVerify) {
        onNavigateToVerify(normalized)
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) {
        // Anti-enumeration security: If user not found (404), proceed to email sent screen as if sent
        setSubmittedEmail(normalized)
        setIsSubmitted(true)
        if (onNavigateToVerify) {
          onNavigateToVerify(normalized)
        }
      } else if (error instanceof ApiError) {
        // Server or API response error
        setToastMessage(error.message || 'An unexpected error occurred. Please try again later.')
      } else if (error instanceof TypeError) {
        // Fetch network/connectivity failure
        setToastMessage('Network error. Please check your internet connection and try again.')
      } else {
        setToastMessage(error instanceof Error ? error.message : 'An error occurred')
      }
    } finally {
      setIsLoading(false)
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
        {/* Left Card: Reset Password Form / Email Sent Confirmation */}
        <div className="auth-card reset-password-form">
          <div className="auth-card-content">
            {isSubmitted ? (
              <>
                <HeaderGroup
                  title="Email sent"
                  className="auth-header-group"
                />
                <p className="email-sent-description">
                  We sent an email to {submittedEmail} with a link to reset your password. Please follow the instructions in the email.
                </p>
              </>
            ) : (
              <>
                <HeaderGroup
                  title="Reset password"
                  className="auth-header-group"
                />

                <form onSubmit={handleSubmit} noValidate className="auth-inputs-group">
                  <InputField
                    label="Email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    helperText="e.g. username@domain.com"
                    value={email}
                    onChange={handleEmailChange}
                    error={emailError ?? undefined}
                    maxLength={MAX_EMAIL_LENGTH}
                  />

                  <Button type="submit" disabled={isButtonDisabled || isLoading}>
                    {isLoading ? 'Sending request...' : 'Request a reset link'}
                  </Button>

                  <div className="auth-nav-link-container">
                    Don't have an account?
                    <a
                      href="#register"
                      className="auth-nav-link"
                      onClick={(e) => {
                        e.preventDefault()
                        if (onNavigateToRegister) onNavigateToRegister()
                      }}
                    >
                      Create an account
                    </a>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Right Side Beach Hero Card */}
        <AuthHeroCard headline="Let's plan your next trip!" />
      </div>
    </div>
  )
}
