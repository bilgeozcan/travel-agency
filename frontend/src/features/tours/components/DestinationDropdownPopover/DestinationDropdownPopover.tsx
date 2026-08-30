import React from 'react'
import './DestinationDropdownPopover.css'

export interface DestinationDropdownPopoverProps {
  isOpen: boolean
  destinations: string[]
  selectedValue?: string
  onSelectDestination: (dest: string) => void
  onClose?: () => void
}

export const DestinationDropdownPopover: React.FC<DestinationDropdownPopoverProps> = ({
  isOpen,
  destinations,
  selectedValue,
  onSelectDestination,
  onClose: _onClose,
}) => {
  if (!isOpen || destinations.length === 0) return null

  return (
    <div
      className="destination-dropdown-popover"
      onClick={(e) => e.stopPropagation()}
      data-testid="destination-dropdown-popover"
    >
      {destinations.map((dest, idx) => {
        const isSelected = selectedValue ? dest.toLowerCase() === selectedValue.toLowerCase() : idx === 0
        return (
          <button
            type="button"
            key={dest}
            className={`destination-dropdown-item ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectDestination(dest)}
            role="option"
            aria-selected={isSelected}
            data-testid={`destination-option-${idx}`}
          >
            <div className="destination-item-text">{dest}</div>
          </button>
        )
      })}
    </div>
  )
}
