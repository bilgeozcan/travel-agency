// Auth API Data Transfer Objects (DTOs)

export interface RegisterRequest {
  firstName: string
  lastName: string
  email: string
  password: string
}

export interface RegisterResponseData {
  userId: string
  email: string
  firstName: string
  lastName: string
  createdAt: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponseData {
  accessToken?: string
  idToken?: string
  token?: string
  expiresIn: number
  tokenType?: string
  refreshToken?: string
  email?: string
  userName?: string
  role?: 'CUSTOMER' | 'TRAVEL_AGENT' | string
  user?: {
    id?: string
    email?: string
    firstName?: string
    lastName?: string
    role?: 'CUSTOMER' | 'TRAVEL_AGENT' | string
  }
}
export interface ForgotPasswordRequest {
  email: string
}

export interface ForgotPasswordResponseData {
  message?: string
}

export interface VerifyResetCodeRequest {
  email: string
  code: string
}

export interface VerifyResetCodeResponseData {
  resetToken?: string
  message?: string
}

export interface ResetPasswordRequest {
  email: string
  confirmationCode: string
  newPassword: string
}

export interface ResetPasswordResponseData {
  message?: string
}
