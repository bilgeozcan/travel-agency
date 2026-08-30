import React, { useEffect } from 'react'
import successCheckIcon from '../../../assets/icons/success-check.svg'
import closeIcon from '../../../assets/icons/Close.svg'
import './Toast.css'

export interface ToastProps {
  title?: string
  message: string
  type?: 'success' | 'error'
  onClose?: () => void
  duration?: number
}

export const Toast: React.FC<ToastProps> = ({
  title,
  message,
  type = 'success',
  onClose,
  duration = 5000,
}) => {
  const isSuccess = type === 'success'

  useEffect(() => {
    if (!onClose || duration <= 0) return

    const timeoutId = window.setTimeout(onClose, duration)
    return () => window.clearTimeout(timeoutId)
  }, [onClose, duration])

  let displayTitle = title
  let displayMessage = message

  if (!displayTitle) {
    if (isSuccess && message.startsWith('Congratulations.')) {
      displayTitle = 'Congratulations'
      displayMessage = message.slice('Congratulations.'.length).trim()
    } else if (isSuccess) {
      displayTitle = 'Success'
    } else {
      displayTitle = 'Error'
    }
  }

  return (
    <div
      className={`toast ${isSuccess ? 'toast-success' : 'toast-error'}`}
      role={isSuccess ? 'status' : 'alert'}
      aria-live="polite"
    >
      <div className="toast-icon-wrapper">
        {isSuccess ? (
          <img src={successCheckIcon} alt="" className="toast-icon" />
        ) : (
          <svg
            className="toast-icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-error)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </div>

      <div className="toast-content">
        {displayTitle && <div className="toast-title">{displayTitle}</div>}
        <div className="toast-message">{displayMessage}</div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="toast-close"
          aria-label="Close notification"
        >
          <img src={closeIcon} alt="Close" className="toast-close-icon" />
        </button>
      )}
    </div>
  )
}
