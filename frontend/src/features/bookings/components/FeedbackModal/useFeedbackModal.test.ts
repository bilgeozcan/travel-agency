import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useFeedbackModal } from './useFeedbackModal'
import { MAX_COMMENT_LENGTH } from '../../config/feedbackConstants'

describe('useFeedbackModal Hook - Core & Edge Cases', () => {
  it('initializes with default values: rating 0, isSubmitDisabled true, showLowRatingWarning false', () => {
    const { result } = renderHook(() =>
      useFeedbackModal({ isOpen: true, onClose: vi.fn() })
    )

    expect(result.current.rating).toBe(0)
    expect(result.current.effectiveRating).toBe(0)
    expect(result.current.comment).toBe('')
    expect(result.current.charCount).toBe(0)
    expect(result.current.isAtCharLimit).toBe(false)
    expect(result.current.isSubmitDisabled).toBe(true)
    expect(result.current.showLowRatingWarning).toBe(false)
    expect(result.current.isValid).toBe(false)
  })

  it('edge case: initializes with custom initialRating and initialComment (Update Mode Prefill)', () => {
    const { result } = renderHook(() =>
      useFeedbackModal({
        isOpen: true,
        initialRating: 4,
        initialComment: 'Pre-existing feedback',
        onClose: vi.fn(),
      })
    )

    expect(result.current.rating).toBe(4)
    expect(result.current.effectiveRating).toBe(4)
    expect(result.current.comment).toBe('Pre-existing feedback')
    expect(result.current.charCount).toBe(21)
    expect(result.current.isSubmitDisabled).toBe(false)
    expect(result.current.showLowRatingWarning).toBe(false)
  })

  it('edge case: hover state precedence vs clicked rating state', () => {
    const { result } = renderHook(() =>
      useFeedbackModal({ isOpen: true, onClose: vi.fn() })
    )

    act(() => {
      result.current.handleStarClick(2)
    })
    expect(result.current.rating).toBe(2)
    expect(result.current.effectiveRating).toBe(2)
    expect(result.current.showLowRatingWarning).toBe(true)

    act(() => {
      result.current.handleStarMouseEnter(5)
    })
    expect(result.current.rating).toBe(2)
    expect(result.current.hoverRating).toBe(5)
    expect(result.current.effectiveRating).toBe(5)
    // Validation still uses saved rating (2), not hover preview
    expect(result.current.showLowRatingWarning).toBe(true)

    act(() => {
      result.current.handleStarMouseLeave()
    })
    expect(result.current.hoverRating).toBe(0)
    expect(result.current.effectiveRating).toBe(2)
  })

  it('handleCommentChange: 500 char limit enforcement — rejects input over limit, accepts at limit', () => {
    const { result } = renderHook(() =>
      useFeedbackModal({ isOpen: true, onClose: vi.fn() })
    )

    // Over limit: rejected, comment stays empty
    const overLimit = 'a'.repeat(MAX_COMMENT_LENGTH + 5)
    act(() => {
      result.current.handleCommentChange(overLimit)
    })
    expect(result.current.comment).toBe('')
    expect(result.current.charCount).toBe(0)
    expect(result.current.isAtCharLimit).toBe(false)

    // Exactly at limit: accepted, isAtCharLimit becomes true
    const exactLimit = 'b'.repeat(MAX_COMMENT_LENGTH)
    act(() => {
      result.current.handleCommentChange(exactLimit)
    })
    expect(result.current.comment.length).toBe(MAX_COMMENT_LENGTH)
    expect(result.current.charCount).toBe(MAX_COMMENT_LENGTH)
    expect(result.current.isAtCharLimit).toBe(true)

    // One under limit: accepted, isAtCharLimit goes false
    const underLimit = 'c'.repeat(MAX_COMMENT_LENGTH - 1)
    act(() => {
      result.current.handleCommentChange(underLimit)
    })
    expect(result.current.charCount).toBe(MAX_COMMENT_LENGTH - 1)
    expect(result.current.isAtCharLimit).toBe(false)
  })

  it('isLoading in hook: isSubmitDisabled true even when rating and comment are valid', () => {
    const { result } = renderHook(() =>
      useFeedbackModal({
        isOpen: true,
        isLoading: true,
        onClose: vi.fn(),
      })
    )

    act(() => {
      result.current.handleStarClick(5)
      result.current.handleCommentChange('Great tour!')
    })

    // Validation would pass (rating 5, non-empty comment) but isLoading prevents submit
    expect(result.current.isValid).toBe(true)
    expect(result.current.isSubmitDisabled).toBe(true)
  })

  it('edge case: whitespace-only comment handling for low rating (1-3 stars)', () => {
    const { result } = renderHook(() =>
      useFeedbackModal({ isOpen: true, onClose: vi.fn() })
    )

    act(() => {
      result.current.handleStarClick(2)
      result.current.handleCommentChange('   \n\t   ')
    })

    expect(result.current.showLowRatingWarning).toBe(true)
    expect(result.current.isSubmitDisabled).toBe(true)

    act(() => {
      result.current.handleCommentChange('   valid review  ')
    })
    expect(result.current.showLowRatingWarning).toBe(false)
    expect(result.current.isSubmitDisabled).toBe(false)
  })

  it('resetState can be called independently without triggering onClose', () => {
    const handleCloseSpy = vi.fn()
    const { result } = renderHook(() =>
      useFeedbackModal({ isOpen: true, onClose: handleCloseSpy })
    )

    act(() => {
      result.current.handleStarClick(4)
      result.current.handleCommentChange('Some text')
    })
    expect(result.current.rating).toBe(4)
    expect(result.current.comment).toBe('Some text')

    // resetState alone — does NOT call onClose
    act(() => {
      result.current.resetState()
    })
    expect(result.current.rating).toBe(0)
    expect(result.current.comment).toBe('')
    expect(handleCloseSpy).not.toHaveBeenCalled()
  })

  it('handleClose: always calls both resetState and onClose (Cancel and X both route here)', () => {
    const handleCloseSpy = vi.fn()
    const { result } = renderHook(() =>
      useFeedbackModal({ isOpen: true, onClose: handleCloseSpy })
    )

    act(() => {
      result.current.handleStarClick(3)
      result.current.handleCommentChange('Draft review')
    })

    act(() => {
      result.current.handleClose()
    })

    expect(handleCloseSpy).toHaveBeenCalledTimes(1)
    expect(result.current.rating).toBe(0)
    expect(result.current.comment).toBe('')
    expect(result.current.isAtCharLimit).toBe(false)
  })

  it('edge case: modal re-opening resets state to initial props', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useFeedbackModal({ isOpen, onClose: vi.fn() }),
      { initialProps: { isOpen: true } }
    )

    act(() => {
      result.current.handleStarClick(3)
      result.current.handleCommentChange('Draft comment')
    })
    expect(result.current.rating).toBe(3)

    rerender({ isOpen: false })
    rerender({ isOpen: true })

    expect(result.current.rating).toBe(0)
    expect(result.current.comment).toBe('')
    expect(result.current.hoverRating).toBe(0)
    expect(result.current.isAtCharLimit).toBe(false)
    expect(result.current.isSubmitDisabled).toBe(true)
  })
})
