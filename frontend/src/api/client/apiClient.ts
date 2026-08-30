import { ApiError } from './apiError'
import type { ApiErrorPayload, ApiResponse } from '../types/api.types'

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
  timeoutMs?: number
  _isRetry?: boolean
}

const DEFAULT_TIMEOUT_MS = 15000

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const extractDetails = (value: Record<string, unknown>): ApiErrorPayload['details'] => {
  const candidate = value.details ?? value.errors
  return typeof candidate === 'string' || isRecord(candidate) ? candidate : undefined
}

const toApiErrorPayload = (value: unknown): ApiErrorPayload => {
  if (!isRecord(value)) {
    return { message: typeof value === 'string' && value ? value : 'Request failed' }
  }

  return {
    code: typeof value.code === 'string' ? value.code : undefined,
    message: typeof value.message === 'string' ? value.message : 'Request failed',
    details: extractDetails(value),
  }
}

export class ApiClient {
  private baseURL: string
  private defaultHeaders: Record<string, string>
  private token: string | null = null
  private refreshHandler: (() => Promise<boolean>) | null = null
  private refreshPromise: Promise<boolean> | null = null

  constructor() {
    const productionBaseUrl = import.meta.env.VITE_API_BASE_URL
    if (!import.meta.env.DEV && !productionBaseUrl) {
      throw new Error('VITE_API_BASE_URL must be configured for production builds.')
    }

    this.baseURL = import.meta.env.DEV ? '/api' : productionBaseUrl
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  public setAuthToken(token: string | null): void {
    this.token = token
  }

  public getAuthToken(): string | null {
    return this.token
  }

  public setRefreshHandler(handler: (() => Promise<boolean>) | null): void {
    this.refreshHandler = handler
  }

  private async attemptRefresh(): Promise<boolean> {
    if (!this.refreshHandler) return false

    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshHandler().finally(() => {
        this.refreshPromise = null
      })
    }

    return this.refreshPromise
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost'
    const url = new URL(
      endpoint.startsWith('http') ? endpoint : `${this.baseURL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`,
      origin
    )

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    return url.toString()
  }

  private getHeaders(customHeaders?: HeadersInit): Headers {
    const headers = new Headers(this.defaultHeaders)

    if (customHeaders) {
      new Headers(customHeaders).forEach((value, key) => headers.set(key, value))
    }

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`)
    }

    return headers
  }

  public async request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { body, params, headers, timeoutMs = DEFAULT_TIMEOUT_MS, _isRetry, ...customConfig } = options

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const requestHeaders = this.getHeaders(headers)

    const isPlainPayload =
      body !== undefined &&
      typeof body !== 'string' &&
      !(typeof FormData !== 'undefined' && body instanceof FormData) &&
      !(typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) &&
      !(typeof Blob !== 'undefined' && body instanceof Blob)

    const config: RequestInit = {
      credentials: 'include',
      ...customConfig,
      headers: requestHeaders,
      signal: controller.signal,
    }

    if (body !== undefined) {
      config.body = isPlainPayload ? JSON.stringify(body) : (body as BodyInit)
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        requestHeaders.delete('Content-Type')
      }
    } else {
      requestHeaders.delete('Content-Type')
    }

    try {
      const url = this.buildUrl(endpoint, params)
      const isPasswordChangeRequest = endpoint === '/profile/change-password'

      if (import.meta.env.DEV && isPasswordChangeRequest) {
        console.debug('[Change password] Request diagnostics', {
          method: config.method,
          url,
          hasStoredAccessToken: Boolean(this.token),
          hasAuthorizationHeader: requestHeaders.has('Authorization'),
        })
      }

      const response = await fetch(url, config)
      clearTimeout(timeoutId)

      const contentType = response.headers.get('content-type')
      const isJson = contentType && contentType.includes('application/json')

      let responseData: unknown = null
      if (response.status !== 204) {
        const text = await response.text()
        if (text) {
          if (isJson) {
            try {
              responseData = JSON.parse(text)
            } catch {
              responseData = text
            }
          } else {
            responseData = text
          }
        }
      }

      if (!response.ok) {
        if (import.meta.env.DEV && isPasswordChangeRequest) {
          console.debug('[Change password] Response diagnostics', {
            status: response.status,
            code: isRecord(responseData) ? responseData.code : undefined,
          })
        }

        if (
          response.status === 401 &&
          !_isRetry &&
          endpoint !== '/auth/refresh' &&
          endpoint !== '/auth/sign-in' &&
          endpoint !== '/auth/sign-out' &&
          this.refreshHandler
        ) {
          const refreshed = await this.attemptRefresh()
          if (refreshed) {
            return this.request<T>(endpoint, { ...options, _isRetry: true })
          }
        }

        throw new ApiError(toApiErrorPayload(responseData), response.status)
      }

      if (isRecord(responseData) && typeof responseData.success === 'boolean') {
        return {
          success: responseData.success,
          data: responseData.data as T | undefined,
          message: typeof responseData.message === 'string' ? responseData.message : undefined,
          timestamp: typeof responseData.timestamp === 'string' ? responseData.timestamp : undefined,
        }
      }

      return { success: true, data: responseData as T }
    } catch (error: unknown) {
      clearTimeout(timeoutId)

      if (error instanceof ApiError) {
        throw error
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError({ message: 'Request timeout. Please try again.' }, 408)
      }

      throw new ApiError(
        { message: error instanceof Error ? error.message : 'Network connection failed' },
        0
      )
    }
  }

  public get<T = unknown>(endpoint: string, options?: Omit<RequestOptions, 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  public post<T = unknown>(endpoint: string, body: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body })
  }

  public put<T = unknown>(endpoint: string, body: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body })
  }

  public delete<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE', body })
  }
}

export const apiClient = new ApiClient()
