import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button/Button'
import { useClickOutside } from '@/hooks/useClickOutside'
import type { ReportDownloadFormat } from '../../types/reports'
import './ReportDownloadMenu.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const DOWNLOAD_FORMAT_OPTIONS: Array<{ label: string; value: ReportDownloadFormat }> = [
  { label: 'PDF', value: 'pdf' },
  { label: 'XLSX', value: 'excel' },
  { label: 'CSV', value: 'csv' },
]

/**
 * Chevron is inlined rather than loaded from @/assets/icons so `currentColor`
 * resolves against the button's own text colour — an <img> would render black
 * against the outline variant's blue label.
 */
const Chevron: React.FC<{ direction: 'up' | 'down' }> = ({ direction }) => (
  <svg
    className="report-download-menu__chevron"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d={direction === 'up' ? 'M6 15L12 9L18 15' : 'M6 9L12 15L18 9'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ReportDownloadMenuProps {
  /** Fires with the chosen format; parent resolves the presigned URL and triggers the file save. */
  onDownload: (format: ReportDownloadFormat) => void
  /** Format currently being fetched — keeps the trigger in its loading state. */
  downloadingFormat?: ReportDownloadFormat | null
  disabled?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ReportDownloadMenu: React.FC<ReportDownloadMenuProps> = ({
  onDownload,
  downloadingFormat = null,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useClickOutside(menuRef, () => setIsOpen(false), isOpen)

  const isDownloading = downloadingFormat !== null
  const isDisabled = disabled || isDownloading

  const handleSelect = (format: ReportDownloadFormat) => {
    setIsOpen(false)
    onDownload(format)
  }

  return (
    <div className="report-download-menu" ref={menuRef} data-testid="report-download-menu">
      <Button
        type="button"
        id="download-report-btn"
        data-testid="download-report-btn"
        variant="outline"
        fullWidth={false}
        disabled={isDisabled}
        isLoading={isDownloading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="download-report-listbox"
        className="report-download-menu__trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="report-download-menu__trigger-content">
          Download
          <Chevron direction={isOpen ? 'up' : 'down'} />
        </span>
      </Button>

      {isOpen && !isDisabled && (
        <div
          id="download-report-listbox"
          role="listbox"
          className="report-download-menu__popover"
          data-testid="report-download-popover"
        >
          {DOWNLOAD_FORMAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={false}
              className="report-download-menu__option"
              data-testid={`report-download-option-${option.value}`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
