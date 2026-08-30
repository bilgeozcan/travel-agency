// Standard API Response & Error Interfaces

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  timestamp?: string
}

export interface ApiErrorPayload {
  code?: string
  message: string
  details?: unknown
  status?: number
}
