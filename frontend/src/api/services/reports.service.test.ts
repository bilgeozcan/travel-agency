import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reportsService } from './reports.service'
import { apiClient } from '../client/apiClient'
import type { GenerateReportRequest } from '@/features/reports/types/reports'

describe('reportsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateReport', () => {
    const validPayload: GenerateReportRequest = {
      reportType: 'SALES',
      startDate: '2026-08-01',
      endDate: '2026-08-07',
      location: 'Punta Cana',
    }

    it('happy path: successfully generates report with normalized lowercase location', async () => {
      const mockResponse = {
        success: true,
        data: {
          cachedReportKey: 'test-cache-uuid',
          reportType: 'SALES' as const,
          reportData: {
            columns: ['Tour name', 'Destination country'],
            rows: [['Multiple', 'Punta Cana']],
          },
        },
      }

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockResponse)

      const result = await reportsService.generateReport(validPayload)

      expect(postSpy).toHaveBeenCalledWith('/reports/generate', {
        reportType: 'SALES',
        startDate: '2026-08-01',
        endDate: '2026-08-07',
        location: 'punta cana', // normalized to lowercase
      })
      expect(result).toEqual(mockResponse)
    })

    it('unhappy path: throws error when startDate is not YYYY-MM-DD format', async () => {
      const invalidPayload = { ...validPayload, startDate: '01-08-2026' }
      await expect(reportsService.generateReport(invalidPayload)).rejects.toThrow(
        'Invalid date. Expected a valid YYYY-MM-DD date.'
      )
    })

    it('unhappy path: throws error when endDate is not YYYY-MM-DD format', async () => {
      const invalidPayload = { ...validPayload, endDate: 'invalid-date' }
      await expect(reportsService.generateReport(invalidPayload)).rejects.toThrow(
        'Invalid date. Expected a valid YYYY-MM-DD date.'
      )
    })

    it('unhappy path: rejects an invalid calendar date', async () => {
      await expect(
        reportsService.generateReport({ ...validPayload, startDate: '2026-02-31' })
      ).rejects.toThrow('Invalid date. Expected a valid YYYY-MM-DD date.')
    })

    it('unhappy path: rejects a reversed period', async () => {
      await expect(
        reportsService.generateReport({
          ...validPayload,
          startDate: '2026-08-07',
          endDate: '2026-08-01',
        })
      ).rejects.toThrow('The report start date must be on or before the end date.')
    })

    it('unhappy path: propagates apiClient failure/rejection', async () => {
      vi.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Network error'))

      await expect(reportsService.generateReport(validPayload)).rejects.toThrow('Network error')
    })
  })

  describe('downloadReport', () => {
    it('happy path: calls /reports/download with format and cachedReportKey query params', async () => {
      const mockResponse = {
        success: true,
        data: {
          fileUrl: 'https://s3.amazonaws.com/test-bucket/report.pdf?presigned=true',
        },
      }

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockResponse)

      const result = await reportsService.downloadReport('cache-key-123', 'pdf')

      expect(getSpy).toHaveBeenCalledWith('/reports/download?cachedReportKey=cache-key-123&format=pdf')
      expect(result).toEqual(mockResponse)
    })

    it('unhappy path: propagates error on download failure', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('Download failed'))

      await expect(reportsService.downloadReport('cache-key-123', 'csv')).rejects.toThrow('Download failed')
    })
  })
})
