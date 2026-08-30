import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUploadDocumentsModal } from './useUploadDocumentsModal'
import { bookingsService } from '@/api/services/bookings.service'
import type { GuestInfo } from '../types/bookings'
import type { DocumentField } from '../components/UploadDocumentsModal/UploadDocumentsModal.types'

vi.mock('@/api/services/bookings.service', () => ({
  bookingsService: {
    getBookingDocuments: vi.fn(),
  },
}))

const guests: GuestInfo[] = [
  { firstName: 'Ada', lastName: 'Lovelace' },
  { firstName: 'Alan', lastName: 'Turing' },
]

function makeFile(name: string, size: number, type = 'application/pdf'): File {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function setup(options: {
  guests?: GuestInfo[]
  isUpdate?: boolean
  bookingId?: string
  onSave?: (
    fields: DocumentField[],
    isUpdate: boolean,
    originalFields: DocumentField[],
    onFileUploaded: (fieldId: string, fileId: string, backendDocumentId: string) => void
  ) => Promise<void> | void
  onClose?: () => void
} = {}) {
  const onClose = options.onClose ?? vi.fn()
  const onSave = options.onSave ?? vi.fn()
  const result = renderHook(() =>
    useUploadDocumentsModal(
      options.guests ?? guests,
      true,
      onClose,
      onSave,
      options.isUpdate ?? false,
      options.bookingId ?? 'booking-1'
    )
  )
  return { ...result, onClose, onSave }
}

/** Adds a file to the field the modal currently has focused. */
async function addFileToActiveField(
  result: { current: ReturnType<typeof useUploadDocumentsModal> },
  file: File
) {
  await act(async () => {
    result.current.handleDrop({
      preventDefault: vi.fn(),
      dataTransfer: { files: [file] },
    } as unknown as React.DragEvent<HTMLDivElement>)
  })
}

/** Fills every non-legacy field so Save becomes enabled. */
async function fillAllFields(result: { current: ReturnType<typeof useUploadDocumentsModal> }) {
  const fieldIds = result.current.fields.filter((f) => !f.isLegacy).map((f) => f.fieldId)
  for (const fieldId of fieldIds) {
    await act(async () => {
      result.current.setActiveFieldId(fieldId)
    })
    await addFileToActiveField(result, makeFile(`${fieldId}.pdf`, 1024))
  }
}

beforeEach(() => {
  vi.mocked(bookingsService.getBookingDocuments).mockReset()
  vi.mocked(bookingsService.getBookingDocuments).mockResolvedValue([])
})

describe('useUploadDocumentsModal — field construction', () => {
  it('builds a passport field per guest plus a payment confirmation field', async () => {
    const { result } = setup()

    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    expect(result.current.fields.map((f) => f.label)).toEqual([
      'Passport Ada Lovelace',
      'Passport Alan Turing',
      'Payment confirmation',
    ])
  })

  it('falls back to a numbered label when the guest name is unavailable', async () => {
    const { result } = setup({
      guests: [{ firstName: 'Ada', lastName: 'Lovelace' }, { firstName: '', lastName: '' }],
    })

    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    expect(result.current.fields[1].label).toBe('Passport Guest 2')
  })

  it('places existing backend documents under the guest they belong to', async () => {
    vi.mocked(bookingsService.getBookingDocuments).mockResolvedValue([
      { id: 'd1', name: 'ada.pdf', url: '', documentType: 'PASSPORT', guestIndex: 0 },
      { id: 'd2', name: 'receipt.pdf', url: '', documentType: 'PAYMENT_CONFIRMATION' },
    ])
    const { result } = setup({ isUpdate: true })

    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    expect(result.current.fields[0].files[0]).toMatchObject({
      name: 'ada.pdf',
      backendDocumentId: 'd1',
    })
    expect(result.current.fields[1].files).toHaveLength(0)
    expect(result.current.fields[2].files[0]).toMatchObject({ backendDocumentId: 'd2' })
  })

  it('groups unclassified documents into a separate read-only field', async () => {
    vi.mocked(bookingsService.getBookingDocuments).mockResolvedValue([
      { id: 'old', name: 'scan.pdf', url: '' },
    ])
    const { result } = setup({ isUpdate: true })

    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    const legacy = result.current.fields.find((f) => f.isLegacy)
    expect(legacy?.label).toBe('Unclassified documents')
    expect(legacy?.files).toHaveLength(1)
  })
})

describe('useUploadDocumentsModal — Save gating', () => {
  it('keeps Save disabled until every field has a document', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    expect(result.current.isSaveEnabled).toBe(false)

    await addFileToActiveField(result, makeFile('ada.pdf', 1024))
    expect(result.current.isSaveEnabled).toBe(false)

    await act(async () => result.current.setActiveFieldId('passport-1'))
    await addFileToActiveField(result, makeFile('alan.pdf', 1024))
    expect(result.current.isSaveEnabled).toBe(false)

    await act(async () => result.current.setActiveFieldId('payment-confirmation'))
    await addFileToActiveField(result, makeFile('receipt.pdf', 1024))
    expect(result.current.isSaveEnabled).toBe(true)
  })

  it('disables Save again when a document is removed', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))
    await fillAllFields(result)
    expect(result.current.isSaveEnabled).toBe(true)

    const fileId = result.current.fields[0].files[0].id
    await act(async () => result.current.handleRemoveFile('passport-0', fileId))

    expect(result.current.isSaveEnabled).toBe(false)
  })

  it('does not let unclassified documents satisfy the required fields', async () => {
    vi.mocked(bookingsService.getBookingDocuments).mockResolvedValue([
      { id: 'old-1', name: 'a.pdf', url: '' },
      { id: 'old-2', name: 'b.pdf', url: '' },
      { id: 'old-3', name: 'c.pdf', url: '' },
    ])
    const { result } = setup({ isUpdate: true })

    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    expect(result.current.fields.find((f) => f.isLegacy)?.files).toHaveLength(3)
    expect(result.current.isSaveEnabled).toBe(false)
  })

  it('ignores files dropped while a legacy field is active', async () => {
    vi.mocked(bookingsService.getBookingDocuments).mockResolvedValue([
      { id: 'old', name: 'scan.pdf', url: '' },
    ])
    const { result } = setup({ isUpdate: true })
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    await act(async () => result.current.setActiveFieldId('unclassified'))
    await addFileToActiveField(result, makeFile('new.pdf', 1024))

    expect(result.current.fields.find((f) => f.isLegacy)?.files).toHaveLength(1)
  })
})

describe('useUploadDocumentsModal — file validation', () => {
  it('rejects a file larger than 5MB and names it', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    await addFileToActiveField(result, makeFile('huge.pdf', 5 * 1024 * 1024 + 1))

    expect(result.current.fileError).toEqual({ kind: 'size', fileNames: ['huge.pdf'] })
    expect(result.current.fields[0].files).toHaveLength(0)
  })

  it('accepts a file of exactly 5MB', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    await addFileToActiveField(result, makeFile('exact.pdf', 5 * 1024 * 1024))

    expect(result.current.fileError).toBeNull()
    expect(result.current.fields[0].files).toHaveLength(1)
  })

  it.each([
    ['document.pdf', 'application/pdf'],
    ['scan.png', 'image/png'],
    ['photo.jpg', 'image/jpeg'],
    ['photo.jpeg', 'image/jpeg'],
  ])('accepts %s', async (name, type) => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    await addFileToActiveField(result, makeFile(name, 1024, type))

    expect(result.current.fileError).toBeNull()
    expect(result.current.fields[0].files).toHaveLength(1)
  })

  it('rejects an unsupported format', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    await addFileToActiveField(
      result,
      makeFile('notes.docx', 1024, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    )

    expect(result.current.fileError).toEqual({ kind: 'type', fileNames: ['notes.docx'] })
    expect(result.current.fields[0].files).toHaveLength(0)
  })

  it('adds every valid file from a multi-file drop and reports only the rejects', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    await act(async () => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: {
          files: [
            makeFile('one.pdf', 1024),
            makeFile('two.png', 2048, 'image/png'),
            makeFile('huge.pdf', 6 * 1024 * 1024),
          ],
        },
      } as unknown as React.DragEvent<HTMLDivElement>)
    })

    expect(result.current.fields[0].files.map((f) => f.name)).toEqual(['one.pdf', 'two.png'])
    expect(result.current.fileError).toEqual({ kind: 'size', fileNames: ['huge.pdf'] })
  })

  it('gives files added in the same tick distinct ids', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    await act(async () => {
      result.current.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { files: [makeFile('a.pdf', 1024), makeFile('b.pdf', 1024)] },
      } as unknown as React.DragEvent<HTMLDivElement>)
    })

    const [first, second] = result.current.fields[0].files
    expect(first.id).not.toBe(second.id)
  })

  it('ignores files dropped before the initial fetch has settled', async () => {
    // The fetch resolves later and rebuilds the field list, which would drop
    // anything attached in the meantime — so the drop must not appear to work.
    let resolveFetch: (docs: never[]) => void = () => {}
    vi.mocked(bookingsService.getBookingDocuments).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve as (docs: never[]) => void
      })
    )
    const { result } = setup()
    expect(result.current.isFetchingDocs).toBe(true)

    await addFileToActiveField(result, makeFile('early.pdf', 1024))
    expect(result.current.fields[0].files).toHaveLength(0)

    await act(async () => {
      resolveFetch([])
    })
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    await addFileToActiveField(result, makeFile('later.pdf', 1024))
    expect(result.current.fields[0].files).toHaveLength(1)
  })

  it('dismisses the rejection popup', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))
    await addFileToActiveField(result, makeFile('huge.pdf', 6 * 1024 * 1024))

    await act(async () => result.current.dismissFileError())

    expect(result.current.fileError).toBeNull()
  })
})

describe('useUploadDocumentsModal — load failures', () => {
  it('flags a fetch failure and keeps Save disabled even once fields are filled', async () => {
    vi.mocked(bookingsService.getBookingDocuments).mockRejectedValue(new Error('offline'))
    const { result } = setup({ isUpdate: true })

    await waitFor(() => expect(result.current.hasFetchError).toBe(true))

    await fillAllFields(result)

    expect(result.current.isSaveEnabled).toBe(false)
  })

  it('recovers on retry', async () => {
    vi.mocked(bookingsService.getBookingDocuments).mockRejectedValueOnce(new Error('offline'))
    vi.mocked(bookingsService.getBookingDocuments).mockResolvedValueOnce([
      { id: 'd1', name: 'ada.pdf', url: '', documentType: 'PASSPORT', guestIndex: 0 },
    ])
    const { result } = setup({ isUpdate: true })

    await waitFor(() => expect(result.current.hasFetchError).toBe(true))

    await act(async () => {
      await result.current.retryLoadDocuments()
    })

    expect(result.current.hasFetchError).toBe(false)
    expect(result.current.fields[0].files[0]).toMatchObject({ backendDocumentId: 'd1' })
  })
})

describe('useUploadDocumentsModal — saving', () => {
  it('passes the open-time snapshot to onSave so removals can be diffed', async () => {
    vi.mocked(bookingsService.getBookingDocuments).mockResolvedValue([
      { id: 'd1', name: 'ada.pdf', url: '', documentType: 'PASSPORT', guestIndex: 0 },
    ])
    const onSave = vi.fn()
    const { result } = setup({ isUpdate: true, onSave })
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    await act(async () => result.current.handleRemoveFile('passport-0', 'backend-d1'))
    await fillAllFields(result)
    await act(async () => {
      await result.current.handleSave()
    })

    const [, isUpdate, originalFields] = onSave.mock.calls[0]
    expect(isUpdate).toBe(true)
    expect(originalFields[0].files[0].backendDocumentId).toBe('d1')
  })

  it('does nothing when Save is pressed while disabled', async () => {
    const onSave = vi.fn()
    const { result } = setup({ onSave })
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    await act(async () => {
      await result.current.handleSave()
    })

    expect(onSave).not.toHaveBeenCalled()
  })

  it('marks confirmed files so a retry does not re-upload them', async () => {
    // First attempt uploads the first file, then fails.
    const onSave = vi
      .fn()
      .mockImplementationOnce(async (fields, _isUpdate, _original, onFileUploaded) => {
        onFileUploaded(fields[0].fieldId, fields[0].files[0].id, 'backend-new-1')
        throw new Error('network error')
      })
      .mockResolvedValueOnce(undefined)

    const { result } = setup({ onSave })
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))
    await fillAllFields(result)

    await act(async () => {
      await result.current.handleSave().catch(() => {})
    })

    expect(result.current.fields[0].files[0].backendDocumentId).toBe('backend-new-1')

    // Retry: the already-uploaded file now carries a backend id, so the service
    // layer's skip guard excludes it from the second batch.
    await act(async () => {
      await result.current.handleSave()
    })

    const retriedFields: DocumentField[] = onSave.mock.calls[1][0]
    const stillPending = retriedFields.flatMap((f) =>
      f.files.filter((uf) => !uf.backendDocumentId)
    )
    expect(stillPending.map((f) => f.name)).toEqual([
      'passport-1.pdf',
      'payment-confirmation.pdf',
    ])
  })

  it('clears the submitting flag when onSave rejects, so the user can retry', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network error'))
    const { result } = setup({ onSave })
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))
    await fillAllFields(result)

    await act(async () => {
      await result.current.handleSave().catch(() => {})
    })

    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.isSaveEnabled).toBe(true)
  })

  it('calls onClose when cancelled', async () => {
    const { result, onClose } = setup()
    await waitFor(() => expect(result.current.isFetchingDocs).toBe(false))

    await act(async () => result.current.handleCancel())

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
