import type { ApiErrorPayload } from '../types/api.types'

export class ApiError extends Error {
  public readonly status: number
  public readonly code?: string
  public readonly details?: unknown

  constructor(payload: ApiErrorPayload, status: number = 500) {
    super(payload.message)
    this.name = 'ApiError'
    this.status = status
    this.code = payload.code
    this.details = payload.details
  }
}
