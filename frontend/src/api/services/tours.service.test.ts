import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../client/apiClient'
import { toursService } from './tours.service'

vi.mock('../client/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('toursService unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAvailableTours & query building', () => {
    it('builds query string correctly mapping arrays, guests, and skipping "Any destination"', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          tours: [
            { id: 't1', name: 'Tour 1', imageUrls: ['https://example.com/1.jpg'] },
          ],
          page: 1,
          pageSize: 6,
          totalPages: 1,
          totalItems: 1,
        },
      } as any)

      const result = await toursService.getAvailableTours({
        destination: 'Any destination',
        mealPlans: ['BB', 'AI'],
        tourTypes: ['RESORT'],
        guestQuantity: { adults: 2, children: 1 },
      } as any)

      expect(apiClient.get).toHaveBeenCalledWith(
        '/tours/available?mealPlan=BB%2CAI&tourType=RESORT&adults=2&children=1'
      )
      expect(result.tours[0].imageUrl).toBe('https://example.com/1.jpg')
    })

    it('returns empty list fallback when response data is missing', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(null as any)

      const result = await toursService.getAvailableTours()

      expect(result.tours).toEqual([])
      expect(result.totalItems).toBe(0)
    })
  })

  describe('getDestinations search', () => {
    it('returns empty list for query under 3 characters', async () => {
      const result = await toursService.getDestinations('it')
      expect(result.destinations).toEqual([])
      expect(apiClient.get).not.toHaveBeenCalled()
    })

    it('fetches matching destinations when query is 3+ characters', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: { destinations: ['Punta Cana', 'Punta Arenas'] },
      } as any)

      const result = await toursService.getDestinations('punta')

      expect(apiClient.get).toHaveBeenCalledWith('/tours/destinations?destination=punta')
      expect(result.destinations).toHaveLength(2)
    })
  })

  describe('getTourById', () => {
    it('fetches tour details and maps to frontend model', async () => {
      const mockRawTour = {
        id: 'tour-123',
        name: 'Ocean Resort',
        price: { adult: 800 },
        guestQuantity: { totalMaxValue: 8 },
      }
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockRawTour } as any)

      const tour = await toursService.getTourById('tour-123')

      expect(apiClient.get).toHaveBeenCalledWith('/tours/tour-123')
      expect(tour.title).toBe('Ocean Resort')
      expect(tour.basePricePerPerson).toBe(800)
    })

    it('throws error when tour is not found', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: null } as any)

      await expect(toursService.getTourById('invalid-id')).rejects.toThrow(
        "Tour with ID 'invalid-id' not found"
      )
    })
  })

  describe('getTourReviews', () => {
    it('maps TOP_RATED sort to RATING_DESC query param', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          reviews: [{ reviewId: 'r1', authorName: 'Alice', rate: 5 }],
          page: 1,
          pageSize: 4,
          totalPages: 1,
          totalItems: 1,
        },
      } as any)

      const res = await toursService.getTourReviews('tour-1', 'TOP_RATED')

      expect(apiClient.get).toHaveBeenCalledWith(
        '/tours/tour-1/reviews?sortBy=RATING_DESC&page=1&pageSize=4'
      )
      expect(res.reviews[0].authorName).toBe('Alice')
    })
  })
})
