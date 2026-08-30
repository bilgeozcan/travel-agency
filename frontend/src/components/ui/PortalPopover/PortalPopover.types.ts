import type React from 'react'
import type { PopoverCoords } from '@/hooks/usePortalPopover'

export interface PortalPopoverProps {
  isOpen: boolean
  coords: PopoverCoords
  portalRef: React.RefObject<HTMLDivElement | null>
  children: React.ReactNode
  className?: string
}
