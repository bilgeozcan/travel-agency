import { useQuery } from '@tanstack/react-query'
import { toursService } from '@/api/services/tours.service'
import type { TourDetail } from '@/features/tours/types/tours'

export function useTourDetails(tourId: string | undefined) {
  return useQuery<TourDetail>({
    queryKey: ['tour-details', tourId],
    queryFn: () => toursService.getTourById(tourId as string),
    enabled: Boolean(tourId),
    retry: false,
  })
}

