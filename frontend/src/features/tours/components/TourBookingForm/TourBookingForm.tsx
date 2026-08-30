import React, { useRef, useState } from 'react'
import calendarIcon from '@/assets/icons/Calendar.svg'
import chevronDownIcon from '@/assets/icons/Chevron-down.svg'
import chevronUpIcon from '@/assets/icons/Chevron-up.svg'
import mealIcon from '@/assets/icons/Meal.svg'
import peopleIcon from '@/assets/icons/People.svg'
import { Button } from '@/components/ui/Button/Button'
import { InputField } from '@/components/ui/InputField/InputField'
import { Select } from '@/components/ui/Select/Select'
import { Toast } from '@/components/ui/Toast/Toast'
import { CalendarDurationPopover } from '@/features/tours/components/CalendarDurationPopover/CalendarDurationPopover'
import { GuestsPopover } from '@/features/tours/components/GuestsPopover/GuestsPopover'
import type { MealPlanCode, TourDetail } from '@/features/tours/types/tours'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useBookingSelection } from '@/features/bookings/hooks/useBookingSelection'
import './TourBookingForm.css'

export interface BookingSelectionState {
  startDate: string
  duration: number
  adults: number
  children: number
  mealPlan: MealPlanCode
}

export interface TourBookingFormProps {
  tour: TourDetail
  onBook: (selection?: BookingSelectionState) => void
}

export const TourBookingForm: React.FC<TourBookingFormProps> = ({ tour, onBook }) => {
  const {
    startDate,
    setStartDate,
    duration,
    setDuration,
    mealPlan,
    setMealPlan,
    adultsCount,
    setAdultsCount,
    childrenCount,
    setChildrenCount,
    totalGuests,
    calculatedEndDate,
    totalPrice,
    durationOptions,
    mealPlanOptions,
    dateDurationDisplayValue,
  } = useBookingSelection(tour)

  const [isDateDurationOpen, setIsDateDurationOpen] = useState(false)
  const [isGuestsOpen, setIsGuestsOpen] = useState(false)

  const dateDurationContainerRef = useRef<HTMLDivElement>(null)
  useClickOutside(dateDurationContainerRef, () => setIsDateDurationOpen(false), isDateDurationOpen)

  const guestsContainerRef = useRef<HTMLDivElement>(null)
  useClickOutside(guestsContainerRef, () => setIsGuestsOpen(false), isGuestsOpen)

  const isExceedingCapacity =
    (tour.maxParticipants ? totalGuests > tour.maxParticipants : false) ||
    (tour.adultsMax ? adultsCount > tour.adultsMax : false) ||
    (tour.childrenMax ? childrenCount > tour.childrenMax : false)

  const isBookingDisabled = tour.isFullyBooked || isExceedingCapacity

  const handleBookClick = () => {
    onBook({
      startDate,
      duration,
      adults: adultsCount,
      children: childrenCount,
      mealPlan: mealPlan as MealPlanCode,
    })
  }

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastType] = useState<'success' | 'error'>('error')

  return (
    <section className="tour-booking-form card" data-testid="tour-booking-form">
      {toastMessage && (
        <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage(null)} />
      )}

      <div
        className="tour-booking-form__date-duration"
        ref={dateDurationContainerRef}
        onClick={() => setIsDateDurationOpen((prev) => !prev)}
        data-testid="booking-date-duration-trigger"
      >
        <InputField
          leftIconSrc={calendarIcon}
          type="text"
          readOnly
          placeholder="Select start date & duration"
          value={dateDurationDisplayValue}
          id="booking-start-date"
          aria-label="Start date and duration"
          rightElement={
            <img
              src={isDateDurationOpen ? chevronUpIcon : chevronDownIcon}
              alt=""
              className="date-chevron-icon"
              aria-hidden="true"
            />
          }
        />
        <CalendarDurationPopover
          isOpen={isDateDurationOpen}
          onClose={() => setIsDateDurationOpen(false)}
          selectedDate={startDate}
          selectedEndDate={calculatedEndDate ?? startDate}
          selectedDurations={[String(duration)]}
          dateSelectionMode="single"
          availableDates={tour.availableStartDates}
          onUnavailableDateClick={() => setToastMessage('Please choose sufficient date for this trip')}
          durationOptions={durationOptions}
          durationSelectionMode="single"
          onSelectDateRange={(date) => setStartDate(date)}
          onSelectDurations={(durations) => setDuration(Number(durations[0]))}
        />
      </div>

      <div
        className="tour-booking-form__guests"
        ref={guestsContainerRef}
        onClick={() => setIsGuestsOpen((prev) => !prev)}
        data-testid="booking-guests-trigger"
      >
        <InputField
          leftIconSrc={peopleIcon}
          type="text"
          readOnly
          placeholder="Select guests"
          value={`${adultsCount} ${adultsCount === 1 ? 'adult' : 'adults'}${childrenCount > 0 ? `, ${childrenCount} ${childrenCount === 1 ? 'child' : 'children'}` : ''}`}
          id="booking-guests"
          aria-label="Number of tourists"
          rightElement={
            <img
              src={isGuestsOpen ? chevronUpIcon : chevronDownIcon}
              alt=""
              aria-hidden="true"
              className="date-chevron-icon"
            />
          }
        />

        <GuestsPopover
          isOpen={isGuestsOpen}
          adults={adultsCount}
          childrenCount={childrenCount}
          adultsMax={tour.adultsMax}
          childrenMax={tour.childrenMax}
          totalMax={tour.totalMax}
          onChangeAdults={setAdultsCount}
          onChangeChildren={setChildrenCount}
          onClose={() => setIsGuestsOpen(false)}
        />
      </div>

      {mealPlanOptions.length > 0 ? (
        <Select
          leftIconSrc={mealIcon}
          options={mealPlanOptions}
          value={mealPlan}
          onChange={(val) => setMealPlan(val as MealPlanCode)}
          id="booking-meal-plan"
          aria-label="Meal plan"
        />
      ) : (
        <Select
          leftIconSrc={mealIcon}
          options={[{ label: 'Not specified', value: '' }]}
          value=""
          disabled
          id="booking-meal-plan"
          aria-label="Meal plan"
        />
      )}

      <div className="tour-booking-form__price">
        <span className="tour-booking-form__price-label">Total price:</span>
        <span
          className="tour-booking-form__price-value"
          data-testid="total-price"
        >
          ${totalPrice}
        </span>
      </div>

      <Button
        variant="primary"
        onClick={handleBookClick}
        disabled={isBookingDisabled}
        data-testid="book-tour-cta"
      >
        Book the tour
      </Button>
      {tour.isFullyBooked ? (
        <p className="tour-booking-form__helper-text" data-testid="fully-booked-helper">
          Tour is fully booked
        </p>
      ) : isExceedingCapacity ? (
        <p className="tour-booking-form__helper-text" data-testid="fully-booked-helper">
          Selected guests exceed maximum capacity ({tour.maxParticipants})
        </p>
      ) : null}
    </section>
  )
}
