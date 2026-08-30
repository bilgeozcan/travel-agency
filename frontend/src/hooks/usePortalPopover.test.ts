import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePortalPopover } from './usePortalPopover'

describe('usePortalPopover Hook', () => {
  it('initializes with zero coords and provides refs', () => {
    const onClose = vi.fn()
    const { result } = renderHook(() => usePortalPopover(false, onClose))

    expect(result.current.triggerRef.current).toBeNull()
    expect(result.current.portalRef.current).toBeNull()
    expect(result.current.coords).toEqual({ top: 0, left: 0, width: 0 })
  })

  it('calculates anchor coords when opened', () => {
    const onClose = vi.fn()
    const { result, rerender } = renderHook(({ isOpen }) => usePortalPopover(isOpen, onClose), {
      initialProps: { isOpen: false },
    })

    const dummyElement = document.createElement('div')
    vi.spyOn(dummyElement, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      left: 50,
      width: 200,
      top: 50,
      right: 250,
      height: 50,
      x: 50,
      y: 50,
      toJSON: () => {},
    })

    // Assign ref manually
    ;(result.current.triggerRef as any).current = dummyElement

    act(() => {
      rerender({ isOpen: true })
    })

    expect(result.current.coords).toEqual({ top: 104, left: 50, width: 200 })
  })

  it('recalculates anchor coords while open when the trigger moves', () => {
    const onClose = vi.fn()
    const { result, rerender } = renderHook(({ isOpen }) => usePortalPopover(isOpen, onClose), {
      initialProps: { isOpen: true },
    })

    const dummyElement = document.createElement('div')
    const getBoundingClientRect = vi.spyOn(dummyElement, 'getBoundingClientRect')
    getBoundingClientRect.mockReturnValue({
      bottom: 100,
      left: 50,
      width: 200,
      top: 50,
      right: 250,
      height: 50,
      x: 50,
      y: 50,
      toJSON: () => {},
    })

    ;(result.current.triggerRef as any).current = dummyElement

    act(() => {
      rerender({ isOpen: true })
    })

    expect(result.current.coords).toEqual({ top: 104, left: 50, width: 200 })

    getBoundingClientRect.mockReturnValue({
      bottom: 72,
      left: 50,
      width: 200,
      top: 22,
      right: 250,
      height: 50,
      x: 50,
      y: 22,
      toJSON: () => {},
    })

    act(() => {
      rerender({ isOpen: true })
    })

    expect(result.current.coords).toEqual({ top: 76, left: 50, width: 200 })
  })
})
