import React from 'react'
import { ModalShell } from '@/components/ui/Modal/ModalShell'
import { Button } from '@/components/ui/Button/Button'
import starIcon from '@/assets/icons/Star.svg'
import starBlankIcon from '@/assets/icons/star_blank.svg'
import {
  FEEDBACK_MODAL_STRINGS,
  MAX_FEEDBACK_RATING,
  MAX_COMMENT_LENGTH,
} from '../../config/feedbackConstants'
import type { FeedbackModalProps } from './FeedbackModal.types'
import { useFeedbackModal } from './useFeedbackModal'
import './FeedbackModal.css'

export type { FeedbackModalProps }

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  initialRating,
  initialComment,
  onClose,
  onSubmit,
  isLoading = false,
}) => {
  const {
    rating,
    effectiveRating,
    comment,
    charCount,
    isAtCharLimit,
    showLowRatingWarning,
    isSubmitDisabled,
    handleStarClick,
    handleStarMouseEnter,
    handleStarMouseLeave,
    handleCommentChange,
    handleClose,
  } = useFeedbackModal({
    isOpen,
    initialRating,
    initialComment,
    isLoading,
    onClose,
  })

  if (!isOpen) return null

  return (
    <ModalShell
      isOpen={isOpen}
      title={FEEDBACK_MODAL_STRINGS.TITLE}
      onClose={handleClose}
      isLoading={isLoading}
      dataTestId="feedback-modal-backdrop"
      className="feedback-modal-shell"
    >
      <div className="feedback-modal-content" data-testid="feedback-modal-content">
        {/* Rating Section */}
        <div className="feedback-modal-section feedback-rating-section">
          <label className="feedback-modal-label" data-testid="feedback-rating-label">
            Please rate your experience<span className="feedback-required-asterisk">*</span>
          </label>

          <div className="feedback-stars-row" onMouseLeave={handleStarMouseLeave}>
            <div
              className="feedback-stars-icons"
              data-testid="feedback-stars-container"
              aria-label={`${effectiveRating} out of 5 stars`}
            >
              {Array.from({ length: MAX_FEEDBACK_RATING }, (_, index) => {
                const starIndex = index + 1
                const isFilled = starIndex <= effectiveRating
                return (
                  <button
                    key={starIndex}
                    type="button"
                    className="feedback-star-btn"
                    onClick={() => handleStarClick(starIndex)}
                    onMouseEnter={() => handleStarMouseEnter(starIndex)}
                    data-testid={`feedback-star-${starIndex}`}
                    aria-label={`Rate ${starIndex} star${starIndex > 1 ? 's' : ''}`}
                  >
                    <img
                      src={isFilled ? starIcon : starBlankIcon}
                      alt=""
                      aria-hidden="true"
                      className={`feedback-star-icon ${isFilled ? 'feedback-star-icon--filled' : 'feedback-star-icon--blank'}`}
                    />
                  </button>
                )
              })}
            </div>
            <span className="feedback-stars-text" data-testid="feedback-stars-text">
              {effectiveRating}/5 stars
            </span>
          </div>
        </div>

        {/* Comment Section */}
        <div className="feedback-modal-section feedback-comment-section">
          <label className="feedback-modal-label" htmlFor="feedback-comment-input" data-testid="feedback-comment-label">
            {FEEDBACK_MODAL_STRINGS.COMMENT_LABEL}
          </label>
          <div className={`feedback-comment-container${isAtCharLimit ? ' feedback-comment-container--at-limit' : ''}`}>
            <textarea
              id="feedback-comment-input"
              className="feedback-comment-textarea"
              placeholder={FEEDBACK_MODAL_STRINGS.COMMENT_PLACEHOLDER}
              data-testid="feedback-comment-input"
              rows={4}
              value={comment}
              onChange={(e) => handleCommentChange(e.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
            />
            <div
              className={`feedback-char-counter${isAtCharLimit ? ' feedback-char-counter--at-limit' : ''}`}
              data-testid="feedback-char-counter"
            >
              {charCount}/{MAX_COMMENT_LENGTH}
            </div>
          </div>

          {/* Low Rating Warning Banner */}
          {showLowRatingWarning && (
            <div
              className="feedback-warning-message"
              data-testid="feedback-low-rating-warning"
              role="alert"
            >
              {FEEDBACK_MODAL_STRINGS.LOW_RATING_WARNING}
            </div>
          )}
        </div>

        {/* Action Buttons Footer — isSubmitDisabled already includes isLoading from hook */}
        <div className="feedback-modal-actions">
          <Button
            variant="outline"
            fullWidth={false}
            onClick={handleClose}
            data-testid="feedback-cancel-btn"
            disabled={isLoading}
          >
            {FEEDBACK_MODAL_STRINGS.CANCEL_BTN}
          </Button>
          <Button
            variant="primary"
            fullWidth={false}
            disabled={isSubmitDisabled}
            onClick={() => onSubmit?.(rating, comment)}
            data-testid="feedback-submit-btn"
          >
            {FEEDBACK_MODAL_STRINGS.SUBMIT_BTN}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
