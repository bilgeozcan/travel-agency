import { useState, useEffect } from 'react'
import { MAX_COMMENT_LENGTH } from '../../config/feedbackConstants'
import { validateFeedbackInput } from '../../utils/bookingsValidation'

export interface UseFeedbackModalProps {
  isOpen: boolean
  initialRating?: number
  initialComment?: string
  isLoading?: boolean
  onClose: () => void
}

export function useFeedbackModal({
  isOpen,
  initialRating = 0,
  initialComment = '',
  isLoading = false,
  onClose,
}: UseFeedbackModalProps) {
  const safeInitialRating =
    typeof initialRating === 'number' && Number.isFinite(initialRating) ? initialRating : 0
  const safeInitialComment = typeof initialComment === 'string' ? initialComment : ''

  const [rating, setRating] = useState<number>(safeInitialRating)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [comment, setComment] = useState<string>(safeInitialComment)
  const [isAtCharLimit, setIsAtCharLimit] = useState<boolean>(false)

  useEffect(() => {
    if (isOpen) {
      const currentSafeRating =
        typeof initialRating === 'number' && Number.isFinite(initialRating) ? initialRating : 0
      const currentSafeComment = typeof initialComment === 'string' ? initialComment : ''

      setRating(currentSafeRating)
      setHoverRating(0)
      setComment(currentSafeComment)
      setIsAtCharLimit(currentSafeComment.length >= MAX_COMMENT_LENGTH)
    }
  }, [isOpen, initialRating, initialComment])

  const effectiveRating = hoverRating > 0 ? hoverRating : rating
  const charCount = comment.length

  const { showLowRatingWarning, isSubmitDisabled: isDisabledByValidation, isValid } =
    validateFeedbackInput(rating, comment)

  // Loading state also prevents submit — hook owns the full disabled state
  const isSubmitDisabled = isDisabledByValidation || isLoading

  const handleStarClick = (selectedRating: number) => {
    setRating(selectedRating)
  }

  const handleStarMouseEnter = (hoveredRating: number) => {
    setHoverRating(hoveredRating)
  }

  const handleStarMouseLeave = () => {
    setHoverRating(0)
  }

  const handleCommentChange = (newComment: string) => {
    if (newComment.length <= MAX_COMMENT_LENGTH) {
      setComment(newComment)
      setIsAtCharLimit(newComment.length === MAX_COMMENT_LENGTH)
    }
    // Silent rejection when over limit: textarea maxLength attr enforces this at DOM level
    // isAtCharLimit drives the visual warning in CSS
  }

  const resetState = () => {
    setRating(initialRating)
    setHoverRating(0)
    setComment(initialComment)
    setIsAtCharLimit(initialComment.length >= MAX_COMMENT_LENGTH)
  }

  // Both Cancel button and X icon route through handleClose — reset is always guaranteed
  const handleClose = () => {
    resetState()
    onClose()
  }

  return {
    rating,
    hoverRating,
    effectiveRating,
    comment,
    charCount,
    isAtCharLimit,
    showLowRatingWarning,
    isSubmitDisabled,
    isValid,
    handleStarClick,
    handleStarMouseEnter,
    handleStarMouseLeave,
    handleCommentChange,
    handleClose,
    resetState,
  }
}
