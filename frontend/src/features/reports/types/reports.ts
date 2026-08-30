// ============================================================
// Reports Feature – Type Definitions
// Covers US_11 (Report Generation & Download – Admin only)
// ============================================================

/** Maps to backend's `reportType` field. */
export type ReportType = 'STAFF_PERFORMANCE' | 'SALES'

/** Maps to backend's `format` query param for /reports/download. */
export type ReportDownloadFormat = 'pdf' | 'excel' | 'csv'

/** Partial filter state (controlled by ReportFilterBar, may be incomplete) */
export interface ReportFilterState {
  reportType: ReportType | ''
  startDate: string
  endDate: string
  location: string
}

/** Validated/complete filters — safe to send to API */
export interface ReportFilters {
  reportType: ReportType
  startDate: string
  endDate: string
  location: string
}

/** POST /reports/generate – request payload. */
export interface GenerateReportRequest {
  reportType: ReportType
  startDate: string
  endDate: string
  location: string
}

/** POST /reports/generate – response data. */
export interface GenerateReportResponse {
  cachedReportKey: string
  reportType: ReportType
  reportData: ReportData
}

/** Tabular report data shared between generate and download flows. */
export interface ReportData {
  columns: string[]
  rows: string[][]
}

/** GET /reports/download – response data. */
export interface DownloadReportResponse {
  fileUrl: string
}
