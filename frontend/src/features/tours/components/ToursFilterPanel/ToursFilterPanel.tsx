import React, { useEffect, useRef, useState } from 'react'
import calendarIcon from '@/assets/icons/Calendar.svg'
import chevronDownIcon from '@/assets/icons/Chevron-down.svg'
import chevronUpIcon from '@/assets/icons/Chevron-up.svg'
import locationIcon from '@/assets/icons/Location.svg'
import mealIcon from '@/assets/icons/Meal.svg'
import peopleIcon from '@/assets/icons/People.svg'
import tourIcon from '@/assets/icons/tour.svg'
import { Button } from '@/components/ui/Button/Button'
import { InputField } from '@/components/ui/InputField/InputField'
import type { MealPlanCode, ResortTypeCode, TourFilterParams } from '@/features/tours/types/tours'
import { formatGuestCountLabel } from '@/utils/toursValidation'
import { CalendarDurationPopover } from '../CalendarDurationPopover/CalendarDurationPopover'
import { DestinationDropdownPopover } from '../DestinationDropdownPopover/DestinationDropdownPopover'
import { GuestsPopover } from '../GuestsPopover/GuestsPopover'
import { MEAL_OPTIONS_LIST, MealDropdownPopover } from '../MealDropdownPopover/MealDropdownPopover'
import { TOUR_TYPE_OPTIONS_LIST, TourTypeDropdownPopover } from '../TourTypeDropdownPopover/TourTypeDropdownPopover'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useDebounce } from '@/hooks/useDebounce'
import './ToursFilterPanel.css'

const DEFAULT_DESTINATIONS: string[] = []

export interface ToursFilterPanelProps {
  onSearch: (filters: TourFilterParams) => void
  onReset?: () => void
  isLoading?: boolean
  availableDestinations?: string[]
  initialFilters?: TourFilterParams
}

export const ToursFilterPanel: React.FC<ToursFilterPanelProps> = ({
  onSearch,
  onReset,
  isLoading = false,
  availableDestinations,
  initialFilters,
}) => {
  const [destination, setDestination] = useState(initialFilters?.destination || '')
  const [startDate, setStartDate] = useState(initialFilters?.startDate || '')
  const [endDate, setEndDate] = useState(initialFilters?.endDate || '')
  const [selectedDurations, setSelectedDurations] = useState<string[]>(
    initialFilters?.duration ? initialFilters.duration.split(', ').map(s => s.trim()).filter(Boolean) : []
  )
  const [selectedMealPlans, setSelectedMealPlans] = useState<MealPlanCode[]>(
    Array.isArray(initialFilters?.mealPlans)
      ? (initialFilters.mealPlans as MealPlanCode[])
      : typeof initialFilters?.mealPlan === 'string'
      ? (initialFilters.mealPlan.split(',').map(s => s.trim()) as MealPlanCode[])
      : []
  )
  const [selectedTourTypes, setSelectedTourTypes] = useState<ResortTypeCode[]>(
    Array.isArray(initialFilters?.tourTypes)
      ? (initialFilters.tourTypes as ResortTypeCode[])
      : typeof initialFilters?.tourType === 'string'
      ? (initialFilters.tourType.split(',').map(s => s.trim()) as ResortTypeCode[])
      : []
  )
  const [adults, setAdults] = useState(initialFilters?.adults ?? 1)
  const [childrenCount, setChildrenCount] = useState(initialFilters?.children ?? 0)

  // Sync state if initialFilters change externally (e.g. state restoration)
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.destination !== undefined) setDestination(initialFilters.destination || '')
      if (initialFilters.startDate !== undefined) setStartDate(initialFilters.startDate || '')
      if (initialFilters.endDate !== undefined) setEndDate(initialFilters.endDate || '')
      if (initialFilters.duration !== undefined) {
        setSelectedDurations(initialFilters.duration ? initialFilters.duration.split(', ').map(s => s.trim()).filter(Boolean) : [])
      }
      if (initialFilters.mealPlans !== undefined || initialFilters.mealPlan !== undefined) {
        const mp = initialFilters.mealPlans || initialFilters.mealPlan
        const parsed = Array.isArray(mp)
          ? mp
          : typeof mp === 'string'
          ? mp.split(',').map(s => s.trim())
          : []
        setSelectedMealPlans(parsed as MealPlanCode[])
      }
      if (initialFilters.tourTypes !== undefined || initialFilters.tourType !== undefined) {
        const tt = initialFilters.tourTypes || initialFilters.tourType
        const parsed = Array.isArray(tt)
          ? tt
          : typeof tt === 'string'
          ? tt.split(',').map(s => s.trim())
          : []
        setSelectedTourTypes(parsed as ResortTypeCode[])
      }
      if (initialFilters.adults !== undefined) setAdults(initialFilters.adults)
      if (initialFilters.children !== undefined) setChildrenCount(initialFilters.children)
    }
  }, [initialFilters])

  const debouncedDestination = useDebounce(destination, 300)

  const activeDestinations = availableDestinations && availableDestinations.length > 0
    ? availableDestinations
    : DEFAULT_DESTINATIONS

  const [isDestOpen, setIsDestOpen] = useState(false)
  const [destSuggestions, setDestSuggestions] = useState<string[]>(activeDestinations)

  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isGuestsOpen, setIsGuestsOpen] = useState(false)
  const [isMealOpen, setIsMealOpen] = useState(false)
  const [isTourTypeOpen, setIsTourTypeOpen] = useState(false)

  const destContainerRef = useRef<HTMLDivElement>(null)
  const dateContainerRef = useRef<HTMLDivElement>(null)
  const guestsContainerRef = useRef<HTMLDivElement>(null)
  const mealContainerRef = useRef<HTMLDivElement>(null)
  const tourTypeContainerRef = useRef<HTMLDivElement>(null)

  useClickOutside(destContainerRef, () => setIsDestOpen(false), isDestOpen)
  useClickOutside(dateContainerRef, () => setIsCalendarOpen(false), isCalendarOpen)
  useClickOutside(guestsContainerRef, () => setIsGuestsOpen(false), isGuestsOpen)
  useClickOutside(mealContainerRef, () => setIsMealOpen(false), isMealOpen)
  useClickOutside(tourTypeContainerRef, () => setIsTourTypeOpen(false), isTourTypeOpen)

  // Filter destination suggestions as user types (debounced)
  useEffect(() => {
    const val = debouncedDestination.trim().toLowerCase()
    if (!val) {
      setDestSuggestions(activeDestinations)
    } else {
      const filtered = activeDestinations.filter((d) => d.toLowerCase().includes(val))
      setDestSuggestions(filtered)
    }
  }, [debouncedDestination, activeDestinations])

  const dateDisplayValue = startDate || endDate || selectedDurations.length > 0
    ? [
      startDate && endDate
        ? `${startDate} - ${endDate}`
        : startDate
          ? `From ${startDate}`
          : '',
      selectedDurations.length > 0 ? `(${selectedDurations.join(', ')})` : ''
    ].filter(Boolean).join(' ')
    : ''

  const guestsDisplayValue = formatGuestCountLabel(adults, childrenCount)

  const mealDisplayValue = selectedMealPlans.length > 0
    ? selectedMealPlans
      .map((code) => MEAL_OPTIONS_LIST.find((m) => m.value === code)?.label || code)
      .join(', ')
    : ''

  const tourTypeDisplayValue = selectedTourTypes.length > 0
    ? selectedTourTypes
      .map((code) => TOUR_TYPE_OPTIONS_LIST.find((t) => t.value === code)?.label || code)
      .join(', ')
    : ''

  const handleToggleMealPlan = (code: MealPlanCode) => {
    setSelectedMealPlans((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    )
  }

  const handleToggleTourType = (code: ResortTypeCode) => {
    setSelectedTourTypes((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    )
  }

  const handleSearchTrigger = () => {
    if (startDate && endDate && endDate < startDate) {
      return
    }

    onSearch({
      destination: destination.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      duration: selectedDurations.join(', ') || undefined,
      mealPlans: selectedMealPlans.length > 0 ? selectedMealPlans : undefined,
      tourTypes: selectedTourTypes.length > 0 ? selectedTourTypes : undefined,
      adults,
      children: childrenCount,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearchTrigger()
    }
  }

  const handleReset = () => {
    setDestination('')
    setStartDate('')
    setEndDate('')
    setSelectedDurations([])
    setSelectedMealPlans([])
    setSelectedTourTypes([])
    setAdults(1)
    setChildrenCount(0)
    setIsDestOpen(false)
    setIsCalendarOpen(false)
    setIsGuestsOpen(false)
    setIsMealOpen(false)
    setIsTourTypeOpen(false)
    onReset?.()
  }

  return (
    <div
      className="tours-filter-panel"
      onKeyDown={handleKeyDown}
      data-testid="tours-filter-panel"
    >
      <div className="filter-panel-top">
        <h2 className="filter-panel-title">Search for your next tour</h2>
        {(destination || startDate || endDate || selectedDurations.length > 0 || selectedMealPlans.length > 0 || selectedTourTypes.length > 0 || adults > 1 || childrenCount > 0) && (
          <button
            type="button"
            className="filter-reset-btn"
            onClick={handleReset}
            data-testid="filter-reset-btn"
          >
            Reset filters
          </button>
        )}
      </div>

      <div className="filter-bar">
        {/* Destination (312px): Toggles DestinationDropdownPopover */}
        <div
          className={`filter-bar-item filter-item-dest ${isDestOpen ? 'is-active' : ''}`}
          ref={destContainerRef}
          data-testid="destination-picker-trigger"
        >
          <InputField
            leftIconSrc={locationIcon}
            placeholder="Any destination"
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value)
              setIsDestOpen(true)
            }}
            onFocus={() => {
              setIsCalendarOpen(false)
              setIsGuestsOpen(false)
              setIsMealOpen(false)
              setIsTourTypeOpen(false)
              setIsDestOpen(true)
            }}
            id="filter-destination"
            data-testid="filter-destination"
            rightElement={
              <img
                src={isDestOpen ? chevronUpIcon : chevronDownIcon}
                alt=""
                className="date-chevron-icon"
                aria-hidden="true"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsCalendarOpen(false)
                  setIsGuestsOpen(false)
                  setIsMealOpen(false)
                  setIsTourTypeOpen(false)
                  setIsDestOpen((prev) => !prev)
                }}
              />
            }
          />
          <DestinationDropdownPopover
            isOpen={isDestOpen}
            destinations={destSuggestions}
            selectedValue={destination}
            onSelectDestination={(dest) => {
              setDestination(dest)
              setIsDestOpen(false)
            }}
            onClose={() => setIsDestOpen(false)}
          />
        </div>

        {/* Date & Duration (256px): Toggles CalendarDurationPopover */}
        <div
          className={`filter-bar-item filter-item-date ${isCalendarOpen ? 'is-active' : ''}`}
          ref={dateContainerRef}
          onClick={() => {
            setIsGuestsOpen(false)
            setIsMealOpen(false)
            setIsTourTypeOpen(false)
            setIsCalendarOpen((prev) => !prev)
          }}
          data-testid="date-picker-trigger"
        >
          <InputField
            leftIconSrc={calendarIcon}
            type="text"
            readOnly
            placeholder="Any start date, any duration..."
            value={dateDisplayValue}
            id="filter-start-date"
            data-testid="filter-start-date"
            rightElement={
              <img
                src={isCalendarOpen ? chevronUpIcon : chevronDownIcon}
                alt=""
                className="date-chevron-icon"
                aria-hidden="true"
              />
            }
          />
          <CalendarDurationPopover
            isOpen={isCalendarOpen}
            onClose={() => setIsCalendarOpen(false)}
            selectedDate={startDate}
            selectedEndDate={endDate}
            selectedDurations={selectedDurations}
            onSelectDateRange={(start, end) => {
              setStartDate(start)
              setEndDate(end || '')
            }}
            onSelectDurations={setSelectedDurations}
          />
        </div>

        {/* Guest Quantity (208px): Toggles GuestsPopover */}
        <div
          className={`filter-bar-item filter-item-guests ${isGuestsOpen ? 'is-active' : ''}`}
          ref={guestsContainerRef}
          onClick={() => {
            setIsCalendarOpen(false)
            setIsMealOpen(false)
            setIsTourTypeOpen(false)
            setIsGuestsOpen((prev) => !prev)
          }}
          data-testid="guests-picker-trigger"
        >
          <InputField
            leftIconSrc={peopleIcon}
            type="text"
            readOnly
            value={guestsDisplayValue}
            id="filter-guests"
            data-testid="filter-guests"
            rightElement={
              <img
                src={isGuestsOpen ? chevronUpIcon : chevronDownIcon}
                alt=""
                className="date-chevron-icon"
                aria-hidden="true"
              />
            }
          />
          <GuestsPopover
            isOpen={isGuestsOpen}
            adults={adults}
            childrenCount={childrenCount}
            onChangeAdults={setAdults}
            onChangeChildren={setChildrenCount}
            onClose={() => setIsGuestsOpen(false)}
          />
        </div>

        {/* Meal Plan (200px): Toggles MealDropdownPopover */}
        <div
          className={`filter-bar-item filter-item-meal ${isMealOpen ? 'is-active' : ''}`}
          ref={mealContainerRef}
          onClick={() => {
            setIsCalendarOpen(false)
            setIsGuestsOpen(false)
            setIsTourTypeOpen(false)
            setIsMealOpen((prev) => !prev)
          }}
          data-testid="meal-picker-trigger"
        >
          <InputField
            leftIconSrc={mealIcon}
            type="text"
            readOnly
            placeholder="Meal"
            value={mealDisplayValue}
            id="filter-meal-plan"
            data-testid="filter-meal-plan"
            rightElement={
              <img
                src={isMealOpen ? chevronUpIcon : chevronDownIcon}
                alt=""
                className="date-chevron-icon"
                aria-hidden="true"
              />
            }
          />
          <MealDropdownPopover
            isOpen={isMealOpen}
            selectedMealPlans={selectedMealPlans}
            onToggleMealPlan={handleToggleMealPlan}
            onClose={() => setIsMealOpen(false)}
          />
        </div>

        {/* Tour Type (179px): Toggles TourTypeDropdownPopover */}
        <div
          className={`filter-bar-item filter-item-type ${isTourTypeOpen ? 'is-active' : ''}`}
          ref={tourTypeContainerRef}
          onClick={() => {
            setIsCalendarOpen(false)
            setIsGuestsOpen(false)
            setIsMealOpen(false)
            setIsTourTypeOpen((prev) => !prev)
          }}
          data-testid="tour-type-picker-trigger"
        >
          <InputField
            leftIconSrc={tourIcon}
            type="text"
            readOnly
            placeholder="Resorts"
            value={tourTypeDisplayValue}
            id="filter-resort-type"
            data-testid="filter-resort-type"
            rightElement={
              <img
                src={isTourTypeOpen ? chevronUpIcon : chevronDownIcon}
                alt=""
                className="date-chevron-icon"
                aria-hidden="true"
              />
            }
          />
          <TourTypeDropdownPopover
            isOpen={isTourTypeOpen}
            selectedTourTypes={selectedTourTypes}
            onToggleTourType={handleToggleTourType}
            onClose={() => setIsTourTypeOpen(false)}
          />
        </div>

        {/* Search Button (77px) */}
        <div className="filter-bar-item filter-submit-item">
          <Button
            variant="primary"
            fullWidth={false}
            onClick={handleSearchTrigger}
            disabled={isLoading}
            isLoading={isLoading}
            data-testid="filter-search-btn"
            className="filter-search-button"
          >
            Search
          </Button>
        </div>
      </div>
    </div>
  )
}
