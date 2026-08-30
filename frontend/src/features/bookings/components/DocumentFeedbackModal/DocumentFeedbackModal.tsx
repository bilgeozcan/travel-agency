import React, { useState } from 'react'
import { ModalShell } from '@/components/ui/Modal/ModalShell'
import { Button } from '@/components/ui/Button/Button'
import type { DocumentFeedbackModalProps } from './DocumentFeedbackModal.types'
import './DocumentFeedbackModal.css'

export type { DocumentFeedbackModalProps }

export const DocumentFeedbackModal: React.FC<DocumentFeedbackModalProps> = ({
  isOpen,
  booking,
  isLoading = false,
  onClose,
  onSubmitFeedback,
}) => {
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!booking || !isOpen) return null

  const isBusy = isLoading || isSubmitting
  const isSendDisabled = !comment.trim() || isBusy

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSendDisabled) return

    try {
      setIsSubmitting(true)
      await onSubmitFeedback(booking.id, comment.trim())
      setComment('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      title=""
      onClose={onClose}
      isLoading={isBusy}
      dataTestId="doc-feedback-modal-backdrop"
      className="doc-feedback-modal-shell"
    >
      <form
        className="doc-feedback-modal-content"
        onSubmit={handleSubmit}
        data-testid="doc-feedback-modal-content"
      >
        <h3 className="doc-feedback-modal-heading" data-testid="doc-feedback-heading">
          Please report what is wrong with the documents
        </h3>

        <div className="doc-feedback-field">
          <textarea
            id="doc-feedback-comment"
            className="doc-feedback-textarea"
            placeholder="Specify missing, unclear, or invalid document details..."
            rows={5}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={isBusy}
            data-testid="doc-feedback-textarea"
          />
        </div>

        <div className="doc-feedback-actions">
          <Button
            type="submit"
            variant="primary"
            fullWidth={false}
            disabled={isSendDisabled}
            isLoading={isBusy}
            loadingText="Sending..."
            data-testid="send-doc-feedback-button"
          >
            Send
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
