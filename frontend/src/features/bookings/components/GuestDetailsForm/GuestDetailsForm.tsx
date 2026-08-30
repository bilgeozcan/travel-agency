import React from 'react'
import { InputField } from '@/components/ui/InputField/InputField'
import type { GuestDetailsFormProps } from './GuestDetailsForm.types'
import './GuestDetailsForm.css'

export type { GuestDetailsFormProps }

export const GuestDetailsForm: React.FC<GuestDetailsFormProps> = ({
  guestDetails,
  errors,
  onGuestInputChange,
  isPrimaryGuestReadOnly = false,
}) => {
  return (
    <div className="booking-modal-customers-container">
      {guestDetails.map((guest, idx) => {
        const isReadOnly = isPrimaryGuestReadOnly && idx === 0

        return (
          <div className="booking-modal-customer-section" key={idx}>
            <h3 className="booking-modal-section-title">
              Personal Details (Customer {idx + 1})
              {isReadOnly && <span className="booking-modal-locked-badge"> (Locked)</span>}
            </h3>
            <div className="booking-modal-personal-grid">
              <InputField
                label="First Name"
                type="text"
                placeholder="Enter first name"
                helperText="e.g. Johnson"
                value={guest.firstName}
                onChange={(e) => onGuestInputChange(idx, 'firstName', e.target.value)}
                id={`customer-${idx + 1}-first-name`}
                error={errors[`customer_${idx}_firstName`]}
                readOnly={isReadOnly}
                disabled={isReadOnly}
              />
              <InputField
                label="Last Name"
                type="text"
                placeholder="Enter last name"
                helperText="e.g. Doe"
                value={guest.lastName}
                onChange={(e) => onGuestInputChange(idx, 'lastName', e.target.value)}
                id={`customer-${idx + 1}-last-name`}
                error={errors[`customer_${idx}_lastName`]}
                readOnly={isReadOnly}
                disabled={isReadOnly}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
