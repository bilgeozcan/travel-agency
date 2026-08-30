import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { reportsService } from '@/api/services/reports.service'
import { ReportsPage } from './ReportsPage'

vi.mock('../../components/ReportFilterBar/ReportFilterBar', () => ({
  ReportFilterBar: ({ onGenerate }: { onGenerate: (filters: any) => void }) => (
    <button
      type="button"
      onClick={() =>
        onGenerate({
          reportType: 'SALES',
          startDate: '2026-08-01',
          endDate: '2026-08-07',
          location: 'Punta Cana',
        })
      }
    >
      Generate test report
    </button>
  ),
}))

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the required error message and closes it with Escape', async () => {
    const user = userEvent.setup()
    vi.spyOn(reportsService, 'generateReport').mockRejectedValueOnce(new Error('Network failed'))
    render(<ReportsPage />)

    await user.click(screen.getByRole('button', { name: 'Generate test report' }))

    expect(await screen.findByTestId('report-error-message')).toHaveTextContent(
      'There has been an error while generating the report, please try again'
    )
    expect(screen.getByTestId('report-error-close')).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('report-error-popup')).not.toBeInTheDocument()
  })

  it('allows an empty generated report to be downloaded', async () => {
    const user = userEvent.setup()
    vi.spyOn(reportsService, 'generateReport').mockResolvedValueOnce({
      success: true,
      data: {
        cachedReportKey: 'empty-report',
        reportType: 'SALES',
        reportData: { columns: ['Tour name'], rows: [] },
      },
    })
    render(<ReportsPage />)

    await user.click(screen.getByRole('button', { name: 'Generate test report' }))

    expect(await screen.findByTestId('reports-empty-state')).toBeInTheDocument()
    expect(screen.getByTestId('download-report-btn')).toBeInTheDocument()
  })

  it('announces report generation while the request is pending', async () => {
    let resolveRequest: (value: any) => void = () => undefined
    vi.spyOn(reportsService, 'generateReport').mockImplementationOnce(
      () => new Promise((resolve) => { resolveRequest = resolve })
    )
    render(<ReportsPage />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Generate test report' }))

    expect(screen.getByRole('status')).toHaveTextContent('Generating report')
    resolveRequest({
      success: true,
      data: {
        cachedReportKey: 'report',
        reportType: 'SALES',
        reportData: { columns: [], rows: [] },
      },
    })
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })
})
