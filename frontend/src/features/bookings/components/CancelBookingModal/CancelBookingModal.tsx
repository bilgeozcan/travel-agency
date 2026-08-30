import React from 'react'
import { ModalShell } from '@/components/ui/Modal/ModalShell'
import type { CancelBookingModalProps } from './CancelBookingModal.types'
import { CustomerCancelModalBody } from './CustomerCancelModalBody'
import { AgentCancelModalBody } from './AgentCancelModalBody'
import './CancelBookingModal.css'

export type { CancelBookingModalProps }

export const CancelBookingModal: React.FC<CancelBookingModalProps> = ({
  isOpen,
  mode = 'customer',
  tourTitle,
  location,
  startDate,
  durationDays,
  mealPlan,
  guestsText,
  tourType,
  isLoading = false,
  isPolicyLoading = false,
  freeCancellationUntilDate,
  freeCancellationUntilDays,
  customerName,
  customerEmail,
  guestsCount,
  onClose,
  onConfirmCancel,
}) => {
  const isAgentMode = mode === 'agent'

  return (
    <ModalShell
      isOpen={isOpen}
      title="Cancel"
      onClose={onClose}
      isLoading={isLoading}
      dataTestId="cancel-booking-backdrop"
      className={isAgentMode ? 'cancel-booking-modal-shell--agent' : ''}
    >
      {isAgentMode ? (
        <AgentCancelModalBody
          tourTitle={tourTitle}
          location={location}
          startDate={startDate}
          durationDays={durationDays}
          mealPlan={mealPlan}
          guestsText={guestsText}
          tourType={tourType}
          customerName={customerName}
          customerEmail={customerEmail}
          guestsCount={guestsCount}
          isLoading={isLoading}
          onClose={onClose}
          onConfirmCancel={onConfirmCancel}
        />
      ) : (
        <CustomerCancelModalBody
          tourTitle={tourTitle}
          startDate={startDate}
          durationDays={durationDays}
          mealPlan={mealPlan}
          guestsText={guestsText}
          freeCancellationUntilDate={freeCancellationUntilDate}
          freeCancellationUntilDays={freeCancellationUntilDays}
          isPolicyLoading={isPolicyLoading}
          isLoading={isLoading}
          onClose={onClose}
          onConfirmCancel={() => onConfirmCancel()}
        />
      )}
    </ModalShell>
  )
}
