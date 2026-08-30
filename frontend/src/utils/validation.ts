export const NAME_REGEX = /^[a-zA-Z' -]{1,50}$/
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
export const MAX_EMAIL_LENGTH = 254
export const MAX_NAME_LENGTH = 50
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 64

// List of commonly breached passwords for security validation
export const COMMON_BREACHED_PASSWORDS = new Set([
  'password123',
  '12345678',
  '123456789',
  'qwerty123',
  'password123!',
  'admin1234',
  'welcome123',
  'letmein123',
  'password!1',
  'P@ssword1',
  'Password123!',
  'Admin1234!',
])

export interface PasswordChecks {
  hasUpper: boolean
  hasLower: boolean
  hasNumber: boolean
  hasSpecial: boolean
  validLength: boolean
  isNotBreached: boolean
}

export const getPasswordChecks = (password: string): PasswordChecks => ({
  hasUpper: /[A-Z]/.test(password),
  hasLower: /[a-z]/.test(password),
  hasNumber: /[0-9]/.test(password),
  hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  validLength: password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH,
  isNotBreached: !COMMON_BREACHED_PASSWORDS.has(password.toLowerCase()),
})

export const isValidName = (value: string): boolean => {
  return NAME_REGEX.test(value.trim())
}

export const isValidEmail = (value: string): boolean => {
  return value.length <= MAX_EMAIL_LENGTH && EMAIL_REGEX.test(value.trim())
}

export const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase()
}

export const isPasswordValid = (checks: PasswordChecks): boolean => {
  return (
    checks.hasUpper &&
    checks.hasLower &&
    checks.hasNumber &&
    checks.hasSpecial &&
    checks.validLength &&
    checks.isNotBreached
  )
}

export const getPasswordError = (checks: PasswordChecks): string | undefined => {
  if (!checks.validLength) return 'Password must be 8-64 characters long'
  if (!checks.hasUpper) return 'At least one uppercase letter required'
  if (!checks.hasLower) return 'At least one lowercase letter required'
  if (!checks.hasNumber) return 'At least one number required'
  if (!checks.hasSpecial) return 'At least one special character required'
  if (!checks.isNotBreached) return 'This password is too common or breached. Please choose a stronger password'
  return undefined
}

export interface RegisterFormData {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
}

export interface RegisterFormErrors {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
  confirmPassword?: string
}

export const validateRegisterForm = (data: RegisterFormData): RegisterFormErrors => {
  const errors: RegisterFormErrors = {}

  if (!isValidName(data.firstName)) {
    errors.firstName = ERROR_MESSAGES.firstName
  }

  if (!isValidName(data.lastName)) {
    errors.lastName = ERROR_MESSAGES.lastName
  }

  if (!isValidEmail(data.email)) {
    errors.email = ERROR_MESSAGES.email
  }

  const passwordChecks = getPasswordChecks(data.password)
  const passwordError = getPasswordError(passwordChecks)
  if (passwordError) {
    errors.password = passwordError
  }

  if (data.confirmPassword !== data.password) {
    errors.confirmPassword = ERROR_MESSAGES.confirmPassword
  }

  return errors
}

export interface ChangeEmailFormData {
  newEmail: string
  currentPassword: string
}

export interface ChangeEmailFormErrors {
  newEmail?: string
  currentPassword?: string
}

export const validateChangeEmailForm = (
  data: ChangeEmailFormData,
  currentEmail: string
): ChangeEmailFormErrors => {
  const errors: ChangeEmailFormErrors = {}

  if (!isValidEmail(data.newEmail)) {
    errors.newEmail = ERROR_MESSAGES.email
  } else if (normalizeEmail(data.newEmail) === normalizeEmail(currentEmail)) {
    errors.newEmail = ERROR_MESSAGES.newEmailMustDiffer
  }

  if (!data.currentPassword) {
    errors.currentPassword = ERROR_MESSAGES.currentPasswordRequired
  }

  return errors
}

export interface ResetPasswordFormData {
  newPassword: string
  confirmPassword: string
}

export interface ResetPasswordFormErrors {
  newPassword?: string
  confirmPassword?: string
}

export const validateResetPasswordForm = (data: ResetPasswordFormData): ResetPasswordFormErrors => {
  const errors: ResetPasswordFormErrors = {}
  const passwordChecks = getPasswordChecks(data.newPassword)
  const passwordError = getPasswordError(passwordChecks)
  if (passwordError) {
    errors.newPassword = passwordError
  }
  if (data.confirmPassword !== data.newPassword) {
    errors.confirmPassword = ERROR_MESSAGES.confirmPassword
  }
  return errors
}

export const ERROR_MESSAGES = {
  firstName: 'First name must be up to 50 characters. Only Latin letters hyphens and apostrophes are allowed',
  lastName: 'Last name must be up to 50 characters. Only Latin letters hyphens and apostrophes are allowed',
  email: 'Invalid email address. Please ensure it follows the format: username@domain.com',
  newEmailMustDiffer: 'New email must differ from current email',
  currentPasswordRequired: 'Current password is required',
  passwordBreached: 'This password is too common or breached. Please choose a stronger password',
  confirmPassword: 'Confirm password must match new password',
  successRegistration: 'Congratulations. Your account has been created successfully. Please sign in with your details',
  successResetPassword: 'Your password has been successfully changed.',
  incorrectCredentials: 'Incorrect email or password. Try again or create an account.',
  invalidDateFormat: 'Invalid date format',
  endDateBeforeStartDate: 'End date cannot be before start date',
} as const
