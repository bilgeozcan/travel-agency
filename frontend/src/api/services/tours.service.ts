import { apiClient } from '../client/apiClient'
import type {
  DestinationListResponse,
  ReviewSortOption,
  TourDetail,
  TourFilterParams,
  TourListResponse,
  TourReviewsResponse,
} from '@/features/tours/types/tours'
import { mapBackendReviewToFrontend, mapBackendTourDetailsToFrontend } from '../mappers/tours.mapper'

/**
 * Builds clean URL query string from TourFilterParams using native URLSearchParams.
 */
function buildQueryString(params: TourFilterParams): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'Any destination') {
      return
    }

    let queryKey = key
    if (key === 'mealPlans') queryKey = 'mealPlan'
    if (key === 'tourTypes') queryKey = 'tourType'

    if (Array.isArray(value)) {
      if (value.length > 0) {
        searchParams.append(queryKey, value.join(','))
      }
      return
    }
    if (typeof value === 'object') {
      if (key === 'guestQuantity' && value) {
        if ('adults' in value) searchParams.append('adults', String(value.adults))
        if ('children' in value) searchParams.append('children', String(value.children))
      }
      return
    }
    searchParams.append(queryKey, String(value))
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

export const toursService = {
  async getAvailableTours(params: TourFilterParams = {}): Promise<TourListResponse> {
    const queryString = buildQueryString(params)
    const res = await apiClient.get<TourListResponse>(`/tours/available${queryString}`)

    if (res?.data && Array.isArray(res.data.tours)) {
      const tours = res.data.tours.map((t: any) => ({
        ...t,
        imageUrl:
          t.imageUrl ||
          (Array.isArray(t.imageUrls) ? t.imageUrls[0] : undefined) ||
          (Array.isArray(t.images) ? t.images[0] : undefined),
      }))
      return {
        ...res.data,
        tours,
      }
    }

    return {
      tours: [],
      page: 1,
      pageSize: 6,
      totalPages: 0,
      totalItems: 0,
    }
  },

  async getDestinations(query: string): Promise<DestinationListResponse> {
    const trimmedQuery = query ? query.trim() : ''
    if (!trimmedQuery || trimmedQuery.length < 3) {
      return { destinations: [] }
    }

    const res = await apiClient.get<DestinationListResponse>(
      `/tours/destinations?destination=${encodeURIComponent(trimmedQuery)}`
    )
    if (res?.data && Array.isArray(res.data.destinations)) {
      return res.data
    }

    return { destinations: [] }
  },

  async getTourById(tourId: string): Promise<TourDetail> {
    const res = await apiClient.get<any>(`/tours/${tourId}`)

    if (res?.data) {
      return mapBackendTourDetailsToFrontend(res.data, tourId)
    }
    throw new Error(`Tour with ID '${tourId}' not found`)
  },

  async getTourReviews(
    tourId: string,
    sort: ReviewSortOption = 'TOP_RATED',
    page: number = 1,
    pageSize: number = 4
  ): Promise<TourReviewsResponse> {
    const sortByMap: Record<ReviewSortOption, string> = {
      TOP_RATED: 'RATING_DESC',
      LOW_RATED: 'RATING_ASC',
      NEWEST: 'NEWEST',
      OLDEST: 'OLDEST',
    }
    const sortBy = sortByMap[sort] || 'RATING_DESC'

    const res = await apiClient.get<any>(
      `/tours/${tourId}/reviews?sortBy=${sortBy}&page=${page}&pageSize=${pageSize}`
    )
    if (res?.data && Array.isArray(res.data.reviews)) {
      const mappedReviews = res.data.reviews.map((r: any, idx: number) => mapBackendReviewToFrontend(r, idx))
      return {
        reviews: mappedReviews,
        page: res.data.page ?? page,
        pageSize: res.data.pageSize ?? pageSize,
        totalPages: res.data.totalPages ?? 0,
        totalItems: res.data.totalItems ?? mappedReviews.length,
      }
    }

    return { reviews: [], page: 1, pageSize: 4, totalPages: 0, totalItems: 0 }
  },
}
