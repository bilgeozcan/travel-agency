import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { toursService } from '@/api/services/tours.service'
import type { ReviewSortOption } from '@/features/tours/types/tours'

export function useTourReviews(tourId: string | undefined, sort: ReviewSortOption, page: number = 1, pageSize: number = 4) {
  return useQuery({
    queryKey: ['tour-reviews', tourId, sort, page, pageSize],
    queryFn: () => toursService.getTourReviews(tourId as string, sort, page, pageSize),
    placeholderData: keepPreviousData,
    enabled: Boolean(tourId),
  })
}
