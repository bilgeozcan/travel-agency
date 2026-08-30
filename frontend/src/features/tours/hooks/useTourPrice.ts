import { useMemo } from 'react'
import type { MealPlanCode } from '@/features/tours/types/tours'
import { calculateTourPrice } from '@/utils/toursValidation'

export interface UseTourPriceParams {
  basePricePerPerson: number
  numberOfTourists: number
  durationDays: number
  mealPlan: MealPlanCode | string
  mealSupplementsPerDay?: Record<string, number>
  pricesByDuration?: Record<string, number>
}

/**
 * Custom hook to synchronously calculate total tour price based on selected options.
 */
export function useTourPrice(params: UseTourPriceParams): number {
  return useMemo(() => {
    return calculateTourPrice({
      basePricePerPerson: params.basePricePerPerson,
      numberOfTourists: params.numberOfTourists,
      durationDays: params.durationDays,
      mealPlan: params.mealPlan,
      mealSupplementsPerDay: params.mealSupplementsPerDay,
      pricesByDuration: params.pricesByDuration,
    })
  }, [
    params.basePricePerPerson,
    params.numberOfTourists,
    params.durationDays,
    params.mealPlan,
    params.mealSupplementsPerDay,
    params.pricesByDuration,
  ])
}
