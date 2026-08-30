import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Select } from '@/components/ui/Select/Select'
import { Toast } from '@/components/ui/Toast/Toast'
import { ErrorState } from '@/components/ui/ErrorState/ErrorState'
import { PageLoader } from '@/components/ui/PageLoader/PageLoader'
import { Pagination } from '@/components/ui/Pagination/Pagination'
import type { TourFilterParams, TourItem, TourSortOption } from '@/features/tours/types/tours'
import { extractUniqueDestinations, TOUR_SORT_OPTIONS } from '@/utils/toursValidation'
import { AuthRequiredPopup } from '@/features/tours/components/AuthRequiredPopup/AuthRequiredPopup'
import { TourCard } from '@/features/tours/components/TourCard/TourCard'
import { ToursFilterPanel } from '@/features/tours/components/ToursFilterPanel/ToursFilterPanel'
import { useAvailableTours } from '@/features/tours/hooks/useAvailableTours'
import './AllToursPage.css'

export interface AllToursPageProps {
  isAuthenticated?: boolean
  onNavigateToSignIn?: () => void
  onNavigateToCreateAccount?: () => void
  onSelectTour?: (tour: TourItem) => void
  onBookTour?: (tour: TourItem) => void
}

const SORT_OPTIONS = TOUR_SORT_OPTIONS
const SEARCH_STORAGE_KEY = 'travel_agency_tour_search_state'

interface SavedSearchState {
  currentFilters: TourFilterParams
  sortBy: TourSortOption
  page: number
  hasSearched: boolean
}

function loadSavedSearchState(): SavedSearchState | null {
  try {
    const raw = sessionStorage.getItem(SEARCH_STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw) as SavedSearchState
    }
  } catch {
    // Ignore storage parse errors
  }
  return null
}

function saveSearchState(state: SavedSearchState) {
  try {
    sessionStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage write errors
  }
}

function clearSavedSearchState() {
  try {
    sessionStorage.removeItem(SEARCH_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

export const AllToursPage: React.FC<AllToursPageProps> = ({
  isAuthenticated = true,
  onNavigateToSignIn,
  onNavigateToCreateAccount,
  onSelectTour,
  onBookTour,
}) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const savedState = useMemo(() => loadSavedSearchState(), [])

  // Initialize filters, sort, and page from URL search params or sessionStorage
  const [currentFilters, setCurrentFilters] = useState<TourFilterParams>(() => {
    const dest = searchParams.get('destination')
    const start = searchParams.get('startDate')
    const end = searchParams.get('endDate')
    const dur = searchParams.get('duration')
    const adults = searchParams.get('adults')
    const children = searchParams.get('children')
    const meal = searchParams.get('mealPlan')
    const type = searchParams.get('tourType')

    if (dest || start || end || dur || adults || children || meal || type) {
      return {
        destination: dest || undefined,
        startDate: start || undefined,
        endDate: end || undefined,
        duration: dur || undefined,
        adults: adults ? parseInt(adults, 10) : 1,
        children: children ? parseInt(children, 10) : 0,
        mealPlan: meal || undefined,
        tourType: type || undefined,
      }
    }
    return savedState?.currentFilters ?? {}
  })

  const [sortBy, setSortBy] = useState<TourSortOption>(() => {
    const paramSort = searchParams.get('sortBy') as TourSortOption
    if (paramSort && ['RATING_DESC', 'RATING_ASC', 'PRICE_DESC', 'PRICE_ASC'].includes(paramSort)) {
      return paramSort
    }
    return savedState?.sortBy ?? 'RATING_DESC'
  })

  const [page, setPage] = useState<number>(() => {
    const paramPage = searchParams.get('page')
    if (paramPage) {
      const parsed = parseInt(paramPage, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
    return savedState?.page ?? 1
  })

  const [hasSearched, setHasSearched] = useState<boolean>(() => {
    return savedState?.hasSearched ?? Boolean(Object.keys(currentFilters).length > 0)
  })

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [isAuthPopupOpen, setIsAuthPopupOpen] = useState(false)

  // Save search state to sessionStorage and URL query params when filters change
  useEffect(() => {
    saveSearchState({ currentFilters, sortBy, page, hasSearched })

    const params = new URLSearchParams()
    if (currentFilters.destination) params.set('destination', currentFilters.destination)
    if (currentFilters.startDate) params.set('startDate', currentFilters.startDate)
    if (currentFilters.endDate) params.set('endDate', currentFilters.endDate)
    if (currentFilters.duration) params.set('duration', currentFilters.duration)
    if (currentFilters.adults && currentFilters.adults > 1) params.set('adults', String(currentFilters.adults))
    if (currentFilters.children && currentFilters.children > 0) params.set('children', String(currentFilters.children))
    if (currentFilters.mealPlan) {
      params.set('mealPlan', Array.isArray(currentFilters.mealPlan) ? currentFilters.mealPlan.join(',') : currentFilters.mealPlan)
    }
    if (currentFilters.tourType) {
      params.set('tourType', Array.isArray(currentFilters.tourType) ? currentFilters.tourType.join(',') : currentFilters.tourType)
    }
    if (sortBy !== 'RATING_DESC') params.set('sortBy', sortBy)
    if (page > 1) params.set('page', String(page))

    setSearchParams(params, { replace: true })
  }, [currentFilters, sortBy, page, hasSearched, setSearchParams])

  const activeParams = useMemo(() => ({
    ...currentFilters,
    page,
    pageSize: 6,
  }), [currentFilters, page])

  const { data: tourData, isLoading, isFetching, isError, refetch } = useAvailableTours(activeParams, sortBy)
  // Button loading spinner only activates on search refetches after initial load
  const isSearchRefetching = isFetching && Boolean(tourData)
  const tours = tourData?.tours ?? []
  const totalPages = tourData?.totalPages ?? 1

  // Computed with useMemo to avoid double re-render cycles
  const masterDestinations = useMemo(() => {
    return extractUniqueDestinations(tourData?.tours ?? [])
  }, [tourData?.tours])

  const handleFilterSearch = (filters: TourFilterParams) => {
    setHasSearched(true)
    setPage(1)
    setCurrentFilters(filters)
  }

  const handleFilterReset = () => {
    setHasSearched(false)
    setPage(1)
    setCurrentFilters({})
    setSortBy('RATING_DESC')
    clearSavedSearchState()
  }

  const handleSortChange = (newSort: string) => {
    const sortVal = newSort as TourSortOption
    setSortBy(sortVal)
    setPage(1)
  }

  const handleSeeDetails = (tour: TourItem) => {
    if (onSelectTour) {
      onSelectTour(tour)
    } else {
      setToastType('success')
      setToastMessage(`Viewing details for: ${tour.name}`)
    }
  }

  const handleBookClick = (tour: TourItem) => {
    if (!isAuthenticated) {
      setIsAuthPopupOpen(true)
      return
    }

    if (onBookTour) {
      onBookTour(tour)
    } else {
      setToastType('success')
      setToastMessage(`Selected "${tour.name}" for booking.`)
    }
  }

  return (
    <div className="all-tours-container" data-testid="all-tours-page">
      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage(null)}
        />
      )}
      <AuthRequiredPopup
        isOpen={isAuthPopupOpen}
        onClose={() => setIsAuthPopupOpen(false)}
        onSignIn={onNavigateToSignIn ?? (() => setIsAuthPopupOpen(false))}
        onCreateAccount={onNavigateToCreateAccount ?? (() => setIsAuthPopupOpen(false))}
      />

      {/* Top Filter Panel */}
      <section className="tours-filter-section">
        <ToursFilterPanel
          onSearch={handleFilterSearch}
          onReset={handleFilterReset}
          isLoading={isSearchRefetching}
          availableDestinations={masterDestinations}
          initialFilters={currentFilters}
        />
      </section>

      {/* Grid Controls & Header */}
      <div className="tours-grid-header">
        <div className="sort-by-wrapper">
          <Select
            label="Sort by:"
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={handleSortChange}
            id="tours-sort-by"
          />
        </div>
      </div>

      {/* Main Tours Grid / Empty States / Loading / API Error */}
      {isLoading && !tourData ? (
        <PageLoader label="Loading tours..." inline />
      ) : isLoading && tours.length === 0 ? (
        <div className="tours-loading-state" data-testid="tours-loading">
          <div className="loading-spinner" />
          <p>Loading available tours...</p>
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load tours"
          message="We couldn't connect to our tour catalog right now. Please check your connection or try again."
          onRetry={() => refetch()}
          retryLabel="Retry"
          testId="tours-error"
        />
      ) : tours.length > 0 ? (
        <>
          <div
            className={`tours-grid ${isSearchRefetching ? 'is-loading-overlay' : ''}`}
            data-testid="tours-grid"
          >
            {tours.map((tour: TourItem) => (
              <TourCard
                key={tour.id}
                tour={tour}
                onSeeDetails={handleSeeDetails}
                onBookTour={handleBookClick}
              />
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      ) : (
        <div className="tours-empty-state" data-testid="tours-empty">
          <div className="empty-icon">🏝️</div>
          <h3 className="empty-title">
            {hasSearched ? 'No matching tours' : 'No tours available'}
          </h3>
          <p className="empty-message">
            {hasSearched
              ? 'There are no tours with such filters, please change filters'
              : 'No tours available'}
          </p>
        </div>
      )}
    </div>
  )
}