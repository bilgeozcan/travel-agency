import React, { useEffect, useRef, useState } from 'react'
import { reportsService } from '@/api/services/reports.service'
import type {
  GenerateReportResponse,
  ReportDownloadFormat,
  ReportFilters,
} from '../../types/reports'
import { ReportFilterBar } from '../../components/ReportFilterBar/ReportFilterBar'
import { ReportDownloadMenu } from '../../components/ReportDownloadMenu/ReportDownloadMenu'
import './ReportsPage.css'

// ─── Constants ────────────────────────────────────────────────────────────────

const GENERATE_ERROR_MESSAGE =
  'There has been an error while generating the report, please try again'
const DOWNLOAD_ERROR_MESSAGE =
  'There has been an error while downloading the report, please try again'

// ─── Component ────────────────────────────────────────────────────────────────

export const ReportsPage: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [reportData, setReportData] = useState<GenerateReportResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [downloadingFormat, setDownloadingFormat] = useState<ReportDownloadFormat | null>(null)
  const errorCloseRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!errorMessage) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    errorCloseRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setErrorMessage(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [errorMessage])

  // ── Generate Report ───────────────────────────────────────────────────────

  const handleGenerate = async (filters: ReportFilters) => {
    setIsGenerating(true)
    setReportData(null)
    setErrorMessage(null)

    try {
      const response = await reportsService.generateReport({
        reportType: filters.reportType,
        startDate: filters.startDate,
        endDate: filters.endDate,
        location: filters.location,
      })

      if (response.success && response.data) {
        setReportData(response.data)
      } else {
        setErrorMessage(response.message ?? GENERATE_ERROR_MESSAGE)
      }
    } catch (err) {
      setErrorMessage(GENERATE_ERROR_MESSAGE)
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Download Report ───────────────────────────────────────────────────────

  const handleDownload = async (format: ReportDownloadFormat) => {
    if (!reportData) return

    setDownloadingFormat(format)
    setErrorMessage(null)

    try {
      const response = await reportsService.downloadReport(reportData.cachedReportKey, format)

      if (!response.success || !response.data?.fileUrl) {
        setErrorMessage(response.message ?? DOWNLOAD_ERROR_MESSAGE)
        return
      }

      // No `download` attribute: the URL is a cross-origin presigned S3 link, so the
      // browser ignores it anyway and uses the object's Content-Disposition filename.
      const link = document.createElement('a')
      link.href = response.data.fileUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      setErrorMessage(DOWNLOAD_ERROR_MESSAGE)
    } finally {
      setDownloadingFormat(null)
    }
  }

  // ── Error popup close ─────────────────────────────────────────────────────

  const handleCloseError = () => setErrorMessage(null)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="reports-page" data-testid="reports-page">
      <main className="reports-page__content">
        {/* ── Filter bar (permanently mounted to preserve user selection) ──── */}
        <ReportFilterBar onGenerate={handleGenerate} isGenerating={isGenerating} />

        {/* ── In-page loader (below filter bar) ─────────────────────────────── */}
        {isGenerating && (
          <div className="reports-page__loading-card" data-testid="reports-generating-loader" role="status" aria-live="polite">
            <div className="reports-page__spinner" aria-hidden="true" />
            <p className="reports-page__loading-text">Generating report…</p>
          </div>
        )}

        {/* ── Empty state (centered cleanly within content width) ─────────── */}
        {!isGenerating && reportData && reportData.reportData.rows.length === 0 && (
          <div className="reports-page__empty-card" data-testid="reports-empty-state">
            <p className="reports-page__empty-text">
              No data available for the selected period and location.
            </p>
          </div>
        )}

        {/* ── Report table (only rendered when there are rows) ─────────────── */}
        {!isGenerating && reportData && reportData.reportData.rows.length > 0 && (
          <section className="reports-page__table-section" aria-label="Generated report">
            <table className="reports-table" data-testid="report-table">
              <thead>
                <tr>
                  {reportData.reportData.columns.map((col) => (
                    <th key={col} className="reports-table__th">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.reportData.rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="reports-table__row">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="reports-table__td">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── Download menu (right-aligned, 8px below the report table) ────── */}
        {!isGenerating && reportData && (
          <div className="reports-page__download-row">
            <ReportDownloadMenu
              onDownload={handleDownload}
              downloadingFormat={downloadingFormat}
            />
          </div>
        )}
      </main>

      {/* ── Error popup (AC: 'X' icon, specific error text) ───────────────── */}
      {errorMessage && (
        <div
          className="reports-page__error-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Report error"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) handleCloseError()
          }}
          data-testid="report-error-popup"
        >
          <div className="reports-page__error-popup">
            <button
              type="button"
              ref={errorCloseRef}
              className="reports-page__error-close"
              aria-label="Close error"
              onClick={handleCloseError}
              data-testid="report-error-close"
            >
              ✕
            </button>
            <p className="reports-page__error-text" data-testid="report-error-message">
              {errorMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
