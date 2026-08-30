import React, { useState } from 'react'
import { PasswordInput } from '@/components/ui/PasswordInput/PasswordInput'
import { Button } from '@/components/ui/Button/Button'
import { Toast } from '@/components/ui/Toast/Toast'
import { HeaderGroup } from '@/components/ui/HeaderGroup/HeaderGroup'
import { AuthHeroCard } from '../AuthHeroCard/AuthHeroCard'
import { PasswordRequirementsList } from '../RegisterForm/PasswordRequirementsList'
import { authService } from '@/api/services/auth.service'
import { ApiError } from '@/api/client/apiError'
import {
  getPasswordChecks,
  validateResetPasswordForm,
  ERROR_MESSAGES,
  MAX_PASSWORD_LENGTH,
} from '@/utils/validation'
import '../AuthLayout.css'
import '../RegisterForm/RegisterForm.css'
import './NewPasswordScreen.css'

export interface NewPasswordScreenProps {
  email?: string
  confirmationCode?: string
  onNavigateToLogin?: (toastMessage?: string) => void
}

export const NewPasswordScreen: React.FC<NewPasswordScreenProps> = ({
  email = '',
  confirmationCode = '',
  onNavigateToLogin,
}) => {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  const passwordChecks = getPasswordChecks(newPassword)
  const isConfirmMatch = confirmPassword.length > 0 && confirmPassword === newPassword
  const isButtonDisabled = !newPassword.trim() || !confirmPassword.trim()

  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPassword(e.target.value)
    if (passwordError) setPasswordError(null)
  }

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value)
    if (confirmError) setConfirmError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitted(true)

    if (isButtonDisabled || isLoading) return

    const validationErrors = validateResetPasswordForm({ newPassword, confirmPassword })
    if (Object.keys(validationErrors).length > 0) {
      setPasswordError(validationErrors.newPassword ?? null)
      setConfirmError(validationErrors.confirmPassword ?? null)
      return
    }

    setIsLoading(true)
    setPasswordError(null)
    setConfirmError(null)
    setToastMessage(null)

    try {
      await authService.resetPassword(email, confirmationCode, newPassword)

      setToastType('success')
      setToastMessage(ERROR_MESSAGES.successResetPassword)

      if (onNavigateToLogin) {
        onNavigateToLogin(ERROR_MESSAGES.successResetPassword)
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && (error.status === 400 || error.status === 401 || error.status === 422)) {
        setPasswordError(error.message || 'Invalid or expired confirmation code or password.')
      } else if (error instanceof ApiError) {
        setToastType('error')
        setToastMessage(error.message || 'An unexpected error occurred. Please try again later.')
      } else if (error instanceof TypeError) {
        setToastType('error')
        setToastMessage('Network error. Please check your internet connection and try again.')
      } else {
        setToastType('error')
        setToastMessage(error instanceof Error ? error.message : 'An error occurred')
      }
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page-wrapper">
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage(null)}
        />
      )}

      <div className="auth-container">
        {/* Left Card: Reset Password Form */}
        <div className="auth-card new-password-form">
          <div className="auth-card-content">
            <HeaderGroup
              title="Reset password"
              className="auth-header-group"
            />

            <form onSubmit={handleSubmit} noValidate className="auth-inputs-group">
              {/* New Password Field */}
              <div className="password-group">
                <PasswordInput
                  label="New password"
                  name="newPassword"
                  placeholder="Enter your new password"
                  value={newPassword}
                  onChange={handleNewPasswordChange}
                  error={passwordError ?? undefined}
                  maxLength={MAX_PASSWORD_LENGTH}
                />

                <PasswordRequirementsList
                  password={newPassword}
                  checks={passwordChecks}
                  isSubmitted={isSubmitted}
                />
              </div>

              {/* Confirm Password Field */}
              <div className="password-group">
                <PasswordInput
                  label="Confirm password"
                  name="confirmPassword"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  error={confirmError ?? undefined}
                  maxLength={MAX_PASSWORD_LENGTH}
                />

                <ul className="password-requirements-list">
                  <li
                    className={`req-item ${
                      confirmPassword
                        ? isConfirmMatch
                          ? 'valid'
                          : 'invalid'
                        : ''
                    }`}
                  >
                    <span className="req-bullet"></span>
                    Confirm password must match new password
                  </li>
                </ul>
              </div>

              {/* Reset Button */}
              <Button type="submit" disabled={isButtonDisabled || isLoading}>
                {isLoading ? 'Resetting...' : 'Reset'}
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
