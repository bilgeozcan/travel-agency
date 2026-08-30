import { describe, expect, it } from 'vitest'
import { mapBackendReviewToFrontend, mapBackendTourDetailsToFrontend } from './tours.mapper'
import placeholderTourImage from '@/assets/images/placeholder-tour.svg'

describe('tours.mapper', () => {
  describe('mapBackendTourDetailsToFrontend', () => {
    it('throws error when raw tour data is missing or null', () => {
      expect(() => mapBackendTourDetailsToFrontend(null, 'tour-123')).toThrow(
        "Invalid tour detail data for ID 'tour-123'"
      )
    })

    it('maps valid OAS TourDetailsDTO correctly to frontend TourDetail model', () => {
      const rawDto = {
        id: 'tour-1',
        name: 'Grand Resort',
        destination: 'Punta Cana',
        summary: 'Luxury Resort',
        rating: 4.8,
        reviews: 25,
        imageUrls: ['https://example.com/img1.jpg'],
        price: { adult: 1200 },
        startDates: ['2026-05-10'],
        durations: ['7 days', '10 days'],
        guestQuantity: {
          adultsMaxValue: 6,
          childrenMaxValue: 4,
          totalMaxValue: 10,
        },
        mealPlans: ['BB', 'AI'],
        freeCancelationDaysBefore: 14,
        customDetails: {
          guideLanguage: 'English, Spanish',
          transfer: 'Airport Transfer Included',
        },
        mealSupplementsPerDay: { AI: 50 },
        isAvailable: true,
      }

      const mapped = mapBackendTourDetailsToFrontend(rawDto, 'tour-1')

      expect(mapped.id).toBe('tour-1')
      expect(mapped.title).toBe('Grand Resort')
      expect(mapped.destination).toBe('Punta Cana')
      expect(mapped.rating).toBe(4.8)
      expect(mapped.basePricePerPerson).toBe(1200)
      expect(mapped.allowedDurations).toEqual([7, 10])
      expect(mapped.adultsMax).toBe(6)
      expect(mapped.childrenMax).toBe(4)
      expect(mapped.totalMax).toBe(10)
      expect(mapped.guideLanguages).toEqual(['English', 'Spanish'])
      expect(mapped.transferInfo).toBe('Airport Transfer Included')
      expect(mapped.isFullyBooked).toBe(false)
      expect(mapped.cancellationPolicy.description).toBe('Free cancellation up to 14 days before start date')
    })

    it('handles legacy typo totalMaxVelue and numeric price fallback', () => {
      const rawDto = {
        name: 'Budget Inn',
        price: 500,
        durations: [3],
        guestQuantity: {
          totalMaxVelue: 4,
        },
      }

      const mapped = mapBackendTourDetailsToFrontend(rawDto, 'tour-legacy')

      expect(mapped.basePricePerPerson).toBe(500)
      expect(mapped.totalMax).toBe(4)
      expect(mapped.allowedDurations).toEqual([3])
      expect(mapped.heroImages).toEqual([placeholderTourImage])
    })

    it('flags isFullyBooked when totalMax or adultsMaxValue is zero, or isAvailable is false', () => {
      const rawSoldOut = {
        name: 'Sold Out Tour',
        isAvailable: false,
        guestQuantity: { totalMaxValue: 0, adultsMaxValue: 0 },
      }

      const mapped = mapBackendTourDetailsToFrontend(rawSoldOut, 'tour-soldout')
      expect(mapped.isFullyBooked).toBe(true)
    })
  })

  describe('mapBackendReviewToFrontend', () => {
    it('maps review DTO correctly with default fallback values', () => {
      const rawReview = {
        reviewId: 'rev-100',
        authorName: 'Jane Doe',
        rate: 5,
        createdAt: '2026-03-01',
        reviewContent: 'Amazing experience!',
      }

      const mapped = mapBackendReviewToFrontend(rawReview, 0)

      expect(mapped.id).toBe('rev-100')
      expect(mapped.authorName).toBe('Jane Doe')
      expect(mapped.rating).toBe(5)
      expect(mapped.date).toBe('2026-03-01')
      expect(mapped.comment).toBe('Amazing experience!')
    })

    it('uses fallback values for missing fields', () => {
      const rawReview = {}

      const mapped = mapBackendReviewToFrontend(rawReview, 2)

      expect(mapped.id).toBe('rev-2')
      expect(mapped.authorName).toBe('Anonymous')
      expect(mapped.rating).toBe(0)
      expect(mapped.comment).toBe('')
    })
  })
})
