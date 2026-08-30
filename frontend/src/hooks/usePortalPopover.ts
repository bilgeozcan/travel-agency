import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useClickOutside } from './useClickOutside'

export interface PopoverCoords {
  top: number
  left: number
  width: number
}

export interface PortalPopoverResult {
  triggerRef: RefObject<HTMLDivElement | null>
  portalRef: RefObject<HTMLDivElement | null>
  coords: PopoverCoords
  updatePosition: () => void
  ignoreNextScroll: () => void
}

export interface PortalPopoverOptions {
  offsetY?: number
  closeOnScroll?: boolean
}

/**
 * Custom hook to calculate popover anchor position for portal rendering
 * and handle click-outside detection across both the trigger and portal elements.
 */
export function usePortalPopover(
  isOpen: boolean,
  onClose: () => void,
  offsetYOrOptions: number | PortalPopoverOptions = 4,
  closeOnScrollParam: boolean = false
): PortalPopoverResult {
  const options = typeof offsetYOrOptions === 'object' ? offsetYOrOptions : {}
  const offsetY = typeof offsetYOrOptions === 'number' ? offsetYOrOptions : (options.offsetY ?? 4)
  const closeOnScroll = typeof offsetYOrOptions === 'object' ? (options.closeOnScroll ?? false) : closeOnScrollParam

  const triggerRef = useRef<HTMLDivElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<PopoverCoords>({ top: 0, left: 0, width: 0 })
  const ignoreNextScrollRef = useRef(false)

  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const nextCoords = {
      top: rect.bottom + offsetY,
      left: rect.left,
      width: rect.width,
    }

    setCoords((prev) => (
      prev.top === nextCoords.top && prev.left === nextCoords.left && prev.width === nextCoords.width
        ? prev
        : nextCoords
    ))
  }, [offsetY])

  useLayoutEffect(() => {
    if (isOpen) updateCoords()
  })

  useLayoutEffect(() => {
    if (!isOpen) return

    window.addEventListener('resize', updateCoords)
    const handleScroll = () => {
      if (ignoreNextScrollRef.current) {
        ignoreNextScrollRef.current = false
        updateCoords()
        return
      }
      if (closeOnScroll) {
        onClose()
        return
      }
      updateCoords()
    }
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      window.removeEventListener('resize', updateCoords)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [closeOnScroll, isOpen, onClose, updateCoords])

  useClickOutside(
    [triggerRef, portalRef] as RefObject<HTMLElement | null>[],
    onClose,
    isOpen
  )

  return {
    triggerRef,
    portalRef,
    coords,
    updatePosition: updateCoords,
    ignoreNextScroll: () => {
      ignoreNextScrollRef.current = true
    },
  }
}
