import { describe, expect, it } from 'vitest'
import type { BackendBookingItem } from '@/features/bookings/types/bookings'
import placeholderTourImage from '@/assets/images/placeholder-tour.svg'
import {
  cleanCanceledBy,
  cleanCancellationReason,
  formatCancellationRole,
  mapBackendBookingToFrontend,
  mapCustomerBooking,
  mapTravelAgentBooking,
} from './bookings.mapper'

describe('bookings.mapper', () => {
  describe('formatCancellationRole', () => {
    it('returns undefined for missing or empty input', () => {
      expect(formatCancellationRole(undefined)).toBeUndefined()
      expect(formatCancellationRole(null)).toBeUndefined()
      expect(formatCancellationRole('')).toBeUndefined()
    })

    it('identifies agent roles', () => {
      expect(formatCancellationRole('TRAVEL_AGENT')).toBe('Travel agent')
      expect(formatCancellationRole('agent')).toBe('Travel agent')
      expect(formatCancellationRole('agent@travel.com')).toBe('Travel agent')
    })

    it('identifies customer/tourist roles', () => {
      expect(formatCancellationRole('CUSTOMER')).toBe('Tourist')
      expect(formatCancellationRole('tourist')).toBe('Tourist')
      expect(formatCancellationRole('user')).toBe('Tourist')
    })

    it('identifies admin roles', () => {
      expect(formatCancellationRole('ADMIN')).toBe('Admin')
      expect(formatCancellationRole('admin_user')).toBe('Admin')
    })
  })
  describe('cleanCanceledBy', () => {
    it('returns undefined for empty/falsy raw value', () => {
      expect(cleanCanceledBy(undefined)).toBeUndefined()
      expect(cleanCanceledBy(null)).toBeUndefined()
      expect(cleanCanceledBy('')).toBeUndefined()
    })

    it('cleans Python-style stringified dict with travel agent role and name', () => {
      const raw = "{'role': 'TRAVEL_AGENT', 'firstName': 'John', 'lastName': 'Doe'}"
      expect(cleanCanceledBy(raw)).toBe('John Doe (Travel agent)')
    })

    it('cleans JSON string with customer role and email', () => {
      const raw = '{"role": "CUSTOMER", "email": "customer@example.com"}'
      expect(cleanCanceledBy(raw)).toBe('customer@example.com (Tourist)')
    })

    it('extracts role label and email when role keyword is contained in email string', () => {
      expect(cleanCanceledBy('agent@travelagency.com')).toBe('agent@travelagency.com (Travel agent)')
    })

    it('formats raw string and explicit rawRole correctly', () => {
      expect(cleanCanceledBy('customer@example.com', 'CUSTOMER')).toBe('customer@example.com (Tourist)')
      expect(cleanCanceledBy('agent@example.com', 'TRAVEL_AGENT')).toBe('agent@example.com (Travel agent)')
      expect(cleanCanceledBy('admin@example.com', 'ADMIN')).toBe('admin@example.com (Admin)')
      expect(cleanCanceledBy(null, 'CUSTOMER')).toBe('Tourist')
      expect(cleanCanceledBy(null, 'TRAVEL_AGENT')).toBe('Travel agent')
    })
  })

  describe('cleanCancellationReason', () => {
    it('returns "-" for empty or missing cancellation reason', () => {
      expect(cleanCancellationReason(undefined)).toBe('-')
      expect(cleanCancellationReason(null)).toBe('-')
      expect(cleanCancellationReason('')).toBe('-')
      expect(cleanCancellationReason('   ')).toBe('-')
    })

    it('preserves custom cancellation reason string', () => {
      expect(cleanCancellationReason('Flight cancelled by airline')).toBe('Flight cancelled by airline')
    })
  })

  describe('mapBackendBookingToFrontend', () => {
    const rawDto: BackendBookingItem = {
      id: 'booking-123',
      userId: 'user-456',
      tourId: 'tour-789',
      state: 'BOOKED',
      name: 'Tropical Caribe Hotel',
      destination: 'Punta Cana, Dominican Republic',
      tourImageUrl: 'https://example.com/caribe.jpg',
      personalDetails: [{ firstName: 'Serhat', lastName: 'Arslan', email: 'serhat@example.com' }],
      tourDetails: {
        date: '2025-01-15 (7 days)',
        mealPlan: 'BB',
        guests: '2 adults, 1 children',
        totalPrice: '$1400',
        documents: '0 items',
      },
      travelAgent: {
        name: 'Tyrone Boyer',
        email: 'tyroneboyer@gmail.com',
        phone: '480-221-1885',
        messenger: 'https://example.com/messenger-link',
      },
    }

    it('correctly maps raw backend booking DTO to clean frontend TourBooking object', () => {
      const mapped = mapBackendBookingToFrontend(rawDto, 'Customer')

      expect(mapped.id).toBe('booking-123')
      expect(mapped.tourId).toBe('tour-789')
      expect(mapped.tourTitle).toBe('Tropical Caribe Hotel')
      expect(mapped.hotelName).toBe('Tropical Caribe Hotel')
      expect(mapped.destination).toBe('Punta Cana, Dominican Republic')
      expect(mapped.heroImage).toBe('https://example.com/caribe.jpg')
      expect(mapped.status).toBe('BOOKED')
      expect(mapped.startDate).toBe('2025-01-15')
      expect(mapped.durationDays).toBe(7)
      expect(mapped.mealPlan).toBe('BB')
      expect(mapped.adultsCount).toBe(2)
      expect(mapped.childrenCount).toBe(1)
      expect(mapped.guestsCount).toBe(3)
      expect(mapped.totalPrice).toBe(1400)
      expect(mapped.travelAgent?.name).toBe('Tyrone Boyer')
    })

    it('maps Travel Agent view using mapTravelAgentBooking with customerEmail', () => {
      const mapped = mapTravelAgentBooking(rawDto)
      expect(mapped.customerEmail).toBe('serhat@example.com')
      expect(mapped.travelAgent?.name).toBe('Tyrone Boyer')
    })

    it('maps Customer view using mapCustomerBooking preserving travelAgent info', () => {
      const mapped = mapCustomerBooking(rawDto)
      expect(mapped.travelAgent?.name).toBe('Tyrone Boyer')
    })

    it('handles missing or default fallback values gracefully', () => {
      const rawDtoEmpty: BackendBookingItem = {
        id: 'booking-999',
        userId: 'user-000',
        tourId: 'tour-000',
        state: 'CONFIRMED',
        name: 'Unknown Hotel',
        destination: 'Unknown Place',
        tourDetails: {
          date: '2025-06-01 (10 days)',
          mealPlan: 'AI',
          guests: '1 adult, 0 children',
          totalPrice: '800',
        },
      }

      const mapped = mapBackendBookingToFrontend(rawDtoEmpty)

      expect(mapped.id).toBe('booking-999')
      expect(mapped.heroImage).toBe(placeholderTourImage)
      expect(mapped.adultsCount).toBe(1)
      expect(mapped.childrenCount).toBe(0)
      expect(mapped.travelAgent).toBeUndefined()
    })

    it('keeps booking guests as separate people', () => {
      const rawDtoGuests: BackendBookingItem = {
        id: 'booking-guests',
        userId: 'user-000',
        tourId: 'tour-000',
        state: 'BOOKED',
        name: 'Amalfi Coast Luxury Getaway',
        destination: 'Amalfi, Italy',
        personalDetails: [
          { firstName: 'dasdasd', lastName: 'asdas' },
          { firstName: 'dasdasd', lastName: 'asdasd' },
          { firstName: 'asdasd', lastName: 'asddddd' },
        ],
        tourDetails: {
          date: '2026-08-16 (5 days)',
          mealPlan: 'BB',
          guests: 'dasdasd asdas, dasdasd asdasd, asdasd asddddd (3 adults, 0 children)',
          totalPrice: '$6400',
        },
      }

      const mapped = mapBackendBookingToFrontend(rawDtoGuests)

      expect(mapped.guests).toEqual(rawDtoGuests.personalDetails)
      expect(mapped.guests[0].lastName).toBe('asdas')
    })

    it('pads guest rows when total guest count is higher than personalDetails length', () => {
      const rawDtoPadding: BackendBookingItem = {
        id: 'booking-padding',
        userId: 'user-000',
        tourId: 'tour-000',
        state: 'BOOKED',
        name: 'Dolomites: 7-day Guided Hike',
        destination: 'Dolomites Mountains, Italy',
        personalDetails: [{ firstName: 'asda', lastName: 'asdasd' }],
        tourDetails: {
          date: '2026-08-25 (7 days)',
          mealPlan: 'FB',
          guests: 'asda asdasd (2 adults, 0 children)',
          totalPrice: '$3360',
        },
      }

      const mapped = mapBackendBookingToFrontend(rawDtoPadding)

      expect(mapped.guestsCount).toBe(2)
      expect(mapped.guests).toEqual([
        { firstName: 'asda', lastName: 'asdasd' },
        { firstName: '', lastName: '' },
      ])
    })
  })
})
