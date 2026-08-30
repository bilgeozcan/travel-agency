import React from 'react'
import { CheckboxListPopover } from '@/components/ui/CheckboxListPopover/CheckboxListPopover'
import type { MealPlanCode } from '@/features/tours/types/tours'
import { MEAL_PLAN_OPTIONS } from '@/utils/toursValidation'
import './MealDropdownPopover.css'

export interface MealOptionItem {
  value: MealPlanCode
  label: string
}

export const MEAL_OPTIONS_LIST: MealOptionItem[] = MEAL_PLAN_OPTIONS

export interface MealDropdownPopoverProps {
  isOpen: boolean
  selectedMealPlans: MealPlanCode[]
  onToggleMealPlan: (val: MealPlanCode) => void
  onClose: () => void
}

export const MealDropdownPopover: React.FC<MealDropdownPopoverProps> = ({
  isOpen,
  selectedMealPlans,
  onToggleMealPlan,
  onClose,
}) => {
  return (
    <CheckboxListPopover<MealPlanCode>
      isOpen={isOpen}
      options={MEAL_OPTIONS_LIST}
      selectedValues={selectedMealPlans}
      onToggleOption={onToggleMealPlan}
      onClose={onClose}
      className="meal-dropdown-popover"
      testId="meal-dropdown-popover"
    />
  )
}
