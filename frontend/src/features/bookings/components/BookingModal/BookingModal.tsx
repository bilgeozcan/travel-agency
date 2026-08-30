import React, { useLayoutEffect } from 'react'
import { usePortalPopover } from '@/hooks/usePortalPopover'
import { GuestDetailsForm } from '../GuestDetailsForm/GuestDetailsForm'
import { BookingModalHeader } from './BookingModalHeader'
import { BookingModalFooter } from './BookingModalFooter'
import { BookingModalTourSection } from './BookingModalTourSection'
import { useBookingModalState } from './useBookingModalState'
import type { BookingModalInitialSelection, BookingModalProps } from './BookingModal.types'
import './BookingModal.css'

export type { BookingModalInitialSelection, BookingModalProps }

const POPOVER_OFFSET_PX = 4

export const BookingModal: React.FC<BookingModalProps> = (props) => {
  const { isOpen, onClose, tour, mode = 'create', roleMode = 'customer' } = props

  const {
    selection,
    isDateDurationOpen,
    setIsDateDurationOpen,
    isGuestsOpen,
    setIsGuestsOpen,
    modalBodyRef,
    guestDetails,
    errors,
    isSubmitting,
    isSubmitDisabled,
    guestsDisplayValue,
    isPrimaryGuestReadOnly,
    handleGuestInputChange,
    handleSubmit,
    preserveScrollPosition,
    restoreScrollPosition,
  } = useBookingModalState(props)

  const {
    triggerRef: dateContainerRef,
    portalRef: datePortalRef,
    coords: dateAnchorPos,
  } = usePortalPopover(isDateDurationOpen && isOpen, () => setIsDateDurationOpen(false), { offsetY: POPOVER_OFFSET_PX, closeOnScroll: false })

  const {
    triggerRef: guestsContainerRef,
    portalRef: guestsPortalRef,
    coords: guestsAnchorPos,
    updatePosition: updateGuestsPopoverPosition,
    ignoreNextScroll: ignoreNextGuestsPopoverScroll,
  } = usePortalPopover(isGuestsOpen && isOpen, () => setIsGuestsOpen(false), { offsetY: POPOVER_OFFSET_PX, closeOnScroll: true })

  useLayoutEffect(() => {
    restoreScrollPosition(guestsContainerRef, ignoreNextGuestsPopoverScroll, updateGuestsPopoverPosition)
  }, [guestDetails.length, isGuestsOpen, guestsContainerRef, ignoreNextGuestsPopoverScroll, updateGuestsPopoverPosition, restoreScrollPosition])

  if (!isOpen) {
    return null
  }

  const handleChangeAdults = (value: number) => {
    preserveScrollPosition(guestsContainerRef)
    selection.setAdultsCount(value)
  }

  const handleChangeChildren = (value: number) => {
    preserveScrollPosition(guestsContainerRef)
    selection.setChildrenCount(value)
  }

  const guestDetailsSection = (
    <GuestDetailsForm
      guestDetails={guestDetails}
      errors={errors}
      onGuestInputChange={handleGuestInputChange}
      isPrimaryGuestReadOnly={isPrimaryGuestReadOnly}
    />
  )

  const tourDetailsSection = (
    <BookingModalTourSection
      dateDurationDisplayValue={selection.dateDurationDisplayValue}
      isDateDurationOpen={isDateDurationOpen}
      dateContainerRef={dateContainerRef}
      datePortalRef={datePortalRef}
      dateAnchorPos={dateAnchorPos}
      startDate={selection.startDate}
      calculatedEndDate={selection.calculatedEndDate ?? undefined}
      duration={selection.duration}
      availableStartDates={tour.availableStartDates}
      durationOptions={selection.durationOptions}
      onToggleDateDuration={() => setIsDateDurationOpen((prev) => !prev)}
      onCloseDateDuration={() => setIsDateDurationOpen(false)}
      onSelectStartDate={(date) => selection.setStartDate(date)}
      onSelectDuration={(dur) => selection.setDuration(dur)}

      guestsDisplayValue={guestsDisplayValue}
      isGuestsOpen={isGuestsOpen}
      guestsContainerRef={guestsContainerRef}
      guestsPortalRef={guestsPortalRef}
      guestsAnchorPos={guestsAnchorPos}
      adultsCount={selection.adultsCount}
      childrenCount={selection.childrenCount}
      adultsMax={tour.adultsMax}
      childrenMax={tour.childrenMax}
      totalMax={tour.totalMax}
      onToggleGuests={() => setIsGuestsOpen((prev) => !prev)}
      onCloseGuests={() => setIsGuestsOpen(false)}
      onChangeAdults={handleChangeAdults}
      onChangeChildren={handleChangeChildren}

      mealPlan={selection.mealPlan}
      mealPlanOptions={selection.mealPlanOptions}
      onChangeMealPlan={(mp) => selection.setMealPlan(mp)}
    />
  )

  return (
    <div
      className="booking-modal-backdrop"
      onClick={onClose}
      data-testid="booking-modal-backdrop"
    >
      <form
        className="booking-modal-card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        data-testid="booking-modal"
      >
        <BookingModalHeader
          title={tour.title || tour.hotelName}
          rating={tour.rating}
          destination={tour.destination}
          onClose={onClose}
        />

        <div className="booking-modal-body" ref={modalBodyRef}>
          {roleMode === 'agent' ? (
            <>
              {tourDetailsSection}
              {guestDetailsSection}
            </>
          ) : (
            <>
              {guestDetailsSection}
              {tourDetailsSection}
            </>
          )}
        </div>

        <BookingModalFooter
          totalPrice={selection.totalPrice}
          isEditMode={mode === 'edit'}
          isSubmitDisabled={isSubmitDisabled}
          isSubmitting={isSubmitting}
        />
      </form>
    </div>
  )
}
