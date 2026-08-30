import React, { useMemo, useState } from 'react'
import { Pagination } from '@/components/ui/Pagination/Pagination'
import { Select } from '@/components/ui/Select/Select'
import { ReviewCard } from '@/features/tours/components/ReviewCard/ReviewCard'
import { useTourReviews } from '@/features/tours/hooks/useTourReviews'
import type { ReviewSortOption } from '@/features/tours/types/tours'
import './ReviewsSection.css'

export interface ReviewsSectionProps {
  tourId: string
}

const SORT_OPTIONS: { label: string; value: ReviewSortOption }[] = [
  { label: 'Top rated first', value: 'TOP_RATED' },
  { label: 'Low rated first', value: 'LOW_RATED' },
  { label: 'Newest first', value: 'NEWEST' },
  { label: 'Oldest first', value: 'OLDEST' },
]

const PAGE_SIZE = 4

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({ tourId }) => {
  const [sort, setSort] = useState<ReviewSortOption>('TOP_RATED')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useTourReviews(tourId, sort, page, PAGE_SIZE)
  const reviews = useMemo(() => data?.reviews ?? [], [data])
  const totalPages = data?.totalPages ?? 0

  const handleSortChange = (value: string) => {
    setSort(value as ReviewSortOption)
    setPage(1)
  }

  return (
    <section className="reviews-section" data-testid="reviews-section">
      <div className="reviews-section__header">
        <h2 className="text-title">Customer Reviews</h2>
        <div className="sort-by-wrapper">
          <Select
            label="Sort by:"
            options={SORT_OPTIONS}
            value={sort}
            onChange={handleSortChange}
            id="reviews-sort-by"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="reviews-section__status">Loading reviews...</p>
      ) : isError ? (
        <p className="reviews-section__status reviews-section__status--error" data-testid="reviews-error">
          Reviews could not be loaded
        </p>
      ) : reviews.length === 0 ? (
        <div className="reviews-section__empty card" data-testid="reviews-empty">
          <p>No reviews about this trip yet</p>
        </div>
      ) : (
        <>
          <div className="reviews-section__grid">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="reviews-section__pagination-wrapper">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </section>
  )
}
