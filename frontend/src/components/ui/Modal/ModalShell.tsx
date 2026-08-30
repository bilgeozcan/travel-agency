import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import closeIcon from '@/assets/icons/Close.svg'
import './ModalShell.css'

export interface ModalShellProps {
  isOpen: boolean
  title: string
  onClose: () => void
  isLoading?: boolean
  children: React.ReactNode
  className?: string
  maxWidth?: string
  dataTestId?: string
}

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  title,
  onClose,
  isLoading = false,
  children,
  className = '',
  maxWidth,
  dataTestId = 'modal-backdrop',
}) => {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose()
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isLoading, onClose])

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose()
    }
  }

  const modalContent = (
    <div
      className="modal-shell-backdrop"
      onClick={handleBackdropClick}
      data-testid={dataTestId}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-shell-title"
    >
      <div
        className={`modal-shell-container ${className}`}
        ref={modalRef}
        style={maxWidth ? { maxWidth } : undefined}
      >
        <div className="modal-shell-header">
          <h2 id="modal-shell-title" className="modal-shell-title">
            {title}
          </h2>
          <button
            type="button"
            className="modal-shell-close-btn"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close modal"
          >
            <img src={closeIcon} alt="" aria-hidden="true" width="24" height="24" />
          </button>
        </div>
        <div className="modal-shell-body">{children}</div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
