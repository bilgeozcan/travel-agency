import React from 'react'
import { createPortal } from 'react-dom'
import type { PortalPopoverProps } from './PortalPopover.types'

export type { PortalPopoverProps }

export const PortalPopover: React.FC<PortalPopoverProps> = ({
  isOpen,
  coords,
  portalRef,
  children,
  className = 'booking-popover-portal',
}) => {
  if (!isOpen) return null

  return createPortal(
    <div
      className={className}
      ref={portalRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={
        {
          '--popover-top': `${coords.top}px`,
          '--popover-left': `${coords.left}px`,
          '--popover-width': `${coords.width}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>,
    document.body
  )
}
