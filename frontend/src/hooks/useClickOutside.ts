import { useEffect, type RefObject } from 'react'

/**
 * Custom hook that triggers a callback when clicking outside of the referenced element(s).
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null> | Array<RefObject<T | null>>,
  handler: (event: MouseEvent | TouchEvent) => void,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return

    const listener = (event: MouseEvent | TouchEvent) => {
      const refs = Array.isArray(ref) ? ref : [ref]
      const isOutside = refs.every((r) => {
        const el = r.current
        return !el || !el.contains(event.target as Node)
      })

      if (isOutside) {
        handler(event)
      }
    }

    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)

    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, handler, enabled])
}
