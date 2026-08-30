import { apiClient } from '../client/apiClient'
import type { ApiResponse } from '../types/api.types'
import type { AuthenticatedUser } from '@/features/auth/types/auth'

export interface UpdateProfileRequest {
  firstName: string
  lastName: string
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

export interface InitiateEmailChangeRequest {
  newEmail: string
  currentPassword: string
}

export interface ConfirmEmailChangeRequest {
  code: string
}

interface UpdateProfileResponse {
  message: string
  user: AuthenticatedUser
}

interface GetProfileResponse {
  user: AuthenticatedUser
}

interface ChangePasswordResponse {
  message: string
}

interface InitiateEmailChangeResponse {
  message: string
  pendingEmail: string
}

interface EmailChangeResponse {
  message: string
}

class ProfileService {
  public getProfile(): Promise<ApiResponse<GetProfileResponse>> {
    return apiClient.get<GetProfileResponse>('/profile')
  }

  public updateProfile(payload: UpdateProfileRequest): Promise<ApiResponse<UpdateProfileResponse>> {
    return apiClient.put<UpdateProfileResponse>('/profile', payload)
  }

  public changePassword(payload: ChangePasswordRequest): Promise<ApiResponse<ChangePasswordResponse>> {
    return apiClient.post<ChangePasswordResponse>('/profile/change-password', payload)
  }

  public initiateEmailChange(payload: InitiateEmailChangeRequest): Promise<ApiResponse<InitiateEmailChangeResponse>> {
    return apiClient.post<InitiateEmailChangeResponse>('/profile/email-change', payload)
  }

  public confirmEmailChange(payload: ConfirmEmailChangeRequest): Promise<ApiResponse<EmailChangeResponse>> {
    return apiClient.post<EmailChangeResponse>('/profile/email-change/confirm', payload)
  }

  public resendEmailChangeCode(): Promise<ApiResponse<EmailChangeResponse>> {
    return apiClient.post<EmailChangeResponse>('/profile/email-change/resend', {})
  }
}

export const profileService = new ProfileService()
