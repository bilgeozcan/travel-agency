import React from 'react'
import { CheckboxListPopover } from '@/components/ui/CheckboxListPopover/CheckboxListPopover'
import type { ResortTypeCode } from '@/features/tours/types/tours'
import { RESORT_TYPE_OPTIONS } from '@/utils/toursValidation'
import './TourTypeDropdownPopover.css'

export interface TourTypeOptionItem {
  value: ResortTypeCode
  label: string
}

export const TOUR_TYPE_OPTIONS_LIST: TourTypeOptionItem[] = RESORT_TYPE_OPTIONS

export interface TourTypeDropdownPopoverProps {
  isOpen: boolean
  selectedTourTypes: ResortTypeCode[]
  onToggleTourType: (val: ResortTypeCode) => void
  onClose: () => void
}

export const TourTypeDropdownPopover: React.FC<TourTypeDropdownPopoverProps> = ({
  isOpen,
  selectedTourTypes,
  onToggleTourType,
  onClose,
}) => {
  return (
    <CheckboxListPopover<ResortTypeCode>
      isOpen={isOpen}
      options={TOUR_TYPE_OPTIONS_LIST}
      selectedValues={selectedTourTypes}
      onToggleOption={onToggleTourType}
      onClose={onClose}
      className="tour-type-dropdown-popover"
      testId="tour-type-dropdown-popover"
    />
  )
}
