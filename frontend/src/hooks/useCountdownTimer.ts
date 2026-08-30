import { useState, useEffect, useCallback, useRef } from 'react'

export interface UseCountdownTimerReturn {
  secondsLeft: number
  isExpired: boolean
  restart: (newSeconds?: number) => void
}

export function useCountdownTimer(
  initialSeconds: number = 60,
  onExpire?: () => void,
  storageKey?: string
): UseCountdownTimerReturn {
  const getInitialTargetTimestamp = (): number => {
    if (storageKey) {
      try {
        const stored = sessionStorage.getItem(storageKey)
        if (stored) {
          const parsed = parseInt(stored, 10)
          if (Number.isFinite(parsed) && parsed > Date.now()) {
            return parsed
          }
        }
      } catch {
        // Ignore storage errors
      }
    }
    const target = Date.now() + initialSeconds * 1000
    if (storageKey) {
      try {
        sessionStorage.setItem(storageKey, target.toString())
      } catch {
        // Ignore storage errors
      }
    }
    return target
  }

  const targetTimestampRef = useRef<number | null>(null)
  if (targetTimestampRef.current === null) {
    targetTimestampRef.current = getInitialTargetTimestamp()
  }

  const calculateRemaining = useCallback((): number => {
    const target = targetTimestampRef.current ?? Date.now()
    const remaining = Math.ceil((target - Date.now()) / 1000)
    return Math.max(0, remaining)
  }, [])

  const [secondsLeft, setSecondsLeft] = useState<number>(calculateRemaining)
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  }, [onExpire])

  useEffect(() => {
    const updateRemaining = () => {
      const remaining = calculateRemaining()
      setSecondsLeft(remaining)

      if (remaining <= 0) {
        if (storageKey) {
          try {
            sessionStorage.removeItem(storageKey)
          } catch {
            // Ignore storage errors
          }
        }
        if (onExpireRef.current) {
          onExpireRef.current()
        }
      }
    }

    if (secondsLeft <= 0) return

    const timer = setInterval(updateRemaining, 500)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateRemaining()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [secondsLeft, calculateRemaining, storageKey])

  const restart = useCallback(
    (newSeconds?: number) => {
      const seconds = newSeconds ?? initialSeconds
      const newTarget = Date.now() + seconds * 1000
      targetTimestampRef.current = newTarget

      if (storageKey) {
        try {
          sessionStorage.setItem(storageKey, newTarget.toString())
        } catch {
          // Ignore storage errors
        }
      }

      setSecondsLeft(seconds)
    },
    [initialSeconds, storageKey]
  )

  return {
    secondsLeft,
    isExpired: secondsLeft <= 0,
    restart,
  }
}

