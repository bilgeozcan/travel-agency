import React from 'react'
import { PendingEditsModal } from '../PendingEditsModal/PendingEditsModal'
import { Toast } from '@/components/ui/Toast/Toast'
import { usePendingEditsNotification } from '../../hooks/usePendingEditsNotification'

/**
 * Global pending edits notification component.
 * Renders the PendingEditsModal and Toast for authenticated customers
 * regardless of which page they are on.
 * Should be placed at the AppRouter level, outside <Routes>.
 */
export const PendingEditsNotification: React.FC = () => {
  const {
    activePendingBooking,
    toastConfig,
    clearToast,
    handleDismiss,
    handleConfirm,
    handleDecline,
  } = usePendingEditsNotification()

  return (
    <>
      {toastConfig && (
        <Toast
          type={toastConfig.type}
          message={toastConfig.message}
          onClose={clearToast}
        />
      )}

      {activePendingBooking && (
        <PendingEditsModal
          isOpen={Boolean(activePendingBooking)}
          booking={activePendingBooking}
          onClose={() => handleDismiss(activePendingBooking)}
          onConfirmEdit={handleConfirm}
          onDeclineEdit={handleDecline}
        />
      )}
    </>
  )
}
