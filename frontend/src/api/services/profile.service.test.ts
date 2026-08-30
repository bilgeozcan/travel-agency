import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../client/apiClient'
import { profileService } from './profile.service'

describe('ProfileService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('posts a verified email-change request to the email-change endpoint', async () => {
    const mockPost = vi.spyOn(apiClient, 'post').mockResolvedValue({
      success: true,
      data: { message: 'Verification code sent', pendingEmail: 'new@example.com' },
    })

    await profileService.initiateEmailChange({
      newEmail: 'new@example.com',
      currentPassword: 'CurrentPassword1!',
    })

    expect(mockPost).toHaveBeenCalledWith('/profile/email-change', {
      newEmail: 'new@example.com',
      currentPassword: 'CurrentPassword1!',
    })
  })

  it('gets profile from the profile endpoint', async () => {
    const mockGet = vi.spyOn(apiClient, 'get').mockResolvedValue({
      success: true,
      data: {
        user: {
          email: 'profile@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          role: 'CUSTOMER',
        },
      },
    })

    await profileService.getProfile()

    expect(mockGet).toHaveBeenCalledWith('/profile')
  })
})
