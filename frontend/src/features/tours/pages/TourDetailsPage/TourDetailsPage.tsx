import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import chevronLeftIcon from '@/assets/icons/Chevron-up.svg'
import locationIcon from '@/assets/icons/Location.svg'
import { Breadcrumb } from '@/components/ui/Breadcrumb/Breadcrumb'
import { PageLoader } from '@/components/ui/PageLoader/PageLoader'
import { Toast } from '@/components/ui/Toast/Toast'
import { AuthRequiredPopup } from '@/features/tours/components/AuthRequiredPopup/AuthRequiredPopup'
import { ImageGallery } from '@/features/tours/components/ImageGallery/ImageGallery'
import { RatingStars } from '@/features/tours/components/RatingStars/RatingStars'
import { ReviewsSection } from '@/features/tours/components/ReviewsSection/ReviewsSection'
import { TourBookingForm } from '@/features/tours/components/TourBookingForm/TourBookingForm'
import { TourInfoCard } from '@/features/tours/components/TourInfoCard/TourInfoCard'
import { CreateBookingModal } from '@/features/bookings/components/BookingModal/CreateBookingModal'
import { BookingConfirmationModal } from '@/features/bookings/components/BookingConfirmationModal/BookingConfirmationModal'
import type { BookingModalInitialSelection } from '@/features/bookings/components/BookingModal/BookingModal'
import type { CreateBookingRequest, GuestInfo } from '@/features/bookings/types/bookings'
import type { ConfirmedBookingInfo } from '@/features/bookings/types/bookingConfirmation'
import { useCreateBookingFlow } from '@/features/bookings/hooks/useCreateBookingFlow'
import { useTourDetails } from '@/features/tours/hooks/useTourDetails'
import './TourDetailsPage.css'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
)

const getBookingErrorMessage = (error: unknown): string => {
  if (isRecord(error) && error.code === 'OVERBOOKING_PREVENTED') {
    const details = error.details
    if (isRecord(details) && typeof details.availability === 'string') {
      return `Booking unavailable: ${details.availability}. Please adjust the guest count or choose another date.`
    }
  }

  if (isRecord(error) && error.code === 'PRICE_CHANGED') {
    const details = error.details
    if (isRecord(details) && 'pricing' in details) {
      const pricing = details.pricing
      if (isRecord(pricing) && typeof pricing.quotedTotal === 'number' && typeof pricing.currentTotal === 'number') {
        const currency = typeof pricing.currency === 'string' ? pricing.currency : 'USD'
        const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency })
        return `Price changed from ${formatter.format(pricing.quotedTotal)} to ${formatter.format(pricing.currentTotal)}. Please review and try again.`
      }
    }
  }

  return error instanceof Error ? error.message : 'Failed to submit booking'
}

export interface TourDetailsPageProps {
  tourId: string
  isAuthenticated: boolean
  onNavigateToMainPage: () => void
  onNavigateToSignIn: () => void
  onNavigateToCreateAccount: () => void
  onNavigateToMyTours?: () => void
}

export const TourDetailsPage: React.FC<TourDetailsPageProps> = ({
  tourId,
  isAuthenticated,
  onNavigateToMainPage,
  onNavigateToSignIn,
  onNavigateToCreateAccount,
  onNavigateToMyTours,
}) => {
  const { data: tour, isLoading, isError } = useTourDetails(tourId)
  const { submitBooking } = useCreateBookingFlow()
  const queryClient = useQueryClient()
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [isAuthPopupOpen, setIsAuthPopupOpen] = useState(false)
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false)
  const [bookingInitialSelection, setBookingInitialSelection] = useState<BookingModalInitialSelection | undefined>(undefined)
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false)
  const [confirmedBookingInfo, setConfirmedBookingInfo] = useState<ConfirmedBookingInfo | null>(null)

  const handleBook = (selection?: BookingModalInitialSelection) => {
    if (!isAuthenticated) {
      setIsAuthPopupOpen(true)
      return
    }
    if (selection) {
      setBookingInitialSelection(selection)
    }
    setIsBookingModalOpen(true)
  }

  const handleConfirmBooking = async (payload: CreateBookingRequest, _guests: GuestInfo[]) => {
    try {
      const response = await submitBooking(payload)

      // Enterprise TanStack Query Cache Invalidation
      queryClient.invalidateQueries({ queryKey: ['bookings'] })

      setIsBookingModalOpen(false)

      const durationDays = parseInt(payload.duration, 10) || 1
      const travelAgentData = response.travelAgent ?? (tour as any)?.travelAgent

      setConfirmedBookingInfo({
        hotelName: tour?.hotelName || tour?.title || 'Hotel',
        startDate: payload.date,
        durationDays,
        mealPlan: payload.mealPlan,
        adultsCount: payload.guests.adult,
        childrenCount: payload.guests.children,
        travelAgent: travelAgentData,
        freeCancellationUntilDate: response.freeCancelation,
      })
      setIsConfirmationModalOpen(true)
    } catch (err: unknown) {
      setToastType('error')
      setToastMessage(getBookingErrorMessage(err))
    }
  }

  const handleCloseConfirmationModal = () => {
    setIsConfirmationModalOpen(false)
    setConfirmedBookingInfo(null)
    setBookingInitialSelection(undefined)
  }

  const handleNavigateToMyToursFromModal = () => {
    handleCloseConfirmationModal()
    if (onNavigateToMyTours) {
      onNavigateToMyTours()
    }
  }

  if (isLoading && !tour) {
    return <PageLoader label="Loading tour details..." inline />
  }

  if (isError || !tour) {
    return (
      <div className="tour-details-page" data-testid="tour-details-error">
        <p>Page could not be loaded</p>
        <button type="button" className="tour-details-page__back" onClick={onNavigateToMainPage}>
          <img src={chevronLeftIcon} alt="" aria-hidden="true" className="tour-details-page__back-icon" />
          All tours
        </button>
      </div>
    )
  }

  return (
    <div className="tour-details-page" data-testid="tour-details-page">
      {toastMessage && <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage(null)} />}

      <AuthRequiredPopup
        isOpen={isAuthPopupOpen}
        onClose={() => setIsAuthPopupOpen(false)}
        onSignIn={onNavigateToSignIn}
        onCreateAccount={onNavigateToCreateAccount}
      />

      {tour && (
        <CreateBookingModal
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
          tour={tour}
          initialSelection={bookingInitialSelection}
          onConfirmBooking={handleConfirmBooking}
        />
      )}

      {confirmedBookingInfo && (
        <BookingConfirmationModal
          isOpen={isConfirmationModalOpen}
          hotelName={confirmedBookingInfo.hotelName}
          startDate={confirmedBookingInfo.startDate}
          durationDays={confirmedBookingInfo.durationDays}
          mealPlan={confirmedBookingInfo.mealPlan}
          adultsCount={confirmedBookingInfo.adultsCount}
          childrenCount={confirmedBookingInfo.childrenCount}
          travelAgent={confirmedBookingInfo.travelAgent}
          freeCancellationUntilDate={confirmedBookingInfo.freeCancellationUntilDate}
          onClose={handleCloseConfirmationModal}
          onNavigateToMyTours={handleNavigateToMyToursFromModal}
        />
      )}

      <Breadcrumb
        className="tour-details-page__breadcrumb"
        items={[
          { label: 'All tours', onClick: onNavigateToMainPage },
          { label: tour.title },
        ]}
      />

      <header className="tour-details-page__hero">
        <div className="tour-details-page__hero-heading">
          <h1 className="text-title-hero">{tour.title}</h1>
          <p className="tour-details-page__location">
            <img src={locationIcon} alt="" aria-hidden="true" />
            <span>{tour.destination ?? tour.hotelName}</span>
          </p>
        </div>
        <div className="tour-details-page__rating">
          <RatingStars rating={tour.rating ?? 0} size="md" />
          <span className="tour-details-page__rating-value">{(tour.rating ?? 0).toFixed(2)}</span>
        </div>
      </header>

      <ImageGallery images={tour.heroImages} alt={tour.title} />

      <div className="tour-details-page__body">
        <TourInfoCard tour={tour} />
        <TourBookingForm key={tour.id} tour={tour} onBook={handleBook} />
      </div>

      <ReviewsSection tourId={tour.id} />
    </div>
  )
}
