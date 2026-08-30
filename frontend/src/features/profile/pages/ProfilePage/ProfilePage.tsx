import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header/Header'
import { Button } from '@/components/ui/Button/Button'
import { InputField } from '@/components/ui/InputField/InputField'
import { PasswordInput } from '@/components/ui/PasswordInput/PasswordInput'
import { Toast } from '@/components/ui/Toast/Toast'
import type { AuthenticatedUser } from '@/features/auth/types/auth'
import { PasswordRequirementsList } from '@/features/auth/components/RegisterForm/PasswordRequirementsList'
import { useAuth } from '@/providers/AuthContext'
import { profileService } from '@/api/services/profile.service'
import { ApiError } from '@/api/client/apiError'
import { useCountdownTimer } from '@/hooks/useCountdownTimer'
import {
  ERROR_MESSAGES,
  getPasswordChecks,
  isValidName,
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  normalizeEmail,
  validateChangeEmailForm,
  validateResetPasswordForm,
} from '@/utils/validation'
import { PATHS } from '@/routes/paths'
import editIcon from '@/assets/icons/edit.svg'
import './ProfilePage.css'

type ProfileSection = 'general' | 'password' | 'email'
const EMAIL_CHANGE_SUCCESS_TOAST_KEY = 'email-change-success-toast'
const EMAIL_CHANGE_CREDENTIALS_ERROR = 'Invalid email or password'

interface ProfilePageProps {
  user?: AuthenticatedUser | null
  role?: string | null
  onLogout?: () => void
  onNavigateToProfile?: () => void
  onSignInClick?: () => void
  onCreateAccountClick?: () => void
}

interface EmailVerificationFieldsProps {
  email: string
  code: string
  codeError?: string
  isVerifying: boolean
  isResending: boolean
  resendMessage: string | null
  onCodeChange: (value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onResend: () => Promise<boolean>
}

const sections: Array<{ id: ProfileSection; label: string }> = [
  { id: 'general', label: 'General information' },
  { id: 'password', label: 'Change password' },
  { id: 'email', label: 'Change email' },
]

const getEmailChangeErrorField = (error: unknown): 'newEmail' | 'currentPassword' | undefined => {
  if (!(error instanceof ApiError)) return undefined

  if (error.code === 'VALIDATION_ERROR' && typeof error.details === 'object' && error.details !== null) {
    const field = (error.details as { field?: unknown }).field
    if (field === 'newEmail' || field === 'currentPassword') return field
  }

  return undefined
}

const EmailVerificationFields: React.FC<EmailVerificationFieldsProps> = ({
  email,
  code,
  codeError,
  isVerifying,
  isResending,
  resendMessage,
  onCodeChange,
  onSubmit,
  onResend,
}) => {
  const { secondsLeft, isExpired, restart } = useCountdownTimer(60, undefined, `email-change-resend-${email}`)

  const handleResend = async () => {
    if (!isExpired) return
    if (await onResend()) restart(60)
  }

  return (
    <form className="profile-page__email-verification-form" onSubmit={onSubmit} noValidate>
      <p className="profile-page__email-verification-description">We sent an email to {email} with a verification code. Please enter the code from the email.</p>
      <InputField
        label="Verification code"
        name="emailVerificationCode"
        autoComplete="one-time-code"
        inputMode="numeric"
        placeholder="Enter verification code"
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
        error={codeError}
      />
      <p className="profile-page__email-resend">
        Not received yet? {isExpired ? (
          <button type="button" onClick={handleResend} disabled={isResending}>{isResending ? 'Resending...' : 'Resend'}</button>
        ) : `Resend in ${secondsLeft} seconds`}
      </p>
      {resendMessage && <p className="profile-page__email-resend-message" role="status">{resendMessage}</p>}
      <div className="profile-page__email-actions">
        <Button type="submit" fullWidth={false} disabled={!code.trim() || isVerifying} isLoading={isVerifying} loadingText="Verifying">
          Confirm
        </Button>
      </div>
    </form>
  )
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  role,
  onLogout,
  onNavigateToProfile,
  onSignInClick,
}) => {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState<ProfileSection>('general')
  const { updateUser, signOut } = useAuth()
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isEditingGeneral, setIsEditingGeneral] = useState(false)
  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<{ oldPassword?: string; newPassword?: string; confirmPassword?: string }>({})
  const [isPasswordSubmitted, setIsPasswordSubmitted] = useState(false)
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [currentEmailPassword, setCurrentEmailPassword] = useState('')
  const [emailErrors, setEmailErrors] = useState<{ newEmail?: string; currentPassword?: string }>({})
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationCodeError, setVerificationCodeError] = useState<string | undefined>()
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false)
  const [isResendingEmailCode, setIsResendingEmailCode] = useState(false)
  const [resendEmailCodeMessage, setResendEmailCodeMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      if (!user?.email) return

      setIsProfileLoading(true)
      try {
        const response = await profileService.getProfile()
        if (!isMounted || !response.data?.user) return

        const nextUser = { ...user, ...response.data.user }
        const hasProfileChanges =
          nextUser.email !== user.email ||
          nextUser.firstName !== user.firstName ||
          nextUser.lastName !== user.lastName ||
          nextUser.role !== user.role

        if (hasProfileChanges) updateUser(nextUser)
      } catch {
        if (!isMounted) return
      } finally {
        if (isMounted) setIsProfileLoading(false)
      }
    }

    void loadProfile()

    return () => {
      isMounted = false
    }
  }, [user?.email])

  const validateNames = (values = { firstName, lastName }) => {
    const nextErrors: { firstName?: string; lastName?: string } = {}
    if (!isValidName(values.firstName)) nextErrors.firstName = ERROR_MESSAGES.firstName
    if (!isValidName(values.lastName)) nextErrors.lastName = ERROR_MESSAGES.lastName
    return nextErrors
  }

  const startEditingGeneral = () => {
    setFirstName(user?.firstName ?? '')
    setLastName(user?.lastName ?? '')
    setErrors({})
    setIsEditingGeneral(true)
  }

  const cancelEditingGeneral = () => {
    setErrors({})
    setIsEditingGeneral(false)
  }

  const handleNameChange = (field: 'firstName' | 'lastName', value: string) => {
    const values = { firstName, lastName, [field]: value }
    if (field === 'firstName') setFirstName(value)
    else setLastName(value)

    if (value.trim().length > 0 || errors[field]) {
      setErrors(validateNames(values))
    }
  }

  const handleGeneralSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateNames()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await profileService.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() })
      if (!response.data?.user) throw new Error('Unable to update your account. Please try again.')
      updateUser({ ...user, ...response.data.user })
      setIsEditingGeneral(false)
      setToastType('success')
      setToastMessage('Your account has been updated successfully')
    } catch (error: unknown) {
      setToastType('error')
      setToastMessage(error instanceof Error ? error.message : 'Unable to update your account. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isSaveDisabled =
    !firstName.trim() ||
    !lastName.trim() ||
    !isValidName(firstName) ||
    !isValidName(lastName) ||
    isSubmitting ||
    (firstName.trim() === (user?.firstName ?? '') && lastName.trim() === (user?.lastName ?? ''))

  const passwordChecks = getPasswordChecks(newPassword)
  const isConfirmPasswordMatch = confirmPassword.length > 0 && confirmPassword === newPassword
  const isPasswordSaveDisabled = !oldPassword || !newPassword || !confirmPassword || isPasswordSubmitting

  const handlePasswordFieldChange = (field: 'oldPassword' | 'newPassword' | 'confirmPassword', value: string) => {
    const values = { oldPassword, newPassword, confirmPassword, [field]: value }

    if (field === 'oldPassword') setOldPassword(value)
    if (field === 'newPassword') setNewPassword(value)
    if (field === 'confirmPassword') setConfirmPassword(value)

    if (isPasswordSubmitted || passwordErrors[field]) {
      const validationErrors = validateResetPasswordForm(values)
      setPasswordErrors((current) => ({
        ...current,
        [field]: field === 'oldPassword' ? undefined : validationErrors[field],
        ...(field === 'newPassword' ? { confirmPassword: validationErrors.confirmPassword } : {}),
      }))
    }
  }

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsPasswordSubmitted(true)

    const validationErrors = validateResetPasswordForm({ newPassword, confirmPassword })
    if (isPasswordSaveDisabled || Object.keys(validationErrors).length > 0) {
      setPasswordErrors(validationErrors)
      return
    }

    setIsPasswordSubmitting(true)
    setPasswordErrors({})
    try {
      await profileService.changePassword({ oldPassword, newPassword })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setIsPasswordSubmitted(false)
      setToastType('success')
      setToastMessage('Your password has been updated successfully')
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        setPasswordErrors({ oldPassword: 'Old password is incorrect, please enter the correct one' })
      } else {
        setToastType('error')
        setToastMessage(error instanceof Error ? error.message : 'Unable to update your password. Please try again.')
      }
    } finally {
      setIsPasswordSubmitting(false)
    }
  }

  const handleNewEmailChange = (value: string) => {
    setNewEmail(value)
    if (emailErrors.newEmail) {
      setEmailErrors((current) => ({
        ...current,
        newEmail: validateChangeEmailForm({ newEmail: value, currentPassword: currentEmailPassword }, user?.email ?? '').newEmail,
      }))
    }
  }

  const handleCurrentEmailPasswordChange = (value: string) => {
    setCurrentEmailPassword(value)
    if (emailErrors.currentPassword) {
      setEmailErrors((current) => ({
        ...current,
        currentPassword: validateChangeEmailForm({ newEmail, currentPassword: value }, user?.email ?? '').currentPassword,
      }))
    }
  }

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationErrors = validateChangeEmailForm({ newEmail, currentPassword: currentEmailPassword }, user?.email ?? '')
    setEmailErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0 || isEmailSubmitting) return

    setIsEmailSubmitting(true)
    try {
      const response = await profileService.initiateEmailChange({
        newEmail: normalizeEmail(newEmail),
        currentPassword: currentEmailPassword,
      })
      setPendingEmail(response.data?.pendingEmail ?? normalizeEmail(newEmail))
      setCurrentEmailPassword('')
      setVerificationCode('')
      setVerificationCodeError(undefined)
      setResendEmailCodeMessage(null)
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        setEmailErrors({
          newEmail: EMAIL_CHANGE_CREDENTIALS_ERROR,
          currentPassword: EMAIL_CHANGE_CREDENTIALS_ERROR,
        })
        return
      }

      const field = getEmailChangeErrorField(error)
      const message = field === 'newEmail' && error instanceof ApiError && error.message === 'Email address is already in use'
        ? 'This email is already in use, please choose different one'
        : error instanceof Error ? error.message : 'Unable to change email. Please try again.'

      if (field) {
        setEmailErrors((current) => ({ ...current, [field]: message }))
      } else {
        setToastType('error')
        setToastMessage(message)
      }
    } finally {
      setIsEmailSubmitting(false)
    }
  }

  const isEmailSaveDisabled = !newEmail.trim() || !currentEmailPassword || isEmailSubmitting

  const handleEmailVerificationSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = verificationCode.trim()
    if (!code || isVerifyingEmail) {
      if (!code) setVerificationCodeError('Verification code is required')
      return
    }

    setIsVerifyingEmail(true)
    setVerificationCodeError(undefined)
    try {
      await profileService.confirmEmailChange({ code })
      sessionStorage.setItem(EMAIL_CHANGE_SUCCESS_TOAST_KEY, 'Your email has been changed successfully')
      await signOut()
      navigate(PATHS.LOGIN, {
        replace: true,
        state: { toastMessage: 'Your email has been changed successfully' },
      })
    } catch (error: unknown) {
      setVerificationCodeError(
        error instanceof ApiError && error.code === 'INVALID_CONFIRMATION_CODE'
          ? 'You have entered a wrong code, please insert the correct one'
          : error instanceof Error ? error.message : 'Unable to verify the code. Please try again.'
      )
    } finally {
      setIsVerifyingEmail(false)
    }
  }

  const handleResendEmailCode = async (): Promise<boolean> => {
    if (isResendingEmailCode) return false

    setIsResendingEmailCode(true)
    setResendEmailCodeMessage(null)
    try {
      const response = await profileService.resendEmailChangeCode()
      setResendEmailCodeMessage(response.data?.message ?? 'A new verification code has been sent.')
      return true
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to resend the code. Please try again.'
      setResendEmailCodeMessage(message)
      setToastType('error')
      setToastMessage(message)
      return false
    } finally {
      setIsResendingEmailCode(false)
    }
  }

  const handleSectionChange = (section: ProfileSection) => {
    setActiveSection(section)
  }

  return (
    <div className="profile-page">
      {toastMessage && <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage(null)} />}
      <Header
        activeTab={undefined}
        user={user}
        role={role}
        onLogout={onLogout}
        onNavigateToProfile={onNavigateToProfile}
        onSignInClick={onSignInClick}
        onTabChange={(tab) => {
          if (tab === 'main') {
            navigate(PATHS.DASHBOARD)
          } else if (tab === 'tours') {
            const isAgent = role === 'Travel Agent' || user?.role === 'Travel Agent'
            navigate(`${PATHS.DASHBOARD}?tab=${isAgent ? 'bookings' : 'my-tours'}`)
          }
        }}
      />

      <main className="profile-page__content">
        {isProfileLoading && <p className="profile-page__loading" role="status">Loading profile...</p>}
        <h1 className="profile-page__title">My profile</h1>
        <div className="profile-page__workspace">
          <nav className="profile-page__navigation" aria-label="Profile settings">
            {sections.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`profile-page__nav-item ${activeSection === id ? 'profile-page__nav-item--active' : ''}`}
                onClick={() => handleSectionChange(id)}
                aria-current={activeSection === id ? 'page' : undefined}
              >
                {label}
              </button>
            ))}
          </nav>

          <section className="profile-page__panel" aria-labelledby="profile-section-title">
            {activeSection === 'general' && (
              <>
                <div className="profile-page__panel-heading">
                  <h2 id="profile-section-title">General information</h2>
                  <button className="profile-page__edit-button" type="button" aria-label="Edit general information" onClick={startEditingGeneral}>
                    <img src={editIcon} alt="" aria-hidden="true" />
                  </button>
                </div>
                <div className="profile-page__general-body">
                  <div className="profile-page__avatar-wrap" aria-label="Profile photo placeholder">
                    <svg className="profile-page__avatar-icon" viewBox="0 0 64 64" aria-hidden="true">
                      <circle cx="32" cy="23" r="10" />
                      <path d="M14 53c0-10 8.1-18 18-18s18 8 18 18" />
                    </svg>
                    <button className="profile-page__upload-button" type="button" aria-label="Upload profile photo">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
                        <circle cx="12" cy="13" r="3.5" />
                      </svg>
                    </button>
                  </div>
                  {isEditingGeneral ? (
                    <form className="profile-page__edit-form" onSubmit={handleGeneralSubmit} noValidate>
                      <InputField
                        label="First name"
                        name="firstName"
                        placeholder="Enter your first name"
                        helperText="e.g. John"
                        value={firstName}
                        onChange={(event) => handleNameChange('firstName', event.target.value)}
                        error={errors.firstName}
                        maxLength={50}
                      />
                      <InputField
                        label="Last name"
                        name="lastName"
                        placeholder="Enter your last name"
                        helperText="e.g. Doe"
                        value={lastName}
                        onChange={(event) => handleNameChange('lastName', event.target.value)}
                        error={errors.lastName}
                        maxLength={50}
                      />
                      <div className="profile-page__edit-actions">
                        <Button type="button" variant="outline" fullWidth={false} onClick={cancelEditingGeneral} disabled={isSubmitting}>
                          Cancel
                        </Button>
                        <Button type="submit" fullWidth={false} disabled={isSaveDisabled} isLoading={isSubmitting} loadingText="Saving">
                          Save changes
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <dl className="profile-page__details">
                      <div>
                        <dt>First name</dt>
                        <dd>{user?.firstName || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt>Last name</dt>
                        <dd>{user?.lastName || 'Not provided'}</dd>
                      </div>
                    </dl>
                  )}
                </div>
              </>
            )}
            {activeSection === 'password' && (
              <>
                <h2 id="profile-section-title">Change password</h2>
                <form className="profile-page__password-form" onSubmit={handlePasswordSubmit} noValidate>
                  <PasswordInput
                    label="Old password"
                    name="oldPassword"
                    placeholder="Enter your password"
                    value={oldPassword}
                    onChange={(event) => handlePasswordFieldChange('oldPassword', event.target.value)}
                    error={passwordErrors.oldPassword}
                    maxLength={MAX_PASSWORD_LENGTH}
                  />
                  <div className="profile-page__password-group">
                    <PasswordInput
                      label="New password"
                      name="newPassword"
                      placeholder="Enter your new password"
                      value={newPassword}
                      onChange={(event) => handlePasswordFieldChange('newPassword', event.target.value)}
                      error={passwordErrors.newPassword}
                      maxLength={MAX_PASSWORD_LENGTH}
                    />
                    <PasswordRequirementsList password={newPassword} checks={passwordChecks} isSubmitted={isPasswordSubmitted} />
                  </div>
                  <div className="profile-page__password-group">
                    <PasswordInput
                      label="Confirm password"
                      name="confirmPassword"
                      placeholder="Confirm your new password"
                      value={confirmPassword}
                      onChange={(event) => handlePasswordFieldChange('confirmPassword', event.target.value)}
                      error={passwordErrors.confirmPassword}
                      maxLength={MAX_PASSWORD_LENGTH}
                    />
                    <ul className="password-requirements-list">
                      <li className={`req-item ${confirmPassword ? (isConfirmPasswordMatch ? 'valid' : isPasswordSubmitted ? 'invalid' : '') : ''}`}>
                        <span className="req-bullet" />
                        Confirm password must match new password
                      </li>
                    </ul>
                  </div>
                  <div className="profile-page__password-actions">
                    <Button type="submit" fullWidth={false} disabled={isPasswordSaveDisabled} isLoading={isPasswordSubmitting} loadingText="Saving">
                      Save changes
                    </Button>
                  </div>
                </form>
              </>
            )}
            {activeSection === 'email' && (
              <>
                <h2 id="profile-section-title">Change email</h2>
                {pendingEmail ? (
                  <EmailVerificationFields
                    email={pendingEmail}
                    code={verificationCode}
                    codeError={verificationCodeError}
                    isVerifying={isVerifyingEmail}
                    isResending={isResendingEmailCode}
                    resendMessage={resendEmailCodeMessage}
                    onCodeChange={(value) => {
                      setVerificationCode(value)
                      if (verificationCodeError) setVerificationCodeError(undefined)
                    }}
                    onSubmit={handleEmailVerificationSubmit}
                    onResend={handleResendEmailCode}
                  />
                ) : (
                  <form className="profile-page__email-form" onSubmit={handleEmailSubmit} noValidate>
                    <div className="profile-page__current-email">
                      <span className="profile-page__current-email-label">Current email:</span>
                      <span className="profile-page__current-email-value">{user?.email ?? ''}</span>
                    </div>
                    <InputField label="New email" name="newEmail" type="email" autoComplete="email" placeholder="Enter your new email" helperText="e.g. username@domain.com" value={newEmail} onChange={(event) => handleNewEmailChange(event.target.value)} error={emailErrors.newEmail} maxLength={MAX_EMAIL_LENGTH} />
                    <PasswordInput label="Current password" name="currentEmailPassword" autoComplete="current-password" placeholder="Enter your current password" value={currentEmailPassword} onChange={(event) => handleCurrentEmailPasswordChange(event.target.value)} error={emailErrors.currentPassword} maxLength={MAX_PASSWORD_LENGTH} />
                    <div className="profile-page__email-actions">
                      <Button type="submit" fullWidth={false} disabled={isEmailSaveDisabled} isLoading={isEmailSubmitting} loadingText="Confirming">Confirm</Button>
                    </div>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
