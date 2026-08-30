import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReportDownloadMenu } from './ReportDownloadMenu'

describe('ReportDownloadMenu', () => {
  it('keeps the format popover closed until the trigger is clicked', () => {
    render(<ReportDownloadMenu onDownload={vi.fn()} />)

    expect(screen.getByTestId('download-report-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('report-download-popover')).not.toBeInTheDocument()
  })

  it('offers PDF, XLSX and CSV once opened', async () => {
    const user = userEvent.setup()
    render(<ReportDownloadMenu onDownload={vi.fn()} />)

    await user.click(screen.getByTestId('download-report-btn'))

    expect(screen.getByTestId('report-download-option-pdf')).toHaveTextContent('PDF')
    expect(screen.getByTestId('report-download-option-excel')).toHaveTextContent('XLSX')
    expect(screen.getByTestId('report-download-option-csv')).toHaveTextContent('CSV')
  })

  it.each([
    ['pdf' as const],
    ['excel' as const],
    ['csv' as const],
  ])('emits onDownload("%s") and closes the popover', async (format) => {
    const user = userEvent.setup()
    const onDownload = vi.fn()
    render(<ReportDownloadMenu onDownload={onDownload} />)

    await user.click(screen.getByTestId('download-report-btn'))
    await user.click(screen.getByTestId(`report-download-option-${format}`))

    expect(onDownload).toHaveBeenCalledExactlyOnceWith(format)
    expect(screen.queryByTestId('report-download-popover')).not.toBeInTheDocument()
  })

  it('closes the popover on an outside click', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <ReportDownloadMenu onDownload={vi.fn()} />
        <button type="button" data-testid="outside">
          outside
        </button>
      </div>
    )

    await user.click(screen.getByTestId('download-report-btn'))
    expect(screen.getByTestId('report-download-popover')).toBeInTheDocument()

    await user.click(screen.getByTestId('outside'))
    expect(screen.queryByTestId('report-download-popover')).not.toBeInTheDocument()
  })

  it('shows a loading trigger and blocks further selection while downloading', async () => {
    const user = userEvent.setup()
    const onDownload = vi.fn()
    render(<ReportDownloadMenu onDownload={onDownload} downloadingFormat="excel" />)

    const trigger = screen.getByTestId('download-report-btn')
    expect(trigger).toBeDisabled()
    expect(trigger).toHaveAttribute('aria-busy', 'true')
    // 112px trigger has no room for a loading label — spinner replaces the content.
    expect(trigger).not.toHaveTextContent('Download')

    await user.click(trigger)
    expect(screen.queryByTestId('report-download-popover')).not.toBeInTheDocument()
    expect(onDownload).not.toHaveBeenCalled()
  })

  it('does not open when disabled', async () => {
    const user = userEvent.setup()
    render(<ReportDownloadMenu onDownload={vi.fn()} disabled />)

    await user.click(screen.getByTestId('download-report-btn'))

    expect(screen.getByTestId('download-report-btn')).toBeDisabled()
    expect(screen.queryByTestId('report-download-popover')).not.toBeInTheDocument()
  })
})
