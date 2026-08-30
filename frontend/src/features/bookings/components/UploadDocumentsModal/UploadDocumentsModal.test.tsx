import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UploadDocumentsModal } from './UploadDocumentsModal'
import { bookingsService } from '@/api/services/bookings.service'
import type { TourBooking } from '../../types/bookings'

vi.mock('@/api/services/bookings.service', () => ({
  bookingsService: {
    getBookingDocuments: vi.fn(),
    getDocumentDownloadUrl: vi.fn(),
  },
}))

const mockBooking: TourBooking = {
  id: 'b1',
  tourId: 't1',
  tourTitle: 'Beach Getaway',
  destination: 'Antalya',
  hotelName: 'Sun Resort',
  heroImage: '',
  startDate: '2026-09-10',
  endDate: '2026-09-17',
  durationDays: 7,
  adultsCount: 2,
  childrenCount: 0,
  guestsCount: 2,
  guests: [
    { firstName: 'Ada', lastName: 'Lovelace' },
    { firstName: 'Alan', lastName: 'Turing' },
  ],
  mealPlan: 'AI',
  totalPrice: 1500,
  currency: 'USD',
  status: 'BOOKED',
  documentsUploaded: false,
}

function makeFile(name: string, size: number, type = 'application/pdf'): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function renderModal(props: Partial<React.ComponentProps<typeof UploadDocumentsModal>> = {}) {
  const onClose = props.onClose ?? vi.fn()
  const onSave = props.onSave ?? vi.fn()
  const utils = render(
    <UploadDocumentsModal
      isOpen
      booking={mockBooking}
      onClose={onClose}
      onSave={onSave}
      {...props}
    />
  )
  return { ...utils, onClose, onSave }
}

/** Drops files onto the drop zone of whichever field tab is active. */
function dropFiles(files: File[]) {
  fireEvent.drop(screen.getByTestId('upload-documents-dropzone'), {
    dataTransfer: { files },
  })
}

async function waitForFieldsLoaded() {
  await waitFor(() =>
    expect(screen.getByTestId('upload-field-tab-payment-confirmation')).toBeInTheDocument()
  )
}

beforeEach(() => {
  vi.mocked(bookingsService.getBookingDocuments).mockReset()
  vi.mocked(bookingsService.getBookingDocuments).mockResolvedValue([])
})

describe('UploadDocumentsModal — rendering', () => {
  it('renders nothing when closed or when there is no booking', () => {
    const { container, rerender } = render(
      <UploadDocumentsModal isOpen={false} booking={mockBooking} onClose={vi.fn()} onSave={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()

    rerender(<UploadDocumentsModal isOpen booking={null} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a passport tab per guest plus payment confirmation, and the attachments panel', async () => {
    renderModal()
    await waitForFieldsLoaded()

    expect(screen.getByText('Passport Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Passport Alan Turing')).toBeInTheDocument()
    expect(screen.getByText('Payment confirmation')).toBeInTheDocument()
    expect(screen.getByText('Add attachments')).toBeInTheDocument()
    expect(screen.getByText('Click to upload or drag and drop')).toBeInTheDocument()
  })

  it('falls back to a numbered passport label when the guest name is missing', async () => {
    renderModal({
      booking: { ...mockBooking, guests: [{ firstName: '', lastName: '' }], guestsCount: 1 },
    })
    await waitForFieldsLoaded()

    expect(screen.getByText('Passport Guest 1')).toBeInTheDocument()
  })

  it('titles the modal "Update documents" in update mode', async () => {
    renderModal({ isUpdate: true })
    await waitForFieldsLoaded()

    expect(screen.getByText('Update documents')).toBeInTheDocument()
  })
})

describe('UploadDocumentsModal — attaching files', () => {
  it('lists a dropped file with its size and marks the field as complete', async () => {
    renderModal()
    await waitForFieldsLoaded()

    dropFiles([makeFile('ada-passport.pdf', 2048)])

    expect(await screen.findByText('ada-passport.pdf')).toBeInTheDocument()
    expect(screen.getByText('2 KB')).toBeInTheDocument()
    expect(screen.getByTestId('upload-field-tab-passport-0')).toContainElement(
      screen.getAllByLabelText('Documents uploaded')[0]
    )
  })

  it('removes a file via the trash icon', async () => {
    renderModal()
    await waitForFieldsLoaded()
    dropFiles([makeFile('ada-passport.pdf', 2048)])
    await screen.findByText('ada-passport.pdf')

    fireEvent.click(screen.getByLabelText('Remove ada-passport.pdf'))

    await waitFor(() =>
      expect(screen.queryByText('ada-passport.pdf')).not.toBeInTheDocument()
    )
    expect(screen.queryByLabelText('Documents uploaded')).not.toBeInTheDocument()
  })

  it('shows the 5MB popup and does not attach an oversized file', async () => {
    renderModal()
    await waitForFieldsLoaded()

    dropFiles([makeFile('huge.pdf', 6 * 1024 * 1024)])

    expect(
      await screen.findByText('The file you try to upload is larger than 5MB')
    ).toBeInTheDocument()
    expect(screen.getByTestId('upload-documents-size-error-body')).toHaveTextContent('huge.pdf')
    expect(screen.queryByTestId('upload-documents-file-list')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('upload-documents-size-error-close-btn'))
    await waitFor(() =>
      expect(
        screen.queryByText('The file you try to upload is larger than 5MB')
      ).not.toBeInTheDocument()
    )
  })

  it('shows the format popup for an unsupported file', async () => {
    renderModal()
    await waitForFieldsLoaded()

    dropFiles([makeFile('notes.docx', 1024, 'application/msword')])

    expect(await screen.findByText('Please upload a PDF, PNG, or JPG file')).toBeInTheDocument()
    expect(screen.getByTestId('upload-documents-type-error-body')).toHaveTextContent('notes.docx')
  })
})

describe('UploadDocumentsModal — saving', () => {
  it('enables Save only once every field has a document, then calls onSave', async () => {
    const onSave = vi.fn()
    renderModal({ onSave })
    await waitForFieldsLoaded()

    const saveButton = screen.getByTestId('upload-documents-save-btn')
    expect(saveButton).toBeDisabled()

    dropFiles([makeFile('ada.pdf', 1024)])
    await screen.findByText('ada.pdf')
    expect(saveButton).toBeDisabled()

    fireEvent.click(screen.getByTestId('upload-field-tab-passport-1'))
    dropFiles([makeFile('alan.pdf', 1024)])
    await screen.findByText('alan.pdf')
    expect(saveButton).toBeDisabled()

    fireEvent.click(screen.getByTestId('upload-field-tab-payment-confirmation'))
    dropFiles([makeFile('receipt.pdf', 1024)])
    await screen.findByText('receipt.pdf')
    await waitFor(() => expect(saveButton).toBeEnabled())

    fireEvent.click(saveButton)
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  })

  it('calls onClose when Cancel is pressed', async () => {
    const { onClose } = renderModal()
    await waitForFieldsLoaded()

    fireEvent.click(screen.getByTestId('upload-documents-cancel-btn'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('UploadDocumentsModal — existing documents', () => {
  it('shows each stored document under the field it belongs to', async () => {
    vi.mocked(bookingsService.getBookingDocuments).mockResolvedValue([
      { id: 'd1', name: 'ada.pdf', url: '', documentType: 'PASSPORT', guestIndex: 0 },
      { id: 'd2', name: 'receipt.pdf', url: '', documentType: 'PAYMENT_CONFIRMATION' },
    ])
    renderModal({ isUpdate: true })
    await waitForFieldsLoaded()

    expect(await screen.findByText('ada.pdf')).toBeInTheDocument()
    // GET returns no byte size, so no size line is rendered for stored files.
    expect(screen.queryByText('—')).not.toBeInTheDocument()
    expect(screen.queryByText(/\d+ (B|KB|MB)$/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('upload-field-tab-payment-confirmation'))
    expect(screen.getByText('receipt.pdf')).toBeInTheDocument()
  })

  it('shows unclassified documents in a read-only panel with no drop zone', async () => {
    vi.mocked(bookingsService.getBookingDocuments).mockResolvedValue([
      { id: 'old', name: 'scan.pdf', url: '' },
    ])
    renderModal({ isUpdate: true })
    await waitForFieldsLoaded()

    fireEvent.click(screen.getByTestId('upload-field-tab-unclassified'))

    expect(screen.getByText('Previously uploaded documents')).toBeInTheDocument()
    expect(screen.getByText('scan.pdf')).toBeInTheDocument()
    expect(screen.queryByTestId('upload-documents-dropzone')).not.toBeInTheDocument()
  })
})

describe('UploadDocumentsModal — load failure', () => {
  it('warns and blocks Save when previous documents could not be loaded, and recovers on Retry', async () => {
    vi.mocked(bookingsService.getBookingDocuments).mockRejectedValueOnce(new Error('offline'))
    vi.mocked(bookingsService.getBookingDocuments).mockResolvedValueOnce([
      { id: 'd1', name: 'ada.pdf', url: '', documentType: 'PASSPORT', guestIndex: 0 },
    ])
    renderModal({ isUpdate: true })

    expect(await screen.findByTestId('upload-documents-fetch-error')).toHaveTextContent(
      "We couldn't load your previously uploaded documents. Please try again before saving."
    )

    // Filling every field must still not unlock Save while the snapshot is unknown.
    dropFiles([makeFile('ada.pdf', 1024)])
    fireEvent.click(screen.getByTestId('upload-field-tab-passport-1'))
    dropFiles([makeFile('alan.pdf', 1024)])
    fireEvent.click(screen.getByTestId('upload-field-tab-payment-confirmation'))
    dropFiles([makeFile('receipt.pdf', 1024)])
    await screen.findByText('receipt.pdf')
    expect(screen.getByTestId('upload-documents-save-btn')).toBeDisabled()

    fireEvent.click(screen.getByTestId('upload-documents-fetch-retry-btn'))

    await waitFor(() =>
      expect(screen.queryByTestId('upload-documents-fetch-error')).not.toBeInTheDocument()
    )
    expect(screen.getByText('ada.pdf')).toBeInTheDocument()
  })
})
