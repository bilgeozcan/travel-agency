import React from 'react'
import calendarIcon from '@/assets/icons/Calendar.svg'
import chevronDownIcon from '@/assets/icons/Chevron-down.svg'
import chevronUpIcon from '@/assets/icons/Chevron-up.svg'
import mealIcon from '@/assets/icons/Meal.svg'
import peopleIcon from '@/assets/icons/People.svg'
import { InputField } from '@/components/ui/InputField/InputField'
import { PortalPopover } from '@/components/ui/PortalPopover/PortalPopover'
import { Select } from '@/components/ui/Select/Select'
import { CalendarDurationPopover, type DurationOption } from '@/features/tours/components/CalendarDurationPopover/CalendarDurationPopover'
import { GuestsPopover } from '@/features/tours/components/GuestsPopover/GuestsPopover'
import type { MealPlanCode } from '@/features/tours/types/tours'
import type { BookingModalTourSectionProps } from './BookingModalTourSection.types'

export type { BookingModalTourSectionProps }

export const BookingModalTourSection: React.FC<BookingModalTourSectionProps> = ({
  dateDurationDisplayValue,
  isDateDurationOpen,
  dateContainerRef,
  datePortalRef,
  dateAnchorPos,
  startDate,
  calculatedEndDate,
  duration,
  availableStartDates,
  durationOptions,
  onToggleDateDuration,
  onCloseDateDuration,
  onSelectStartDate,
  onSelectDuration,

  guestsDisplayValue,
  isGuestsOpen,
  guestsContainerRef,
  guestsPortalRef,
  guestsAnchorPos,
  adultsCount,
  childrenCount,
  adultsMax,
  childrenMax,
  totalMax,
  onToggleGuests,
  onCloseGuests,
  onChangeAdults,
  onChangeChildren,

  mealPlan,
  mealPlanOptions,
  onChangeMealPlan,
}) => {
  const formattedDurationOptions: DurationOption[] = durationOptions.map((opt) => ({
    id: opt.id || opt.value,
    label: opt.label,
    value: opt.value,
  }))

  return (
    <div className="booking-modal-tour-section">
      <h3 className="booking-modal-section-title">Tour Details</h3>
      <div className="booking-modal-selectors-stack">
        <div
          className={`booking-modal-selector-item ${isDateDurationOpen ? 'booking-modal-selector-item--active' : ''}`}
          ref={dateContainerRef}
          onClick={onToggleDateDuration}
        >
          <InputField
            leftIconSrc={calendarIcon}
            type="text"
            readOnly
            placeholder="Select start date & duration"
            value={dateDurationDisplayValue}
            id="modal-date-duration"
            aria-label="Start date and duration"
            rightElement={
              <img
                src={isDateDurationOpen ? chevronUpIcon : chevronDownIcon}
                alt=""
                aria-hidden="true"
              />
            }
          />
        </div>

        <PortalPopover isOpen={isDateDurationOpen} coords={dateAnchorPos} portalRef={datePortalRef}>
          <CalendarDurationPopover
            isOpen={true}
            onClose={onCloseDateDuration}
            selectedDate={startDate}
            selectedEndDate={calculatedEndDate ?? startDate}
            selectedDurations={[String(duration)]}
            dateSelectionMode="single"
            availableDates={availableStartDates}
            durationOptions={formattedDurationOptions}
            durationSelectionMode="single"
            onSelectDateRange={onSelectStartDate}
            onSelectDurations={(durations) => {
              if (durations[0]) onSelectDuration(Number(durations[0]))
            }}
          />
        </PortalPopover>

        <div
          className={`booking-modal-selector-item ${isGuestsOpen ? 'booking-modal-selector-item--active' : ''}`}
          ref={guestsContainerRef}
          onClick={onToggleGuests}
        >
          <InputField
            leftIconSrc={peopleIcon}
            type="text"
            readOnly
            placeholder="Select guests"
            value={guestsDisplayValue}
            id="modal-guests"
            aria-label="Number of tourists"
            rightElement={
              <img
                src={isGuestsOpen ? chevronUpIcon : chevronDownIcon}
                alt=""
                aria-hidden="true"
              />
            }
          />
        </div>

        <PortalPopover isOpen={isGuestsOpen} coords={guestsAnchorPos} portalRef={guestsPortalRef}>
          <GuestsPopover
            isOpen={true}
            onClose={onCloseGuests}
            adults={adultsCount}
            childrenCount={childrenCount}
            adultsMax={adultsMax}
            childrenMax={childrenMax}
            totalMax={totalMax}
            onChangeAdults={onChangeAdults}
            onChangeChildren={onChangeChildren}
          />
        </PortalPopover>

        <div className="booking-modal-selector-item">
          <Select
            leftIconSrc={mealIcon}
            options={mealPlanOptions}
            value={mealPlan}
            onChange={(val) => onChangeMealPlan(val as MealPlanCode)}
            id="modal-meal-plan"
            aria-label="Meal plan"
            portal={true}
          />
        </div>
      </div>
    </div>
  )
}
