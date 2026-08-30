import React from 'react'
import { ModalShell } from '@/components/ui/Modal/ModalShell'
import type { GuestsPopupModalProps } from './GuestsPopupModal.types'
import './GuestsPopupModal.css'

export type { GuestsPopupModalProps }

export const GuestsPopupModal: React.FC<GuestsPopupModalProps> = ({
  isOpen,
  booking,
  guests,
  onClose,
}) => {
  if (!booking || !isOpen) return null

  const effectiveGuests = guests && guests.length > 0 ? guests : booking.guests || []

  return (
    <ModalShell
      isOpen={isOpen}
      title="All Guests"
      onClose={onClose}
      dataTestId="guests-popup-backdrop"
      className="guests-popup-shell"
    >
      <div className="guests-popup-body" data-testid="guests-popup-content">
        <p className="guests-popup-subtitle">
          {effectiveGuests.length} guest{effectiveGuests.length !== 1 ? 's' : ''}
        </p>

        {effectiveGuests.length > 0 ? (
          <div className="guests-popup-list" data-testid="guests-popup-list">
            {effectiveGuests.map((guest, index) => {
              const fullName = `${guest.firstName} ${guest.lastName}`.trim() || `Guest ${index + 1}`
              const isPrimary = index === 0
              const guestKey = `${guest.firstName || 'guest'}-${guest.lastName || 'name'}-${index}`

              return (
                <div key={guestKey} className="guests-popup-item" data-testid={`guest-item-${index}`}>
                  <div className="guests-popup-name-group">
                    <span className="guests-popup-name">{fullName}</span>
                    {isPrimary && (
                      <span className="guests-popup-role-tag">Primary Customer</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="guests-popup-empty" data-testid="guests-popup-empty">
            No guest details available.
          </div>
        )}
      </div>
    </ModalShell>
  )
}
