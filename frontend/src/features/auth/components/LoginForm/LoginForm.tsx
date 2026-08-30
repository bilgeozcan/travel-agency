import React, { useEffect, useState } from 'react'
import { InputField } from '@/components/ui/InputField/InputField'
import { PasswordInput } from '@/components/ui/PasswordInput/PasswordInput'
import { Button } from '@/components/ui/Button/Button'
import { Toast } from '@/components/ui/Toast/Toast'
import { HeaderGroup } from '@/components/ui/HeaderGroup/HeaderGroup'
import { AuthHeroCard } from '../AuthHeroCard/AuthHeroCard'
import { authService } from '@/api/services/auth.service'
import { ApiError } from '@/api/client/apiError'
import type { AuthSession } from '@/features/auth/types/auth'
import {
  ERROR_MESSAGES,
  isValidEmail,
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
} from '../../../../utils/validation'
import '../AuthLayout.css'
import './LoginForm.css'

const EMAIL_CHANGE_SUCCESS_TOAST_KEY = 'email-change-success-toast'

export interface LoginFormProps {
  onNavigateToRegister?: () => void
  onNavigateToForgotPassword?: () => void
  onLoginSuccess?: (session: AuthSession) => void
  initialToastMessage?: string
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onNavigateToRegister,
  onNavigateToForgotPassword,
  onLoginSuccess,
  initialToastMessage,
}) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [credentialError, setCredentialError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(() => {
    const storedMessage = sessionStorage.getItem(EMAIL_CHANGE_SUCCESS_TOAST_KEY)
    if (storedMessage) {
      sessionStorage.removeItem(EMAIL_CHANGE_SUCCESS_TOAST_KEY)
      return storedMessage
    }

    return initialToastMessage ?? null
  })
  const [toastType] = useState<'success' | 'error'>('success')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (initialToastMessage) setToastMessage(initialToastMessage)
  }, [initialToastMessage])

  const isFormEmpty = !formData.email.trim() || !formData.password

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errorMessage) {
      setErrorMessage(null)
    }
    if (credentialError) {
      setCredentialError(null)
    }
    if (name === 'email' && emailError) {
      setEmailError(null)
    }
  }

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault()
    if (onNavigateToForgotPassword) {
      onNavigateToForgotPassword()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isFormEmpty) return

    if (!isValidEmail(formData.email)) {
      setEmailError(ERROR_MESSAGES.email)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setCredentialError(null)
    setEmailError(null)

    try {
      const session = await authService.login(formData)

      if (onLoginSuccess) {
        onLoginSuccess(session)
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        setCredentialError(ERROR_MESSAGES.incorrectCredentials)
      } else {
        setErrorMessage(error instanceof Error ? error.message : ERROR_MESSAGES.incorrectCredentials)
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
          type={toastType}
          onClose={() => setToastMessage(null)}
        />
      )}

      <div className="auth-container">
        {/* Left Side Login Card */}
        <div className="auth-card login-form">
          <div className="auth-card-content">
            {/* Header Group */}
            <HeaderGroup
              overline="WELCOME BACK"
              title="Sign in to your account"
              className="auth-header-group"
            />

            {/* Form Inputs Group */}
            <form onSubmit={handleSubmit} noValidate className="auth-inputs-group">
              {/* Error Banner */}
              {errorMessage && (
                <div className="login-error-banner" role="alert">
                  {errorMessage}
                </div>
              )}

              {/* Email Field */}
              <InputField
                label="Email"
                name="email"
                type="email"
                placeholder="Enter your email"
                helperText="e.g. username@domain.com"
                value={formData.email}
                onChange={handleChange}
                error={emailError ?? credentialError ?? undefined}
                maxLength={MAX_EMAIL_LENGTH}
              />

              {/* Password Group */}
              <div className="password-group">
                <PasswordInput
                  label="Password"
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  error={credentialError ?? undefined}
                  maxLength={MAX_PASSWORD_LENGTH}
                />

                <div className="forgot-password-container">
                  <button
                    type="button"
                    className="forgot-password-link"
                    onClick={handleForgotPassword}
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {/* Sign In Button */}
              <Button type="submit" disabled={isFormEmpty || isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>

              {/* Register Link */}
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
          </div>
        </div>

        {/* Right Side Beach Hero Card */}
        <AuthHeroCard headline="Let's plan your next trip!" />
      </div>
    </div>
  )
}
