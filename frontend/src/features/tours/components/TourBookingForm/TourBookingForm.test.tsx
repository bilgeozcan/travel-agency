import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TourDetail } from '@/features/tours/types/tours'
import { TourBookingForm } from './TourBookingForm'

const mockTourDetail: TourDetail = {
  id: 'tour-2',
  title: 'A guided hike in the Dolomites',
  hotelName: 'Dolomites Guided Hike',
  hotelDescription: 'desc',
  rating: 4.8,
  reviewsCount: 42,
  heroImages: ['/img1.jpg'],
  basePricePerPerson: 1400,
  availableStartDates: ['2026-06-01', '2026-07-01'],
  allowedDurations: [7, 10],
  maxParticipants: 2,
  availableMealPlans: ['BB', 'HB'],
  cancellationPolicy: { freeCancellationUntilDays: 14, description: 'Free until Jan 5' },
  accommodationDescription: 'huts',
  guideLanguages: ['Italian'],
  transferInfo: 'transfer',
  isFullyBooked: false,
}

function renderComponent(overrides: Partial<TourDetail> = {}) {
  const testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  const onBook = vi.fn()

  render(
    <QueryClientProvider client={testQueryClient}>
      <TourBookingForm tour={{ ...mockTourDetail, ...overrides }} onBook={onBook} />
    </QueryClientProvider>
  )

  return { onBook }
}

describe('TourBookingForm Component', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('combines start date and duration into a single calendar+duration picker', async () => {
    const user = userEvent.setup()
    renderComponent()

    const dateDurationInput = screen.getByLabelText('Start date and duration')
    expect(dateDurationInput).toHaveValue('Jun 1 - Jun 8, 7 days')

    await user.click(dateDurationInput)
    expect(screen.getByTestId('calendar-duration-popover')).toBeInTheDocument()

    await user.click(screen.getByText('10 days'))
    expect(dateDurationInput).toHaveValue('Jun 1 - Jun 11, 10 days')
  })

  it('allows adjusting adults and children count via GuestsPopover', async () => {
    const user = userEvent.setup()
    renderComponent()

    const guestsInput = screen.getByLabelText('Number of tourists')
    expect(guestsInput).toHaveValue('1 adult')

    await user.click(screen.getByTestId('booking-guests-trigger'))
    expect(screen.getByTestId('guests-popover')).toBeInTheDocument()

    const increaseChildrenBtn = screen.getByRole('button', { name: 'Increase children' })
    await user.click(increaseChildrenBtn)

    expect(guestsInput).toHaveValue('1 adult, 1 child')
  })

  it('shows full meal plan labels with codes', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByLabelText('Meal plan'))
    expect(screen.getByRole('option', { name: 'Breakfast (BB)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Half-board (HB)' })).toBeInTheDocument()
  })

  it('disables the book button and shows helper text when fully booked', () => {
    renderComponent({ isFullyBooked: true })
    expect(screen.getByTestId('book-tour-cta')).toBeDisabled()
    expect(screen.getByTestId('fully-booked-helper')).toHaveTextContent('Tour is fully booked')
  })

  it('calculates and displays total price instantly using tour parameters', async () => {
    renderComponent()
    // tour.basePricePerPerson = 1400, 1 tourist -> $1400
    await waitFor(() => {
      expect(screen.getByTestId('total-price')).toHaveTextContent('$1400')
    })
  })

  it('calls onBook when clicking Book the tour', async () => {
    const user = userEvent.setup()
    const { onBook } = renderComponent()

    await user.click(screen.getByTestId('book-tour-cta'))
    expect(onBook).toHaveBeenCalledTimes(1)
  })
})
