import React, { useState } from 'react'
import chevronDownIcon from '../../../../assets/icons/Chevron-down.svg'
import './CalendarDurationPopover.css'

export interface DurationOption {
  id: string
  label: string
  value: string
}

export interface CalendarDurationPopoverProps {
  isOpen: boolean
  onClose: () => void
  selectedDate?: string
  selectedEndDate?: string
  selectedDurations?: string[]
  onSelectDateRange: (startDate: string, endDate?: string) => void
  onSelectDurations: (durations: string[]) => void
  /** 'range' (default) lets the user pick a start+end date, used by the tour search filters.
   *  'single' restricts selection to one day and treats it as both start and end date. */
  dateSelectionMode?: 'range' | 'single'
  /** When provided, only these ISO dates (YYYY-MM-DD) are selectable; others render muted. */
  availableDates?: string[]
  /** Called when the user clicks a past or unavailable date. */
  onUnavailableDateClick?: () => void
  /** Overrides the default filter duration buckets (e.g. with a tour's exact allowed durations). */
  durationOptions?: DurationOption[]
  /** 'multiple' (default) toggles durations on/off, used by the search filters.
   *  'single' replaces the selection with the clicked option, used by the booking form. */
  durationSelectionMode?: 'multiple' | 'single'
  /** Whether to render the duration column (default: true). Set false for calendar-only pickers. */
  showDuration?: boolean
  /** Whether to render the column heading (default: true). */
  showHeading?: boolean
  /** Whether past dates (before today) are selectable (default: false). True for reports. */
  allowPastDates?: boolean
}

const DAYS_OF_WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const DURATION_CHECKBOXES = [
  { id: '1-3', label: '1-3 days', value: '1-3 days' },
  { id: '4-7', label: '4-7 days', value: '4-7 days' },
  { id: '8-12', label: '8-12 days', value: '8-12 days' },
  { id: '13+', label: '13+ days', value: '13+ days' },
]

export const CalendarDurationPopover: React.FC<CalendarDurationPopoverProps> = ({
  isOpen,
  onClose: _onClose,
  selectedDate = '',
  selectedEndDate = '',
  selectedDurations = [],
  onSelectDateRange,
  onSelectDurations,
  dateSelectionMode = 'range',
  availableDates,
  onUnavailableDateClick,
  durationOptions,
  durationSelectionMode = 'multiple',
  showDuration = true,
  showHeading = true,
  allowPastDates = false,
}) => {
  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  const todayDay = today.getDate()
  const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`

  const [currentYear, setCurrentYear] = useState(todayYear)
  const [currentMonth, setCurrentMonth] = useState(todayMonth)

  if (!isOpen) return null

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((prev) => prev - 1)
    } else {
      setCurrentMonth((prev) => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((prev) => prev + 1)
    } else {
      setCurrentMonth((prev) => prev + 1)
    }
  }

  const handleDayClick = (day: number) => {
    const monthStr = String(currentMonth + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const clickedDateStr = `${currentYear}-${monthStr}-${dayStr}`
    const isPast = !allowPastDates && clickedDateStr < todayStr
    const isUnlisted = Boolean(availableDates && !availableDates.includes(clickedDateStr))

    if (isPast || isUnlisted) {
      onUnavailableDateClick?.()
      return
    }

    if (dateSelectionMode === 'single') {
      onSelectDateRange(clickedDateStr, clickedDateStr)
      return
    }

    if (!selectedDate || (selectedDate && selectedEndDate)) {
      // Pick new start date
      onSelectDateRange(clickedDateStr, '')
    } else if (selectedDate && !selectedEndDate) {
      if (clickedDateStr < selectedDate) {
        // Reset start date to earlier date
        onSelectDateRange(clickedDateStr, '')
      } else {
        // Pick end date
        onSelectDateRange(selectedDate, clickedDateStr)
      }
    }
  }

  const handleDurationToggle = (val: string) => {
    if (durationSelectionMode === 'single') {
      onSelectDurations([val])
      return
    }

    const isAlreadySelected = selectedDurations.includes(val)
    const updated = isAlreadySelected
      ? selectedDurations.filter((d) => d !== val)
      : [...selectedDurations, val]
    onSelectDurations(updated)
  }

  const activeDurationOptions = durationOptions ?? DURATION_CHECKBOXES

  // Days in month calculation
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDayIndex = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7 // Monday start

  const calendarCells = []
  // Empty padding cells
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push({ key: `empty-${i}`, day: null, muted: true, isStart: false, isEnd: false, isInRange: false, isToday: false })
  }

  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    const monthStr = String(currentMonth + 1).padStart(2, '0')
    const dayStr = String(d).padStart(2, '0')
    const dateFormatted = `${currentYear}-${monthStr}-${dayStr}`

    const isStart = selectedDate === dateFormatted
    const isEnd = selectedEndDate === dateFormatted
    const isInRange = Boolean(
      selectedDate &&
      selectedEndDate &&
      dateFormatted > selectedDate &&
      dateFormatted < selectedEndDate
    )
    const isToday = currentYear === todayYear && currentMonth === todayMonth && d === todayDay
    const isPastDate = !allowPastDates && dateFormatted < todayStr
    const isUnavailable = isPastDate || Boolean(availableDates && !availableDates.includes(dateFormatted))

    calendarCells.push({
      key: `day-${d}`,
      day: d,
      dateFormatted,
      isStart,
      isEnd,
      isInRange,
      isToday,
      muted: isUnavailable,
    })
  }

  return (
    <div
      className={`calendar-duration-popover ${!showDuration ? 'calendar-duration-popover--calendar-only' : ''}`}
      onClick={(e) => e.stopPropagation()}
      data-testid="calendar-duration-popover"
    >
      {/* Left Column: Calendar */}
      <div className="calendar-popover-col">
        {showHeading && <h3 className="calendar-popover-heading">Start date</h3>}

        <div className="calendar-month-nav">
          <button
            type="button"
            className="month-nav-btn prev-btn"
            onClick={handlePrevMonth}
            aria-label="Previous month"
          >
            <img src={chevronDownIcon} alt="" className="chevron-nav-icon rotate-left" />
          </button>
          <span className="month-nav-title">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button
            type="button"
            className="month-nav-btn next-btn"
            onClick={handleNextMonth}
            aria-label="Next month"
          >
            <img src={chevronDownIcon} alt="" className="chevron-nav-icon rotate-right" />
          </button>
        </div>

        <div className="calendar-days-grid">
          {/* Weekday headers */}
          <div className="calendar-weekdays-header">
            {DAYS_OF_WEEK.map((day, idx) => (
              <div key={idx} className="day-element weekday-header-cell">
                {day}
              </div>
            ))}
          </div>

          {/* Day numbers grid */}
          <div className="calendar-days-body">
            {calendarCells.map((cell) => {
              let cellStateClass = ''
              if (cell.isStart && cell.isEnd) {
                cellStateClass = 'selected-single'
              } else if (cell.isStart) {
                cellStateClass = 'selected-start'
              } else if (cell.isEnd) {
                cellStateClass = 'selected-end'
              } else if (cell.isInRange) {
                cellStateClass = 'in-range'
              }

              return (
                <button
                  type="button"
                  key={cell.key}
                  className={`day-element date-cell ${cell.muted ? 'muted' : ''} ${cell.isToday ? 'is-today' : ''} ${cellStateClass}`}
                  onClick={() => cell.day && handleDayClick(cell.day)}
                  disabled={!cell.day}
                  aria-disabled={cell.muted}
                  aria-label={cell.day ? `${monthNames[currentMonth]} ${cell.day}, ${currentYear}` : undefined}
                  aria-pressed={Boolean(cell.isStart || cell.isEnd)}
                >
                  {cell.day || ''}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Duration (Optional) */}
      {showDuration && (
        <div className="duration-popover-col">
          {showHeading && <h3 className="calendar-popover-heading">Duration</h3>}

          <div className="duration-checkboxes-list">
            {activeDurationOptions.map((dur) => {
              const isChecked = selectedDurations.includes(dur.value)
              return (
                <label key={dur.id} className="duration-checkbox-row">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleDurationToggle(dur.value)}
                    className="duration-native-checkbox"
                  />
                  <span className={`duration-custom-checkbox ${isChecked ? 'checked' : ''}`}>
                    {isChecked && '✓'}
                  </span>
                  <span className="duration-label-text">{dur.label}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
