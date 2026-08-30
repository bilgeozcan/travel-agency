import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { toursService } from '@/api/services/tours.service'
import type { TourFilterParams, TourListResponse, TourSortOption } from '@/features/tours/types/tours'

export function useAvailableTours(params: TourFilterParams = {}, sortBy?: TourSortOption) {
  const mergedParams: TourFilterParams = {
    ...params,
    ...(sortBy ? { sortBy } : {}),
  }

  return useQuery<TourListResponse>({
    queryKey: ['available-tours', mergedParams],
    queryFn: () => toursService.getAvailableTours(mergedParams),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  })
}

