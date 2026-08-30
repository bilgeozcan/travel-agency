import { apiClient } from '../client/apiClient'
import type { ApiResponse } from '../types/api.types'
import type { RegisterRequest, RegisterResponseData, LoginRequest, LoginResponseData, ForgotPasswordRequest, ForgotPasswordResponseData, VerifyResetCodeRequest, VerifyResetCodeResponseData, ResetPasswordRequest, ResetPasswordResponseData } from '../types/auth.types'
import { normalizeEmail } from '../../utils/validation'
import type { AuthenticatedUser, AuthSession } from '@/features/auth/types/auth'

const isLoginResponseData = (value: unknown): value is LoginResponseData => {
  if (!value || typeof value !== 'object') return false

  const response = value as Record<string, unknown>
  const hasAccessToken =
    (typeof response.accessToken === 'string' && response.accessToken.length > 0) ||
    (typeof response.token === 'string' && response.token.length > 0)

  if (!hasAccessToken) return false

  if (
    typeof response.expiresIn !== 'number' ||
    !Number.isFinite(response.expiresIn) ||
    response.expiresIn <= 0
  ) {
    return false
  }

  return true
}

const isAuthenticatedUser = (value: unknown): value is AuthenticatedUser => {
  if (!value || typeof value !== 'object') return false

  const user = value as Record<string, unknown>
  return (
    typeof user.email === 'string' &&
    user.email.trim().length > 0 &&
    (user.firstName === undefined || typeof user.firstName === 'string') &&
    (user.lastName === undefined || typeof user.lastName === 'string')
  )
}

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(payloadBase64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload) as Record<string, unknown>
  } catch {
    return null
  }
}

const extractUserFromToken = (token?: string): Partial<AuthenticatedUser> => {
  if (!token) return {}
  const claims = decodeJwtPayload(token)
  if (!claims) return {}

  const extracted: Partial<AuthenticatedUser> = {}

  if (typeof claims.email === 'string' && claims.email.trim()) {
    extracted.email = claims.email.trim()
  } else if (typeof claims.username === 'string' && claims.username.includes('@')) {
    extracted.email = claims.username.trim()
  }

  if (typeof claims.sub === 'string' && claims.sub.trim()) {
    extracted.id = claims.sub.trim()
  }

  if (typeof claims.given_name === 'string' && claims.given_name.trim()) {
    extracted.firstName = claims.given_name.trim()
  }
  if (typeof claims.family_name === 'string' && claims.family_name.trim()) {
    extracted.lastName = claims.family_name.trim()
  }

  if (typeof claims['custom:role'] === 'string' && claims['custom:role'].trim()) {
    extracted.role = claims['custom:role'].trim()
  } else if (typeof claims.role === 'string' && claims.role.trim()) {
    extracted.role = claims.role.trim()
  } else if (claims['cognito:groups']) {
    const rawGroups = claims['cognito:groups']
    if (Array.isArray(rawGroups) && rawGroups.length > 0) {
      extracted.role = String(rawGroups[0]).trim()
    } else if (typeof rawGroups === 'string' && rawGroups.trim()) {
      const cleaned = rawGroups.replace(/[\[\]'"\s]/g, '')
      if (cleaned) {
        extracted.role = cleaned.split(',')[0]
      }
    }
  }

  return extracted
}

class AuthService {
  private session: AuthSession | null = null
  private refreshPromise: Promise<AuthSession | null> | null = null

  constructor() {
    apiClient.setRefreshHandler(async () => {
      const refreshedSession = await this.refreshSession()
      return !!refreshedSession
    })
  }

  /**
   * Registers a new user account against live AWS API Gateway (/auth/sign-up)
   */
  public async register(payload: RegisterRequest): Promise<ApiResponse<RegisterResponseData>> {
    const formattedPayload: RegisterRequest = {
      ...payload,
      email: normalizeEmail(payload.email),
    }

    return apiClient.post<RegisterResponseData>('/auth/sign-up', formattedPayload)
  }

  /**
   * Authenticates user with email and password against live AWS API Gateway (/auth/sign-in)
   */
  public async login(payload: LoginRequest): Promise<AuthSession> {
    const formattedPayload: LoginRequest = {
      ...payload,
      email: normalizeEmail(payload.email),
    }

    const response = await apiClient.post<LoginResponseData>('/auth/sign-in', formattedPayload)
    if (!response.success || !response.data || !isLoginResponseData(response.data)) {
      throw new Error('The sign-in response was invalid. Please try again.')
    }

    // Protected API requests must use the Cognito access token. The ID
    // token is retained only for identity/profile claims.
    const rawToken = response.data.accessToken || response.data.token || ''

    let firstName = response.data.user?.firstName
    let lastName = response.data.user?.lastName

    if (!firstName && !lastName && response.data.userName) {
      const parts = response.data.userName.trim().split(' ')
      firstName = parts[0]
      lastName = parts.slice(1).join(' ') || undefined
    }

    const role = response.data.user?.role || response.data.role

    const tokenClaims = {
      ...extractUserFromToken(response.data.idToken),
      ...extractUserFromToken(response.data.token),
      ...extractUserFromToken(response.data.accessToken),
    }

    const user: AuthenticatedUser = {
      id: response.data.user?.id || tokenClaims.id,
      email: response.data.user?.email || response.data.email || formattedPayload.email || tokenClaims.email || '',
      firstName: firstName || tokenClaims.firstName,
      lastName: lastName || tokenClaims.lastName,
      role: role || tokenClaims.role,
    }

    const decodedPayload = decodeJwtPayload(rawToken)
    let expSeconds = 3600 // Default 1 hour fallback
    if (decodedPayload && typeof decodedPayload.exp === 'number') {
      expSeconds = decodedPayload.exp - Math.floor(Date.now() / 1000)
    } else if (typeof response.data.expiresIn === 'number' && response.data.expiresIn > 0) {
      expSeconds = response.data.expiresIn
    }

    const session: AuthSession = {
      accessToken: rawToken,
      expiresAt: Date.now() + Math.max(expSeconds, 3600) * 1000,
      user,
    }

    this.saveSession(session)
    return session
  }

  /**
   * Obtains a new access token using the secure HttpOnly refresh cookie (/auth/refresh).
   * Prevents multiple concurrent refresh calls by returning an inflight Promise.
   */
  public async refreshSession(): Promise<AuthSession | null> {
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = (async () => {
      try {
        const response = await apiClient.post<LoginResponseData>('/auth/refresh', {})

        if (!response.success || !response.data || !isLoginResponseData(response.data)) {
          if (this.session && this.session.expiresAt && this.session.expiresAt > Date.now()) {
            return this.session
          }
          this.clearSession()
          return null
        }

        const rawToken = response.data.accessToken || response.data.token || ''

        const expiresInSeconds =
          typeof response.data.expiresIn === 'number' && Number.isFinite(response.data.expiresIn)
            ? response.data.expiresIn
            : 3600

        const tokenClaims = extractUserFromToken(rawToken)
        const idTokenClaims = extractUserFromToken(response.data.idToken)
        const combinedClaims = { ...tokenClaims, ...idTokenClaims }

        let firstName = response.data.user?.firstName || this.session?.user.firstName
        let lastName = response.data.user?.lastName || this.session?.user.lastName

        if (!firstName && !lastName && response.data.userName) {
          const parts = response.data.userName.trim().split(' ')
          firstName = parts[0]
          lastName = parts.slice(1).join(' ') || undefined
        }

        const email =
          response.data.user?.email ||
          response.data.email ||
          this.session?.user.email ||
          combinedClaims.email ||
          ''

        const id =
          response.data.user?.id ||
          this.session?.user.id ||
          combinedClaims.id

        const role =
          response.data.user?.role ||
          response.data.role ||
          this.session?.user.role ||
          combinedClaims.role

        const user: AuthenticatedUser = {
          id,
          email,
          firstName: firstName || combinedClaims.firstName,
          lastName: lastName || combinedClaims.lastName,
          role,
        }

        const session: AuthSession = {
          accessToken: rawToken,
          expiresAt: Date.now() + expiresInSeconds * 1000,
          user,
        }

        this.saveSession(session)
        return session
      } catch {
        if (this.session && this.session.expiresAt && this.session.expiresAt > Date.now()) {
          return this.session
        }
        this.clearSession()
        return null
      } finally {
        this.refreshPromise = null
      }
    })()

    return this.refreshPromise
  }

  /**
   * Signs out the user by calling POST /auth/sign-out and clearing local in-memory session.
   */
  public async signOut(): Promise<void> {
    try {
      await apiClient.post('/auth/sign-out', {})
    } catch {
      // Swallowed intentionally: the user must still be treated as logged out
      // when the backend session has already expired or returns 401 unauthorized.
    } finally {
      this.clearSession()
    }
  }

  /**
   * Checks if an email is already registered against live AWS API Gateway (/auth/check-email)
   */
  public async checkEmailExists(email: string): Promise<boolean> {
    const response = await apiClient.get<{ exists: boolean }>('/auth/check-email', {
      params: { email: normalizeEmail(email) },
    })
    return !!response.data?.exists
  }

  /**
   * Initiates password recovery request for the provided email address (/auth/forgot-password)
   */
  public async requestPasswordReset(email: string): Promise<ApiResponse<ForgotPasswordResponseData>> {
    const formattedEmail = normalizeEmail(email)
    const payload: ForgotPasswordRequest = { email: formattedEmail }
    return apiClient.post<ForgotPasswordResponseData>('/auth/forgot-password', payload)
  }

  /**
   * Verifies the password reset code sent to the user's email (/auth/confirm-forgot-password)
   */
  public async verifyResetCode(email: string, code: string): Promise<ApiResponse<VerifyResetCodeResponseData>> {
    const formattedEmail = normalizeEmail(email)
    const payload: VerifyResetCodeRequest = { email: formattedEmail, code: code.trim() }
    return apiClient.post<VerifyResetCodeResponseData>('/auth/confirm-forgot-password', payload)
  }

  /**
   * Resets user password using email, confirmation code, and new password (/auth/confirm-forgot-password)
   */
  public async resetPassword(
    email: string,
    confirmationCode: string,
    newPassword: string
  ): Promise<ApiResponse<ResetPasswordResponseData>> {
    const formattedEmail = normalizeEmail(email)
    const payload: ResetPasswordRequest = {
      email: formattedEmail,
      confirmationCode: confirmationCode.trim(),
      newPassword,
    }
    return apiClient.post<ResetPasswordResponseData>('/auth/confirm-forgot-password', payload)
  }

  private readonly SESSION_STORAGE_KEY = 'auth_session'

  /**
   * Persists session in memory and localStorage so page reloads maintain authentication.
   */
  public saveSession(session: AuthSession): void {
    apiClient.setAuthToken(session.accessToken)
    this.session = session
    try {
      localStorage.setItem(this.SESSION_STORAGE_KEY, JSON.stringify(session))
    } catch {
      // Ignore storage errors if localStorage is disabled
    }
  }

  public getSession(): AuthSession | null {
    if (!this.session) {
      try {
        const saved = localStorage.getItem(this.SESSION_STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved) as AuthSession
          if (parsed && typeof parsed === 'object' && parsed.accessToken) {
            const tokenUser = extractUserFromToken(parsed.accessToken)
            let validEmail = ''
            if (parsed.user.email && parsed.user.email.includes('@')) {
              validEmail = parsed.user.email
            } else if (tokenUser.email && tokenUser.email.includes('@')) {
              validEmail = tokenUser.email
            }
            parsed.user = {
              ...parsed.user,
              id: parsed.user.id || tokenUser.id,
              email: validEmail,
              role: tokenUser.role || parsed.user.role,
            }
            this.session = parsed
          }
        }
      } catch {
        this.clearSession()
      }
    }

    if (!this.session || !isAuthenticatedUser(this.session.user)) {
      this.clearSession()
      return null
    }

    // Check expiration (if token is still valid within grace period, keep session)
    if (this.session.expiresAt && this.session.expiresAt <= Date.now()) {
      // Session expired
      this.clearSession()
      return null
    }

    apiClient.setAuthToken(this.session.accessToken)
    return this.session
  }

  public clearSession(): void {
    apiClient.setAuthToken(null)
    this.session = null
    try {
      localStorage.removeItem(this.SESSION_STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
  }
}

export const authService = new AuthService()
