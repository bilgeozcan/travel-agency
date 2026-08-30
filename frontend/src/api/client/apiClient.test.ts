import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'

const jsonResponse = (body: unknown, status: number = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('ApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    apiClient.setAuthToken(null)
    apiClient.setRefreshHandler(null)
  })

  it('serializes falsey JSON request bodies', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ enabled: false }))

    await apiClient.post('/preferences/notifications', false)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/preferences/notifications'),
      expect.objectContaining({ body: 'false', method: 'POST' })
    )
  })

  it('returns a normalized API response envelope', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 'booking-1' }, message: 'Created' })
    )

    await expect(apiClient.get<{ id: string }>('/bookings/booking-1')).resolves.toEqual({
      success: true,
      data: { id: 'booking-1' },
      message: 'Created',
      timestamp: undefined,
    })
  })

  it('maps non-JSON HTTP failures to ApiError', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Service unavailable', { status: 503 }))

    await expect(apiClient.get('/health')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Service unavailable',
      status: 503,
    })
  })

  it('handles 204 No Content gracefully without JSON parse error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    const result = await apiClient.delete('/bookings/booking-123')
    expect(result).toEqual({ success: true, data: null })
  })

  it('coalesces concurrent 401 refresh requests into a single refresh call', async () => {
    let refreshCount = 0
    const mockRefreshHandler = vi.fn().mockImplementation(async () => {
      refreshCount++
      await new Promise((res) => setTimeout(res, 50))
      return true
    })

    apiClient.setRefreshHandler(mockRefreshHandler)

    // Return a fresh Response instance for every fetch call
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockImplementation(async () => jsonResponse({ success: true, data: 'ok' }))

    const [r1, r2, r3] = await Promise.all([
      apiClient.get('/user/profile'),
      apiClient.get('/user/settings'),
      apiClient.get('/user/notifications'),
    ])

    expect(refreshCount).toBe(1)
    expect(mockRefreshHandler).toHaveBeenCalledTimes(1)
    expect(r1.data).toBe('ok')
    expect(r2.data).toBe('ok')
    expect(r3.data).toBe('ok')
  })

  it('does not set Content-Type header when sending FormData', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ success: true }))

    const formData = new FormData()
    formData.append('file', 'mock-content')

    await apiClient.post('/upload', formData)

    const fetchCall = vi.mocked(fetch).mock.calls[0]
    const options = fetchCall[1] as RequestInit
    const headers = options.headers as Headers

    expect(options.body).toBe(formData)
    expect(headers.has('Content-Type')).toBe(false)
  })

  it('handles request timeout via AbortError throwing ApiError with status 408', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    vi.mocked(fetch).mockRejectedValueOnce(abortError)

    await expect(apiClient.get('/slow-endpoint')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Request timeout. Please try again.',
      status: 408,
    })
  })

  it('handles network connection failure throwing ApiError with status 0', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(apiClient.get('/endpoint')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Failed to fetch',
      status: 0,
    })
  })

  it('does not attempt session refresh on auth endpoints when receiving 401', async () => {
    const mockRefreshHandler = vi.fn().mockResolvedValue(true)
    apiClient.setRefreshHandler(mockRefreshHandler)

    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))

    await expect(apiClient.post('/auth/refresh', {})).rejects.toMatchObject({
      status: 401,
    })
    expect(mockRefreshHandler).not.toHaveBeenCalled()
  })

  it('rejects with 401 when refresh attempt returns false', async () => {
    const mockRefreshHandler = vi.fn().mockResolvedValue(false)
    apiClient.setRefreshHandler(mockRefreshHandler)

    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))

    await expect(apiClient.get('/protected-resource')).rejects.toMatchObject({
      status: 401,
    })
    expect(mockRefreshHandler).toHaveBeenCalledTimes(1)
  })
})