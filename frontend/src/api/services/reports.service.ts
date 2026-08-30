import { apiClient } from '../client/apiClient'
import type { ApiResponse } from '../types/api.types'
import type {
  GenerateReportRequest,
  GenerateReportResponse,
  DownloadReportResponse,
  ReportDownloadFormat,
} from '@/features/reports/types/reports'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const isValidIsoDate = (value: string): boolean => {
  if (!DATE_REGEX.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

class ReportsService {
  /**
   * POST /reports/generate
   * Sends filter params, gets back a cachedReportKey + reportData table.
   * Normalizes location to lowercase to match backend DynamoDB partition/sort key schema.
   */
  public async generateReport(
    payload: GenerateReportRequest
  ): Promise<ApiResponse<GenerateReportResponse>> {
    if (!isValidIsoDate(payload.startDate) || !isValidIsoDate(payload.endDate)) {
      throw new Error('Invalid date. Expected a valid YYYY-MM-DD date.')
    }

    if (payload.startDate > payload.endDate) {
      throw new Error('The report start date must be on or before the end date.')
    }

    if (!payload.location.trim()) {
      throw new Error('A report location is required.')
    }

    const normalizedPayload: GenerateReportRequest = {
      ...payload,
      location: payload.location.trim().toLowerCase(),
    }

    return apiClient.post<GenerateReportResponse>('/reports/generate', normalizedPayload)
  }

  /**
   * GET /reports/download?cachedReportKey=...&format=...
   * Returns a presigned S3 URL to download the generated file.
   */
  public downloadReport(
    cachedReportKey: string,
    format: ReportDownloadFormat
  ): Promise<ApiResponse<DownloadReportResponse>> {
    const params = new URLSearchParams({ cachedReportKey, format })
    return apiClient.get<DownloadReportResponse>(`/reports/download?${params.toString()}`)
  }
}

export const reportsService = new ReportsService()
