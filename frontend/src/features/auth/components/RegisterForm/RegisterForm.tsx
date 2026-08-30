import React, { useEffect, useRef, useState } from 'react'
import { InputField } from '../../../../components/ui/InputField/InputField'
import { PasswordInput } from '../../../../components/ui/PasswordInput/PasswordInput'
import { Button } from '../../../../components/ui/Button/Button'
import { Toast } from '../../../../components/ui/Toast/Toast'
import { HeaderGroup } from '../../../../components/ui/HeaderGroup/HeaderGroup'
import { PasswordRequirementsList } from './PasswordRequirementsList'

import { AuthHeroCard } from '../AuthHeroCard/AuthHeroCard'
import {
  getPasswordChecks,
  validateRegisterForm,
  ERROR_MESSAGES,
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
} from '../../../../utils/validation'
import type { RegisterFormData, RegisterFormErrors } from '../../../../utils/validation'
import '../AuthLayout.css'
import './RegisterForm.css'
import { authService } from '../../../../api/services/auth.service'
import { toRegisterRequest } from './registerForm.mapper'

export interface RegisterFormProps {
  onNavigateToLogin?: () => void
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onNavigateToLogin }) => {
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const [errors, setErrors] = useState<RegisterFormErrors>({})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  const passwordChecks = getPasswordChecks(formData.password)

  const isConfirmMatch =
    formData.confirmPassword.length > 0 &&
    formData.confirmPassword === formData.password

  const isFormEmpty =
    !formData.firstName.trim() ||
    !formData.lastName.trim() ||
    !formData.email.trim() ||
    !formData.password ||
    !formData.confirmPassword

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const updatedForm = { ...formData, [name]: value }
    setFormData(updatedForm)

    if (isSubmitted || errors[name as keyof RegisterFormErrors]) {
      const liveErrors = validateRegisterForm(updatedForm)
      setErrors((prev) => ({
        ...prev,
        [name]: liveErrors[name as keyof RegisterFormErrors],
      }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors = validateRegisterForm(formData)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitted(true)

    if (isSubmitting || isFormEmpty || !validateForm()) return

    setIsSubmitting(true)
    try {
      await authService.register(toRegisterRequest(formData))

      setToastType('success')
      setToastMessage(ERROR_MESSAGES.successRegistration)

      redirectTimeoutRef.current = setTimeout(() => {
        setIsSubmitting(false)
        if (onNavigateToLogin) {
          onNavigateToLogin()
        }
      }, 2500)
    } catch (error: unknown) {
      setToastType('error')
      setToastMessage(error instanceof Error ? error.message : 'Registration failed')
      setIsSubmitting(false)
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
        {/* Left Side Registration Form Card */}
        <div className="auth-card register-form">
          <div className="auth-card-content">
            {/* Header Group */}
            <HeaderGroup
              overline="LET'S GET YOU STARTED"
              title="Create an account"
              className="auth-header-group"
            />

            {/* Inputs Group Div: 40px margin-top to title group */}
            <form onSubmit={handleSubmit} noValidate className="auth-inputs-group">
              {/* Name Row (First Name + Last Name side-by-side) */}
              <div className="name-row">
                <InputField
                  label="First name"
                  name="firstName"
                  type="text"
                  placeholder="Enter your first name"
                  helperText="e.g. Johnson"
                  value={formData.firstName}
                  onChange={handleChange}
                  error={errors.firstName}
                />

                <InputField
                  label="Last name"
                  name="lastName"
                  type="text"
                  placeholder="Enter your last name"
                  helperText="e.g. Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  error={errors.lastName}
                />
              </div>

              {/* Email Field */}
              <InputField
                label="Email"
                name="email"
                type="email"
                placeholder="Enter your email"
                helperText="e.g. username@domain.com"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                maxLength={MAX_EMAIL_LENGTH}
              />

              {/* Password Group: input + requirements wrapped together */}
              <div className="password-group">
                <PasswordInput
                  label="Password"
                  name="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  error={errors.password}
                  maxLength={MAX_PASSWORD_LENGTH}
                />

                <PasswordRequirementsList
                  password={formData.password}
                  checks={passwordChecks}
                  isSubmitted={isSubmitted}
                />
              </div>

              {/* Confirm Password Group: input + match bullet wrapped together */}
              <div className="password-group">
                <PasswordInput
                  label="Confirm password"
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  error={errors.confirmPassword}
                  maxLength={MAX_PASSWORD_LENGTH}
                />

                <ul className="password-requirements-list">
                  <li
                    className={`req-item ${formData.confirmPassword
                        ? isConfirmMatch
                          ? 'valid'
                          : 'invalid'
                        : ''
                      }`}
                  >
                    <span className="req-bullet"></span>
                    Confirm password must match your password
                  </li>
                </ul>
              </div>

              {/* Submit Button */}
              <Button type="submit" disabled={isFormEmpty || isSubmitting}>
                {isSubmitting ? 'Creating account...' : 'Create an account'}
              </Button>

              {/* Login Link */}
              <div className="auth-nav-link-container">
                Already have an account?
                <a
                  href="#login"
                  className="auth-nav-link"
                  onClick={(e) => {
                    e.preventDefault()
                    if (onNavigateToLogin) onNavigateToLogin()
                  }}
                >
                  Login
                </a>{' '}
                instead
              </div>
            </form>
          </div>
        </div>

        {/* Right Side Travel Agency Beach Hero Card */}
        <AuthHeroCard headline="Let's plan your next trip!" />
      </div>
    </div>
  )
}
