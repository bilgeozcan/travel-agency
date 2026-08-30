import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCancelBookingModal } from './useCancelBookingModal'

describe('useCancelBookingModal Hook', () => {
  it('initializes with empty reason and disabled submit button', () => {
    const { result } = renderHook(() => useCancelBookingModal())

    expect(result.current.selectedReason).toBe('')
    expect(result.current.isSubmitDisabled).toBe(true)
  })

  it('enables submit button when valid reason is selected', () => {
    const { result } = renderHook(() => useCancelBookingModal())

    act(() => {
      result.current.handleReasonChange("Customer's Emergency")
    })

    expect(result.current.selectedReason).toBe("Customer's Emergency")
    expect(result.current.isSubmitDisabled).toBe(false)
  })

  it('resets state correctly', () => {
    const { result } = renderHook(() => useCancelBookingModal())

    act(() => {
      result.current.handleReasonChange('Hotel Emergency')
    })
    expect(result.current.selectedReason).toBe('Hotel Emergency')

    act(() => {
      result.current.resetState()
    })
    expect(result.current.selectedReason).toBe('')
    expect(result.current.isSubmitDisabled).toBe(true)
  })
})
