import React, { useEffect, useRef, useState } from 'react'
import calendarIcon from '@/assets/icons/Calendar.svg'
import chevronDownIcon from '@/assets/icons/Chevron-down.svg'
import chevronUpIcon from '@/assets/icons/Chevron-up.svg'
import locationIcon from '@/assets/icons/Location.svg'
import { Button } from '@/components/ui/Button/Button'
import { InputField } from '@/components/ui/InputField/InputField'
import { Select } from '@/components/ui/Select/Select'
import { CalendarDurationPopover } from '@/features/tours/components/CalendarDurationPopover/CalendarDurationPopover'
import { DestinationDropdownPopover } from '@/features/tours/components/DestinationDropdownPopover/DestinationDropdownPopover'
import { toursService } from '@/api/services/tours.service'
import { extractUniqueDestinations } from '@/utils/toursValidation'
import { useClickOutside } from '@/hooks/useClickOutside'
import type { ReportFilters, ReportType } from '../../types/reports'
import './ReportFilterBar.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORT_TYPE_OPTIONS = [
  { label: 'Staff performance', value: 'STAFF_PERFORMANCE' as ReportType },
  { label: 'Sales', value: 'SALES' as ReportType },
]
const LOCATION_PAGE_SIZE = 50

/**
 * ARCHITECTURAL NOTE (Option A Trade-off):
 * Locations are dynamically derived from active tours catalog via toursService.getAvailableTours()
 * and extractUniqueDestinations().
 * 
 * Future Enhancement (Option B):
 * When a dedicated `GET /reports/locations` endpoint is added to backend API,
 * switch to fetching distinct locations recorded directly in the Reports DynamoDB table.
 */

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ReportFilterBarProps {
  onGenerate: (filters: ReportFilters) => void
  isGenerating?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDateRange = (start: string, end: string): string => {
  if (start && end) return `${start} – ${end}`
  if (start) return `From ${start}`
  return ''
}

// ─── Component ────────────────────────────────────────────────────────────────

// ─── Module-Level Cache ───────────────────────────────────────────────────────
// Caches fetched locations across component mounts to eliminate layout/popover flicker
let cachedReportLocations: string[] | null = null

export const ReportFilterBar: React.FC<ReportFilterBarProps> = ({
  onGenerate,
  isGenerating = false,
}) => {
  // Filter state
  const [reportType, setReportType] = useState<ReportType | ''>('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [availableLocations, setAvailableLocations] = useState<string[]>(
    () => cachedReportLocations || []
  )
  const [isLoadingLocations, setIsLoadingLocations] = useState(!cachedReportLocations)
  const [locationError, setLocationError] = useState<string | null>(null)

  // Fetch available destinations dynamically with module cache
  const loadLocations = async () => {
    if (cachedReportLocations && cachedReportLocations.length > 0) {
      setAvailableLocations(cachedReportLocations)
      setLocationError(null)
      return
    }

    setIsLoadingLocations(true)
    setLocationError(null)
    try {
      const firstPage = await toursService.getAvailableTours({ page: 1, pageSize: LOCATION_PAGE_SIZE })
      const pages = await Promise.all(
        Array.from({ length: Math.max(firstPage.totalPages - 1, 0) }, (_, index) =>
          toursService.getAvailableTours({ page: index + 2, pageSize: LOCATION_PAGE_SIZE })
        )
      )
      const unique = extractUniqueDestinations([
        ...firstPage.tours,
        ...pages.flatMap((page) => page.tours),
      ])

      cachedReportLocations = unique
      setAvailableLocations(unique)
      if (unique.length === 0) {
        setLocationError('No report locations are currently available.')
      }
    } catch {
      setLocationError('Unable to load locations. Please try again.')
    } finally {
      setIsLoadingLocations(false)
    }
  }

  useEffect(() => {
    // Already primed from the module cache by the useState initializers — nothing to fetch.
    if (cachedReportLocations && cachedReportLocations.length > 0) return

    let isCurrent = true

    void loadLocations().finally(() => {
      if (!isCurrent) return
    })

    return () => {
      isCurrent = false
    }
  }, [])

  // Popover open states
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [isLocationOpen, setIsLocationOpen] = useState(false)

  // Refs for click-outside detection
  const calendarRef = useRef<HTMLDivElement>(null)
  const locationRef = useRef<HTMLDivElement>(null)

  useClickOutside(calendarRef, () => setIsCalendarOpen(false), isCalendarOpen)
  useClickOutside(locationRef, () => setIsLocationOpen(false), isLocationOpen)

  // "Generate report" is enabled only when all three fields are filled
  const isReady = Boolean(reportType && startDate && endDate && location)

  const handleGenerate = () => {
    if (!reportType || !startDate || !endDate || !location || isGenerating) return
    onGenerate({ reportType, startDate, endDate, location })
  }

  const dateDisplayValue = formatDateRange(startDate, endDate)

  return (
    <div className="report-filter-bar" data-testid="report-filter-bar">
      {/* ── Report Type ──────────────────────────────────────────────────── */}
      <div className="report-filter-bar__item report-filter-bar__item--type">
        <Select
          id="report-type-select"
          placeholder="Select report type"
          options={REPORT_TYPE_OPTIONS}
          value={reportType}
          onChange={(val) => setReportType(val as ReportType)}
          portal
        />
      </div>

      {/* ── Period (date range via CalendarDurationPopover) ─────────────── */}
      <div
        className={`report-filter-bar__item report-filter-bar__item--period ${isCalendarOpen ? 'is-active' : ''}`}
        ref={calendarRef}
        onClick={() => {
          setIsLocationOpen(false)
          setIsCalendarOpen((prev) => !prev)
        }}
        data-testid="report-period-trigger"
      >
        <InputField
          leftIconSrc={calendarIcon}
          type="text"
          readOnly
          placeholder="Select period"
          value={dateDisplayValue}
          id="report-filter-period"
          data-testid="report-filter-period"
          rightElement={
            <img
              src={isCalendarOpen ? chevronUpIcon : chevronDownIcon}
              alt=""
              className="report-filter-bar__chevron"
              aria-hidden="true"
            />
          }
        />
        <CalendarDurationPopover
          isOpen={isCalendarOpen}
          onClose={() => setIsCalendarOpen(false)}
          selectedDate={startDate}
          selectedEndDate={endDate}
          selectedDurations={[]}
          onSelectDateRange={(start, end) => {
            setStartDate(start)
            setEndDate(end ?? '')
          }}
          onSelectDurations={() => undefined}
          dateSelectionMode="range"
          showDuration={false}
          showHeading={false}
          allowPastDates={true}
        />
      </div>

      {/* ── Location ─────────────────────────────────────────────────────── */}
      <div
        className={`report-filter-bar__item report-filter-bar__item--location ${isLocationOpen ? 'is-active' : ''}`}
        ref={locationRef}
        data-testid="report-location-trigger"
      >
        <InputField
          leftIconSrc={locationIcon}
          type="text"
          readOnly
          placeholder={isLoadingLocations ? 'Loading locations…' : 'Select location'}
          value={location}
          id="report-filter-location"
          data-testid="report-filter-location"
          disabled={isLoadingLocations}
          rightElement={
            <img
              src={isLocationOpen ? chevronUpIcon : chevronDownIcon}
              alt=""
              className="report-filter-bar__chevron"
              aria-hidden="true"
              onClick={(e) => {
                e.stopPropagation()
                if (isLoadingLocations) return
                setIsCalendarOpen(false)
                setIsLocationOpen((prev) => !prev)
              }}
            />
          }
          onClick={() => {
            if (isLoadingLocations) return
            setIsCalendarOpen(false)
            setIsLocationOpen((prev) => !prev)
          }}
        />
        <DestinationDropdownPopover
          isOpen={isLocationOpen && !isLoadingLocations && availableLocations.length > 0}
          destinations={availableLocations}
          selectedValue={location}
          onSelectDestination={(dest) => {
            setLocation(dest)
            setIsLocationOpen(false)
          }}
          onClose={() => setIsLocationOpen(false)}
        />
        {locationError && (
          <div className="report-filter-bar__location-error" role="alert">
            <span>{locationError}</span>
            <button type="button" onClick={() => void loadLocations()} disabled={isLoadingLocations}>
              Retry
            </button>
          </div>
        )}
      </div>

      {/* ── Generate Report button ────────────────────────────────────────── */}
      <div className="report-filter-bar__item report-filter-bar__item--action">
        <Button
          id="generate-report-btn"
          data-testid="generate-report-btn"
          variant="primary"
          fullWidth={false}
          disabled={!isReady}
          isLoading={isGenerating}
          loadingText="Generating…"
          onClick={handleGenerate}
        >
          Generate report
        </Button>
      </div>
    </div>
  )
}
