import { renderHook, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useClickOutside } from './useClickOutside'

describe('useClickOutside Custom Hook', () => {
  it('triggers handler when clicking outside single referenced element', () => {
    const handler = vi.fn()
    const container = document.createElement('div')
    const target = document.createElement('div')
    const outsideElement = document.createElement('button')
    
    container.appendChild(target)
    container.appendChild(outsideElement)
    document.body.appendChild(container)

    const ref = { current: target }
    renderHook(() => useClickOutside(ref, handler, true))

    fireEvent.mouseDown(outsideElement)
    expect(handler).toHaveBeenCalledTimes(1)

    fireEvent.mouseDown(target)
    expect(handler).toHaveBeenCalledTimes(1) // not called on target click

    document.body.removeChild(container)
  })

  it('triggers handler when clicking outside array of referenced elements', () => {
    const handler = vi.fn()
    const el1 = document.createElement('div')
    const el2 = document.createElement('div')
    const outsideEl = document.createElement('span')

    document.body.appendChild(el1)
    document.body.appendChild(el2)
    document.body.appendChild(outsideEl)

    renderHook(() => useClickOutside([{ current: el1 }, { current: el2 }], handler, true))

    fireEvent.mouseDown(el1)
    expect(handler).not.toHaveBeenCalled()

    fireEvent.mouseDown(el2)
    expect(handler).not.toHaveBeenCalled()

    fireEvent.mouseDown(outsideEl)
    expect(handler).toHaveBeenCalledTimes(1)

    document.body.removeChild(el1)
    document.body.removeChild(el2)
    document.body.removeChild(outsideEl)
  })

  it('does not trigger handler when disabled', () => {
    const handler = vi.fn()
    const target = document.createElement('div')
    const outsideEl = document.createElement('div')
    document.body.appendChild(target)
    document.body.appendChild(outsideEl)

    renderHook(() => useClickOutside({ current: target }, handler, false))

    fireEvent.mouseDown(outsideEl)
    expect(handler).not.toHaveBeenCalled()

    document.body.removeChild(target)
    document.body.removeChild(outsideEl)
  })
})
