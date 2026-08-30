import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ProfilePage } from './ProfilePage'
import { LoadingProvider } from '@/providers/LoadingContext'
import { AuthProvider } from '@/providers/AuthContext'
import { authService } from '@/api/services/auth.service'
import { profileService } from '@/api/services/profile.service'
import { ApiError } from '@/api/client/apiError'
import { useCountdownTimer } from '@/hooks/useCountdownTimer'
import { ERROR_MESSAGES } from '@/utils/validation'

vi.mock('@/api/services/auth.service', () => ({
  authService: {
    getSession: vi.fn(),
    saveSession: vi.fn(),
    refreshSession: vi.fn(),
    signOut: vi.fn(),
  },
}))

vi.mock('@/api/services/profile.service', () => ({
  profileService: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    initiateEmailChange: vi.fn(),
    confirmEmailChange: vi.fn(),
    resendEmailChangeCode: vi.fn(),
  },
}))

vi.mock('@/hooks/useCountdownTimer', () => ({
  useCountdownTimer: vi.fn(),
}))

const mockedAuthService = vi.mocked(authService)
const mockedProfileService = vi.mocked(profileService)
const mockedUseCountdownTimer = vi.mocked(useCountdownTimer)

const user = {
  email: 'customer@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  role: 'Customer',
}

const renderProfilePage = () => {
  mockedAuthService.getSession.mockReturnValue({
    accessToken: 'token',
    expiresAt: Date.now() + 60_000,
    user,
  })

  return render(
    <MemoryRouter>
      <LoadingProvider>
        <AuthProvider>
          <ProfilePage user={user} role="Customer" />
        </AuthProvider>
      </LoadingProvider>
    </MemoryRouter>
  )
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedAuthService.refreshSession.mockResolvedValue(null)
    mockedAuthService.signOut.mockResolvedValue(undefined)
    mockedProfileService.getProfile.mockResolvedValue({
      success: true,
      data: { user },
    })
    mockedProfileService.updateProfile.mockResolvedValue({
      success: true,
      data: { message: 'Profile updated', user },
    })
    mockedProfileService.changePassword.mockResolvedValue({
      success: true,
      data: { message: 'Password changed successfully' },
    })
    mockedProfileService.initiateEmailChange.mockResolvedValue({
      success: true,
      data: { message: 'Verification code sent', pendingEmail: 'next@example.com' },
    })
    mockedProfileService.confirmEmailChange.mockResolvedValue({
      success: true,
      data: { message: 'Email changed successfully' },
    })
    mockedProfileService.resendEmailChangeCode.mockResolvedValue({
      success: true,
      data: { message: 'Verification code resent' },
    })
    mockedUseCountdownTimer.mockReturnValue({
      secondsLeft: 0,
      isExpired: true,
      restart: vi.fn(),
    })
    sessionStorage.clear()
  })

  it('hydrates the profile from the backend on load', async () => {
    renderProfilePage()

    await waitFor(() => expect(mockedProfileService.getProfile).toHaveBeenCalledTimes(1))
    expect(mockedProfileService.getProfile).toHaveBeenCalledWith()
  })

  it('saves general information with names containing spaces', async () => {
    mockedProfileService.getProfile.mockResolvedValue({
      success: true,
      data: {
        user: {
          ...user,
          firstName: 'Jane Mary',
        },
      },
    })

    renderProfilePage()

    fireEvent.click(await screen.findByRole('button', { name: /Edit general information/i }))
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Jane Mary' } })
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }))

    await waitFor(() => {
      expect(mockedProfileService.updateProfile).toHaveBeenCalledWith({
        firstName: 'Jane Mary',
        lastName: 'Doe',
      })
    })
  })

  it('shows an inline error when the current password is wrong during password change', async () => {
    mockedProfileService.changePassword.mockRejectedValue(
      new ApiError({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }, 401)
    )

    renderProfilePage()

    fireEvent.click(await screen.findByRole('button', { name: /Change password/i }))
    fireEvent.change(screen.getByLabelText('Old password'), { target: { value: 'WrongPassword1!' } })
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'ValidPassword1!' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'ValidPassword1!' } })
    fireEvent.click(screen.getByRole('button', { name: /Save changes/i }))

    await waitFor(() => {
      expect(screen.getByText('Old password is incorrect, please enter the correct one')).toBeInTheDocument()
    })
  })

  it('starts email verification and allows resending after cooldown', async () => {
    renderProfilePage()

    fireEvent.click(await screen.findByRole('button', { name: /Change email/i }))
    fireEvent.change(screen.getByLabelText('New email'), { target: { value: 'next@example.com' } })
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'CurrentPassword1!' } })
    fireEvent.click(screen.getByRole('button', { name: /^Confirm$/i }))

    await waitFor(() => {
      expect(mockedProfileService.initiateEmailChange).toHaveBeenCalledWith({
        newEmail: 'next@example.com',
        currentPassword: 'CurrentPassword1!',
      })
    })

    expect(screen.getByText(/We sent an email to next@example.com/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Resend/i }))

    await waitFor(() => expect(mockedProfileService.resendEmailChangeCode).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Verification code resent')).toBeInTheDocument()
  })

  it('shows an inline error on both email-change fields for invalid credentials', async () => {
    mockedProfileService.initiateEmailChange.mockRejectedValue(
      new ApiError({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }, 401)
    )

    renderProfilePage()

    fireEvent.click(await screen.findByRole('button', { name: /Change email/i }))
    fireEvent.change(screen.getByLabelText('New email'), { target: { value: 'next@example.com' } })
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'CurrentPassword1!' } })
    fireEvent.click(screen.getByRole('button', { name: /^Confirm$/i }))

    await waitFor(() => {
      expect(screen.getAllByText('Invalid email or password')).toHaveLength(2)
    })
  })

  it('renders side navigation and switches tabs correctly', async () => {
    renderProfilePage()

    expect(screen.getByRole('heading', { level: 1, name: 'My profile' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'General information' })).toHaveAttribute('aria-current', 'page')

    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Change password' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Change email' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Change email' })).toBeInTheDocument()
  })

  it('displays real-time inline validation error and disables Save changes when invalid name is typed', async () => {
    renderProfilePage()

    fireEvent.click(await screen.findByRole('button', { name: /Edit general information/i }))
    const firstNameInput = screen.getByLabelText('First name')
    const saveButton = screen.getByRole('button', { name: /Save changes/i })

    fireEvent.change(firstNameInput, { target: { value: 'John@' } })

    expect(screen.getByText(ERROR_MESSAGES.firstName)).toBeInTheDocument()
    expect(saveButton).toBeDisabled()
  })
})
