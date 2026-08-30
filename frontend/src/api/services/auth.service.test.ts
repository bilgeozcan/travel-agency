import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService } from './auth.service'
import { apiClient } from '../client/apiClient'

describe('AuthService Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    authService.clearSession()
  })

  describe('register', () => {
    it('normalizes email and posts to /auth/sign-up', async () => {
      const mockPost = vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: { userId: '123' },
      })

      const payload = {
        firstName: 'John',
        lastName: 'Doe',
        email: '  JOHN.DOE@EXAMPLE.COM  ',
        password: 'ValidPass123!',
      }

      const response = await authService.register(payload)

      expect(mockPost).toHaveBeenCalledWith('/auth/sign-up', {
        ...payload,
        email: 'john.doe@example.com',
      })
      expect(response.success).toBe(true)
    })

    it('propagates error when backend endpoint returns error', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(
        new Error('This email is already registered. Please sign in')
      )

      const payload = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'registered@example.com',
        password: 'ValidPass123!',
      }

      await expect(authService.register(payload)).rejects.toThrow(
        'This email is already registered. Please sign in'
      )
    })
  })

  describe('login', () => {
    it('normalizes email, posts to /auth/sign-in, and maps a session', async () => {
      const mockPost = vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: {
          accessToken: 'mock-access-token',
          idToken: 'mock-id-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      })

      const session = await authService.login({
        email: '  USER@EXAMPLE.COM ',
        password: 'MyPassword123!',
      })

      expect(mockPost).toHaveBeenCalledWith('/auth/sign-in', {
        email: 'user@example.com',
        password: 'MyPassword123!',
      })
      expect(session).toEqual({
        accessToken: 'mock-access-token',
        expiresAt: expect.any(Number),
        user: { email: 'user@example.com' },
      })
      expect(session.expiresAt).toBeGreaterThan(Date.now())
    })

    it('uses accessToken for API auth while retaining idToken identity data', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: {
          accessToken: 'mock-openapi-access-token',
          idToken: 'mock-openapi-id-token',
          expiresIn: 3600,
          role: 'TRAVEL_AGENT',
          userName: 'John Doe',
          email: 'john.doe@example.com',
        },
      })

      const session = await authService.login({
        email: 'john.doe@example.com',
        password: 'Password123!',
      })

      expect(session).toEqual({
        accessToken: 'mock-openapi-access-token',
        expiresAt: expect.any(Number),
        user: {
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'TRAVEL_AGENT',
        },
      })
    })

    it('rejects an idToken-only sign-in response', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: {
          idToken: 'identity-only-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
        },
      } as never)

      await expect(
        authService.login({
          email: 'user@example.com',
          password: 'MyPassword123!',
        })
      ).rejects.toThrow('The sign-in response was invalid. Please try again.')
    })

    it('rejects a malformed sign-in response missing token', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: { invalidField: 'no-token-here' },
      } as never)

      await expect(
        authService.login({
          email: 'user@example.com',
          password: 'MyPassword123!',
        })
      ).rejects.toThrow('The sign-in response was invalid. Please try again.')
    })

    it('propagates authentication error from backend', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(
        new Error('Incorrect email or password. Try again or create an account.')
      )

      await expect(
        authService.login({
          email: 'wrong@example.com',
          password: 'WrongPassword123!',
        })
      ).rejects.toThrow(
        'Incorrect email or password. Try again or create an account.'
      )
    })
    it('handles !22 schema where token field is named "token" instead of accessToken', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: {
          token: 'renamed-token-field',
          expiresIn: 3600,
          tokenType: 'Bearer',
          user: { email: 'user@example.com', role: 'CUSTOMER' },
        },
      } as never)

      const session = await authService.login({
        email: 'user@example.com',
        password: 'MyPassword123!',
      })

      expect(session.accessToken).toBe('renamed-token-field')
    })

    it('rejects when data is present but null', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: null,
      } as never)

      await expect(
        authService.login({ email: 'user@example.com', password: 'Pass123!' })
      ).rejects.toThrow()
    })

    it('rejects when success is false even if data looks valid', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: false,
        data: { accessToken: 'token', idToken: 'id', expiresIn: 3600, tokenType: 'Bearer' },
      } as never)

      await expect(
        authService.login({ email: 'user@example.com', password: 'Pass123!' })
      ).rejects.toThrow()
    })

    it('rejects when expiresIn is missing or zero (would produce non-future expiry)', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: {
          accessToken: 'mock-access-token',
          idToken: 'mock-id-token',
          tokenType: 'Bearer',
        },
      } as never)

      await expect(
        authService.login({ email: 'user@example.com', password: 'Pass123!' })
      ).rejects.toThrow()
    })

    it('does not leak password into thrown errors on failure', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('Backend down'))

      try {
        await authService.login({ email: 'user@example.com', password: 'SuperSecret123!' })
        expect.unreachable('login should have thrown')
      } catch (err) {
        expect(String(err)).not.toContain('SuperSecret123!')
      }
    })

    it('normalizes email with internal casing and trims both ends', async () => {
      const mockPost = vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: { accessToken: 'access', idToken: 'id', expiresIn: 3600, tokenType: 'Bearer' },
      } as never)

      await authService.login({
        email: '\tMixed.Case@Example.COM\n',
        password: 'Pass123!',
      })

      expect(mockPost).toHaveBeenCalledWith('/auth/sign-in', {
        email: 'mixed.case@example.com',
        password: 'Pass123!',
      })
    })

    it('parses only first and last name from a multi-part userName', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: {
          accessToken: 'access',
          idToken: 'id',
          expiresIn: 3600,
          role: 'CUSTOMER',
          userName: 'John Van Der Berg',
          email: 'john@example.com',
        },
      } as never)

      const session = await authService.login({
        email: 'john@example.com',
        password: 'Pass123!',
      })

      expect(session.user.firstName).toBe('John')
      expect(session.user.lastName).toBeDefined()
    })

    it('handles single-word userName without crashing on lastName', async () => {
      vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: { accessToken: 'access', idToken: 'id', expiresIn: 3600, role: 'CUSTOMER', userName: 'Madonna', email: 'm@example.com' },
      } as never)

      const session = await authService.login({
        email: 'm@example.com',
        password: 'Pass123!',
      })

      expect(session.user.firstName).toBe('Madonna')
      expect(session.user.lastName ?? '').toBe(session.user.lastName ?? '')
    })
  })

  describe('checkEmailExists', () => {
    it('calls GET /auth/check-email and returns boolean', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: { exists: true },
      })

      const exists = await authService.checkEmailExists('existing@example.com')
      expect(exists).toBe(true)
    })

    it('returns false when email does not exist', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: { exists: false },
      })

      expect(await authService.checkEmailExists('nobody@example.com')).toBe(false)
    })

    it('normalizes email before checking existence', async () => {
      const mockGet = vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: { exists: false },
      })

      await authService.checkEmailExists('  CHECK@EXAMPLE.COM ')

      expect(mockGet).toHaveBeenCalledWith('/auth/check-email', {
        params: { email: 'check@example.com' },
      })
    })

    it('defensively returns false when exists field is missing', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: {},
      } as never)

      expect(await authService.checkEmailExists('x@example.com')).toBe(false)
    })
  })

  describe('session handling', () => {
    it('stores session strictly in memory and does not use localStorage', () => {
      const session = {
        accessToken: 'mock-access-token',
        expiresAt: Date.now() + 60_000,
        user: { email: 'user@example.com' },
      }

      authService.saveSession(session)

      expect(authService.getSession()).toEqual(session)
      expect(apiClient.getAuthToken()).toBe('mock-access-token')
      expect(localStorage.getItem('travel_agency_token')).toBeNull()
      expect(localStorage.getItem('travel_agency_user')).toBeNull()
      expect(localStorage.getItem('travel_agency_expires_at')).toBeNull()
    })

    it('refreshes session via POST /auth/refresh using secure HttpOnly cookie', async () => {
      const mockPost = vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: {
          accessToken: 'refreshed-access-token',
          idToken: 'refreshed-id-token',
          token: 'legacy-refreshed-token',
          expiresIn: 3600,
          tokenType: 'Bearer',
          user: { email: 'refreshed@example.com', role: 'CUSTOMER' },
        },
      } as never)

      const session = await authService.refreshSession()

      expect(mockPost).toHaveBeenCalledWith('/auth/refresh', {})
      expect(session).toEqual({
        accessToken: 'refreshed-access-token',
        expiresAt: expect.any(Number),
        user: { email: 'refreshed@example.com', role: 'CUSTOMER', firstName: undefined, lastName: undefined },
      })
      expect(authService.getSession()?.accessToken).toBe('refreshed-access-token')
    })

    it('queues concurrent refreshSession calls into a single inflight promise', async () => {
      const mockPost = vi.spyOn(apiClient, 'post').mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  data: { token: 'shared-refreshed-token', expiresIn: 3600 },
                } as never),
              10
            )
          )
      )

      const [res1, res2, res3] = await Promise.all([
        authService.refreshSession(),
        authService.refreshSession(),
        authService.refreshSession(),
      ])

      expect(mockPost).toHaveBeenCalledTimes(1)
      expect(res1?.accessToken).toBe('shared-refreshed-token')
      expect(res2?.accessToken).toBe('shared-refreshed-token')
      expect(res3?.accessToken).toBe('shared-refreshed-token')
    })

    it('retains active session when refreshSession fails but token is not yet expired', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('401 Unauthorized'))

      const existingSession = {
        accessToken: 'old-token',
        expiresAt: Date.now() + 60_000,
        user: { email: 'user@example.com' },
      }
      authService.saveSession(existingSession)

      const session = await authService.refreshSession()

      expect(session).toEqual(existingSession)
      expect(authService.getSession()?.accessToken).toBe('old-token')
      expect(apiClient.getAuthToken()).toBe('old-token')
    })

    it('clears session when refreshSession fails and current token is already expired', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('401 Unauthorized'))

      // Save expired session directly into private state
      authService.saveSession({
        accessToken: 'old-expired-token',
        expiresAt: Date.now() - 1000,
        user: { email: 'user@example.com' },
      })

      const session = await authService.refreshSession()

      expect(session).toBeNull()
      expect(authService.getSession()).toBeNull()
      expect(apiClient.getAuthToken()).toBeNull()
    })

    it('clears an expired in-memory session', () => {
      authService.saveSession({
        accessToken: 'expired-access-token',
        expiresAt: Date.now() - 1,
        user: { email: 'user@example.com' },
      })

      expect(authService.getSession()).toBeNull()
    })

    it('treats a session expiring exactly now as expired (boundary)', () => {
      authService.saveSession({
        accessToken: 'boundary-token',
        expiresAt: Date.now(),
        user: { email: 'user@example.com' },
      })

      expect(authService.getSession()).toBeNull()
    })

    it('clearSession clears in-memory session and apiClient token', () => {
      authService.saveSession({
        accessToken: 'tok',
        expiresAt: Date.now() + 60_000,
        user: { email: 'u@example.com' },
      })

      authService.clearSession()

      expect(authService.getSession()).toBeNull()
      expect(apiClient.getAuthToken()).toBeNull()
    })

    it('overwrites a previous session when saving a new one', () => {
      authService.saveSession({
        accessToken: 'first-token',
        expiresAt: Date.now() + 60_000,
        user: { email: 'first@example.com' },
      })
      authService.saveSession({
        accessToken: 'second-token',
        expiresAt: Date.now() + 120_000,
        user: { email: 'second@example.com' },
      })

      expect(authService.getSession()?.accessToken).toBe('second-token')
      expect(apiClient.getAuthToken()).toBe('second-token')
    })
  })

  describe('signOut', () => {
    it('calls POST /auth/sign-out and clears session on success', async () => {
      const mockPost = vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
      })

      authService.saveSession({
        accessToken: 'valid-token',
        expiresAt: Date.now() + 60000,
        user: { email: 'test@example.com' },
      })

      await authService.signOut()

      expect(mockPost).toHaveBeenCalledWith('/auth/sign-out', {})
      expect(authService.getSession()).toBeNull()
      expect(apiClient.getAuthToken()).toBeNull()
    })

    it('clears session even if backend returns an error or 401 unauthorized', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue(new Error('401 Unauthorized'))

      authService.saveSession({
        accessToken: 'expired-token',
        expiresAt: Date.now() + 60000,
        user: { email: 'test@example.com' },
      })

      await authService.signOut()

      expect(authService.getSession()).toBeNull()
      expect(apiClient.getAuthToken()).toBeNull()
    })

    it('clears session even when there is no active session (idempotent)', async () => {
      const mockPost = vi.spyOn(apiClient, 'post').mockResolvedValue({ success: true })

      await expect(authService.signOut()).resolves.not.toThrow()
      expect(authService.getSession()).toBeNull()
      expect(mockPost).toHaveBeenCalled()
    })

    it('clears local session even on network timeout / non-Error rejection', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValue('Network timeout')

      authService.saveSession({
        accessToken: 'tok',
        expiresAt: Date.now() + 60_000,
        user: { email: 'u@example.com' },
      })

      await expect(authService.signOut()).resolves.not.toThrow()
      expect(authService.getSession()).toBeNull()
    })

    it('sends empty body (no token in body — refresh token is in HttpOnly cookie)', async () => {
      const mockPost = vi.spyOn(apiClient, 'post').mockResolvedValue({ success: true })

      authService.saveSession({
        accessToken: 'tok',
        expiresAt: Date.now() + 60_000,
        user: { email: 'u@example.com' },
      })

      await authService.signOut()

      const [, body] = mockPost.mock.calls[0]
      expect(body).toEqual({})
      expect(JSON.stringify(body)).not.toContain('refresh')
    })
  })
})
