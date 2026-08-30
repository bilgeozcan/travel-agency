import type { SelectOption } from '@/components/ui/Select/Select'
import type { MealPlanCode } from '@/features/tours/types/tours'
import type { PopoverCoords } from '@/hooks/usePortalPopover'

export interface BookingModalTourSectionProps {
  dateDurationDisplayValue: string
  isDateDurationOpen: boolean
  dateContainerRef: React.RefObject<HTMLDivElement | null>
  datePortalRef: React.RefObject<HTMLDivElement | null>
  dateAnchorPos: PopoverCoords
  startDate: string
  calculatedEndDate?: string
  duration: number
  availableStartDates: string[]
  durationOptions: Array<{ id?: string; value: string; label: string }>
  onToggleDateDuration: () => void
  onCloseDateDuration: () => void
  onSelectStartDate: (date: string) => void
  onSelectDuration: (duration: number) => void

  guestsDisplayValue: string
  isGuestsOpen: boolean
  guestsContainerRef: React.RefObject<HTMLDivElement | null>
  guestsPortalRef: React.RefObject<HTMLDivElement | null>
  guestsAnchorPos: PopoverCoords
  adultsCount: number
  childrenCount: number
  adultsMax?: number
  childrenMax?: number
  totalMax?: number
  onToggleGuests: () => void
  onCloseGuests: () => void
  onChangeAdults: (value: number) => void
  onChangeChildren: (value: number) => void

  mealPlan: MealPlanCode
  mealPlanOptions: SelectOption[]
  onChangeMealPlan: (value: MealPlanCode) => void
}
