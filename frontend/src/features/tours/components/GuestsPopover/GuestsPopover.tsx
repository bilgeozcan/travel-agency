import React from 'react'
import './GuestsPopover.css'

export interface GuestsPopoverProps {
  isOpen: boolean
  adults: number
  childrenCount: number
  adultsMax?: number
  childrenMax?: number
  totalMax?: number
  onChangeAdults: (val: number) => void
  onChangeChildren: (val: number) => void
  onClose: () => void
}

export const GuestsPopover: React.FC<GuestsPopoverProps> = ({
  isOpen,
  adults,
  childrenCount,
  adultsMax = 10,
  childrenMax = 10,
  totalMax = 10,
  onChangeAdults,
  onChangeChildren,
  onClose: _onClose,
}) => {
  if (!isOpen) return null

  const totalCurrent = adults + childrenCount
  const canAddAdult = adults < adultsMax && totalCurrent < totalMax
  const canAddChild = childrenCount < childrenMax && totalCurrent < totalMax

  const handleMinusAdults = () => {
    if (adults > 1) {
      onChangeAdults(adults - 1)
    }
  }

  const handlePlusAdults = () => {
    if (canAddAdult) {
      onChangeAdults(adults + 1)
    }
  }

  const handleMinusChildren = () => {
    if (childrenCount > 0) {
      onChangeChildren(childrenCount - 1)
    }
  }

  const handlePlusChildren = () => {
    if (canAddChild) {
      onChangeChildren(childrenCount + 1)
    }
  }

  return (
    <div
      className="guests-popover-card"
      onClick={(e) => e.stopPropagation()}
      data-testid="guests-popover"
    >
      <div className="guests-popover-container">
        {/* Row 1: Adults */}
        <div className="guests-dropdown-item">
          <span className="guests-item-label">Adults</span>
          <div className="guests-quantity-controls">
            <button
              type="button"
              className={`counter-btn minus-btn ${adults <= 1 ? 'disabled' : ''}`}
              onClick={handleMinusAdults}
              disabled={adults <= 1}
              aria-label="Decrease adults"
            >
              −
            </button>
            <span className="counter-number-text">{adults}</span>
            <button
              type="button"
              className={`counter-btn plus-btn ${!canAddAdult ? 'disabled' : ''}`}
              onClick={handlePlusAdults}
              disabled={!canAddAdult}
              aria-label="Increase adults"
            >
              +
            </button>
          </div>
        </div>

        {/* Row 2: Children */}
        <div className="guests-dropdown-item">
          <span className="guests-item-label">Children</span>
          <div className="guests-quantity-controls">
            <button
              type="button"
              className={`counter-btn minus-btn ${childrenCount <= 0 ? 'disabled' : ''}`}
              onClick={handleMinusChildren}
              disabled={childrenCount <= 0}
              aria-label="Decrease children"
            >
              −
            </button>
            <span className="counter-number-text">{childrenCount}</span>
            <button
              type="button"
              className={`counter-btn plus-btn ${!canAddChild ? 'disabled' : ''}`}
              onClick={handlePlusChildren}
              disabled={!canAddChild}
              aria-label="Increase children"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
