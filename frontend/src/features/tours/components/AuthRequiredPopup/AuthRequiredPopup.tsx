import React from 'react'
import { Button } from '../../../../components/ui/Button/Button'
import { Logo } from '../../../../components/ui/Logo/Logo'
import closeIcon from '@/assets/icons/Close.svg'
import './AuthRequiredPopup.css'

interface AuthRequiredPopupProps {
  isOpen: boolean
  onClose: () => void
  onSignIn: () => void
  onCreateAccount: () => void
}

const POPUP_TEXT = {
  message: 'To book a tour please sign in or create an account',
  signIn: 'Sign in',
  createAccount: 'Create an account',
}

export const AuthRequiredPopup: React.FC<AuthRequiredPopupProps> = ({
  isOpen,
  onClose,
  onSignIn,
  onCreateAccount,
}) => {
  if (!isOpen) {
    return null
  }

  return (
    <div className="auth-required-popup-backdrop" onClick={onClose} data-testid="auth-required-popup-backdrop">
      <section
        className="auth-required-popup-card"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-required-popup-title"
        data-testid="auth-required-popup"
      >
        <div className="auth-required-popup-top">
          <div className="auth-required-popup-title-row">
            <Logo variant="blue" size="lg" className="auth-required-popup-logo" />
            <button
              type="button"
              className="auth-required-popup-close"
              onClick={onClose}
              aria-label="Close sign-in popup"
            >
              <img src={closeIcon} alt="" aria-hidden="true" width="24" height="24" />
            </button>
          </div>
          <h3 id="auth-required-popup-title" className="auth-required-popup-text">
            {POPUP_TEXT.message}
          </h3>
        </div>

        <div className="auth-required-popup-actions">
          <Button
            variant="primary"
            className="auth-required-popup-btn auth-required-popup-btn--primary"
            onClick={onSignIn}
          >
            {POPUP_TEXT.signIn}
          </Button>
          <Button
            variant="outline"
            className="auth-required-popup-btn auth-required-popup-btn--outline"
            onClick={onCreateAccount}
          >
            {POPUP_TEXT.createAccount}
          </Button>
        </div>
      </section>
    </div>
  )
}
