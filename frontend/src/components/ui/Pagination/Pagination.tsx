import React from 'react'
import chevronsRightIcon from '@/assets/icons/Chevrons-right.svg'
import './Pagination.css'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  if (totalPages <= 1) return null

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  return (
    <nav className="pagination-container" aria-label="Pagination Navigation">
      {/* Left Control: Hidden on first page */}
      {currentPage > 1 ? (
        <button
          type="button"
          className="pagination-control pagination-control--left"
          onClick={handlePrev}
          aria-label="Previous page"
        >
          <img src={chevronsRightIcon} alt="" aria-hidden="true" className="pagination-control__icon pagination-control__icon--left" />
        </button>
      ) : (
        <div className="pagination-control-placeholder" />
      )}

      {/* Page Numbers */}
      <div className="pagination-pages">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
          const isActive = page === currentPage
          return (
            <button
              key={page}
              type="button"
              className={`pagination-item ${isActive ? 'pagination-item--active' : 'pagination-item--inactive'}`}
              onClick={() => onPageChange(page)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Page ${page}`}
            >
              {page}
            </button>
          )
        })}
      </div>

      {/* Right Control: Double-chevron right icon */}
      <button
        type="button"
        className="pagination-control pagination-control--right"
        onClick={handleNext}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
      >
        <img src={chevronsRightIcon} alt="" aria-hidden="true" className="pagination-control__icon" />
      </button>
    </nav>
  )
}
