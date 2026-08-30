import React from 'react'
import personIcon from '@/assets/icons/Person.svg'
import emailIcon from '@/assets/icons/email.svg'
import phoneIcon from '@/assets/icons/phone.svg'
import messengerIcon from '@/assets/icons/Messenger.png'
import type { TravelAgentContact } from '@/features/bookings/types/bookings'

export interface TravelAgentInfoSectionProps {
  travelAgent?: TravelAgentContact
}

export const TravelAgentInfoSection: React.FC<TravelAgentInfoSectionProps> = ({ travelAgent }) => {
  return (
    <div className="tour-booking-col">
      <span className="col-heading">Travel agent</span>
      {travelAgent ? (
        <div className="info-list">
          <div className="info-item">
            <img src={personIcon} alt="" aria-hidden="true" width="14" height="14" />
            <span>{travelAgent.name}</span>
          </div>
          <div className="info-item">
            <img src={emailIcon} alt="" aria-hidden="true" width="14" height="14" />
            <span>{travelAgent.email}</span>
          </div>
          <div className="info-item">
            <img src={phoneIcon} alt="" aria-hidden="true" width="14" height="14" />
            <span>{travelAgent.phone}</span>
          </div>
          <div className="info-item">
            <img src={messengerIcon} alt="" aria-hidden="true" width="14" height="14" />
            {travelAgent.messenger && travelAgent.messenger !== '#' ? (
              <a href={travelAgent.messenger} target="_blank" rel="noreferrer" className="messenger-link">
                Messenger
              </a>
            ) : (
              <span>N/A</span>
            )}
          </div>
        </div>
      ) : (
        <span className="text-secondary">Not assigned</span>
      )}
    </div>
  )
}
