import React from 'react'
import { Button } from '@/components/ui/Button/Button'
import './ErrorState.css'

export interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
  testId?: string
  className?: string
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to load tours',
  message = "We couldn't connect to our tour catalog right now. Please check your connection or try again.",
  onRetry,
  retryLabel = 'Retry',
  testId = 'tours-error',
  className = '',
}) => {
  return (
    <div className={`error-state-card ${className}`} data-testid={testId} role="alert">
      <h3 className="error-state-title">{title}</h3>
      <p className="error-state-message">{message}</p>
      {onRetry && (
        <Button
          variant="primary"
          onClick={onRetry}
          data-testid={testId === 'tours-error' ? 'tours-retry-btn' : `${testId}-retry-btn`}
          className="error-state-retry-btn"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  )
}
