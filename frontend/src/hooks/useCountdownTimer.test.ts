import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCountdownTimer } from './useCountdownTimer'

describe('useCountdownTimer Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with given seconds and decreases count every second', () => {
    const { result } = renderHook(() => useCountdownTimer(60))

    expect(result.current.secondsLeft).toBe(60)
    expect(result.current.isExpired).toBe(false)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.secondsLeft).toBe(59)
    expect(result.current.isExpired).toBe(false)
  })

  it('marks as expired when reaching 0 and invokes onExpire callback', () => {
    const onExpireMock = vi.fn()
    const { result } = renderHook(() => useCountdownTimer(2, onExpireMock))

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.secondsLeft).toBe(0)
    expect(result.current.isExpired).toBe(true)
    expect(onExpireMock).toHaveBeenCalledTimes(1)
  })

  it('restarts timer to initial or new value when restart is called', () => {
    const { result } = renderHook(() => useCountdownTimer(60))

    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(result.current.secondsLeft).toBe(50)

    act(() => {
      result.current.restart()
    })
    expect(result.current.secondsLeft).toBe(60)
    expect(result.current.isExpired).toBe(false)

    act(() => {
      result.current.restart(30)
    })
    expect(result.current.secondsLeft).toBe(30)
  })

  it('persists target timestamp in sessionStorage when storageKey is provided', () => {
    const key = 'test_timer_key'
    sessionStorage.clear()

    const { result } = renderHook(() => useCountdownTimer(60, undefined, key))
    expect(result.current.secondsLeft).toBe(60)
    expect(sessionStorage.getItem(key)).not.toBeNull()

    // Simulate page reload with 20 seconds elapsed
    vi.setSystemTime(Date.now() + 20000)

    const { result: reloaded } = renderHook(() => useCountdownTimer(60, undefined, key))
    expect(reloaded.current.secondsLeft).toBe(40)
  })
})

