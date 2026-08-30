import { useEffect, useRef, useState } from 'react'
import type { BookingModalInitialSelection } from '../components/BookingModal/BookingModal'
import { useTourPrice } from '@/features/tours/hooks/useTourPrice'
import type { MealPlanCode, TourDetail } from '@/features/tours/types/tours'
import {
  calculateEndDate,
  formatTourDateRange,
  formatTourStartDate,
  MEAL_PLAN_OPTIONS,
} from '@/utils/toursValidation'

export function useBookingSelection(
  tour: TourDetail,
  initialSelection?: BookingModalInitialSelection
) {
  const availableMealPlans = tour.availableMealPlans ?? []
  const allowedDurations = tour.allowedDurations ?? []
  const availableStartDates = tour.availableStartDates ?? []

  const todayStr = new Date().toISOString().slice(0, 10)
  const firstFutureDate =
    availableStartDates.find((d) => d >= todayStr) ?? availableStartDates[0] ?? ''

  const [startDate, setStartDate] = useState(
    initialSelection?.startDate ?? firstFutureDate
  )
  const [duration, setDuration] = useState(
    initialSelection?.duration ?? allowedDurations[0] ?? 0
  )
  const [mealPlan, setMealPlan] = useState<MealPlanCode>(
    initialSelection?.mealPlan ?? availableMealPlans[0] ?? ('' as MealPlanCode)
  )
  const [adultsCount, setAdultsCount] = useState(initialSelection?.adults ?? 1)
  const [childrenCount, setChildrenCount] = useState(initialSelection?.children ?? 0)

  // Sync state only when initialSelection changes upon modal opening
  const initialSelectionRef = useRef(initialSelection)
  useEffect(() => {
    if (initialSelection && initialSelection !== initialSelectionRef.current) {
      initialSelectionRef.current = initialSelection
      if (initialSelection.startDate) setStartDate(initialSelection.startDate)
      if (initialSelection.duration) setDuration(initialSelection.duration)
      if (initialSelection.mealPlan) setMealPlan(initialSelection.mealPlan)
      if (initialSelection.adults !== undefined) setAdultsCount(initialSelection.adults)
      if (initialSelection.children !== undefined) setChildrenCount(initialSelection.children)
    }
  }, [initialSelection])

  const totalGuests = adultsCount + childrenCount
  const calculatedEndDate = calculateEndDate(startDate, duration)

  const totalPrice = useTourPrice({
    basePricePerPerson: tour.basePricePerPerson,
    numberOfTourists: totalGuests,
    durationDays: duration,
    mealPlan,
    mealSupplementsPerDay: tour.mealSupplementsPerDay,
    pricesByDuration: tour.pricesByDuration,
  })

  const durationOptions = allowedDurations.map((d) => ({
    id: String(d),
    label: `${d} days`,
    value: String(d),
  }))

  const mealPlanOptions = availableMealPlans.map((code) => ({
    label: MEAL_PLAN_OPTIONS.find((opt) => opt.value === code)?.label ?? code,
    value: code,
  }))

  const dateRangeFormatted = calculatedEndDate
    ? formatTourDateRange(startDate, calculatedEndDate)
    : formatTourStartDate(startDate)

  const dateDurationDisplayValue =
    startDate && duration ? `${dateRangeFormatted}, ${duration} days` : ''

  return {
    startDate,
    setStartDate,
    duration,
    setDuration,
    mealPlan,
    setMealPlan,
    adultsCount,
    setAdultsCount,
    childrenCount,
    setChildrenCount,
    totalGuests,
    calculatedEndDate,
    totalPrice,
    durationOptions,
    mealPlanOptions,
    dateDurationDisplayValue,
  }
}
