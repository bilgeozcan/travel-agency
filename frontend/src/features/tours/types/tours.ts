// Tour Interfaces & Types (US_4.1 & US_4.2)

export type MealPlanCode = 'BB' | 'HB' | 'FB' | 'AI'
export type ResortTypeCode = 'RESORT' | 'CRUISE' | 'HIKE'
export type TourSortOption = 'RATING_DESC' | 'RATING_ASC' | 'PRICE_DESC' | 'PRICE_ASC'

export interface GuestQuantity {
  adults: number
  children: number
}

export interface TourItem {
  id: string
  name: string
  destination: string
  startDate: string
  endDate?: string
  imageUrl?: string
  durations: string[]
  mealPlans: string[]
  price: string
  rating: number
  reviews: number
  freeCancelation?: string | null
  tourType?: ResortTypeCode
  isFullyBooked?: boolean
  maxGuests?: number
}

export interface TourFilterParams {
  page?: number
  pageSize?: number
  destination?: string
  startDate?: string
  endDate?: string
  duration?: string
  adults?: number
  children?: number
  mealPlans?: (MealPlanCode | string)[]
  mealPlan?: string | (MealPlanCode | string)[]
  tourTypes?: (ResortTypeCode | string)[]
  tourType?: string | (ResortTypeCode | string)[]
  sortBy?: TourSortOption
}

export interface TourListResponse {
  tours: TourItem[]
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
}

export interface DestinationListResponse {
  destinations: string[]
}

export interface TourDetail {
  id: string
  title: string
  hotelName: string
  hotelDescription: string
  rating: number
  reviewsCount: number
  heroImages: string[]
  basePricePerPerson: number
  availableStartDates: string[]
  allowedDurations: number[]
  maxParticipants: number
  adultsMax?: number
  childrenMax?: number
  totalMax?: number
  availableMealPlans: MealPlanCode[]
  cancellationPolicy: {
    freeCancellationUntilDays: number
    description: string
  }
  accommodationDescription: string
  guideLanguages: string[]
  transferInfo: string
  isFullyBooked: boolean
  destination?: string
  mealSupplementsPerDay?: Record<string, number>
  pricesByDuration?: Record<string, number>
  tourType?: ResortTypeCode
}

export type ReviewSortOption = 'TOP_RATED' | 'LOW_RATED' | 'NEWEST' | 'OLDEST'

export interface TourReview {
  id: string
  authorName: string
  authorAvatar?: string
  rating: number
  date: string
  comment: string
}

export interface TourReviewsResponse {
  reviews: TourReview[]
  page?: number
  pageSize?: number
  totalPages?: number
  totalItems?: number
}
