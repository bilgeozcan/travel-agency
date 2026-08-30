import { useState, useCallback, useEffect, useRef } from 'react'
import type { GuestInfo, BookingDocumentItem } from '../types/bookings'
import type { DocumentField, UploadedFile } from '../components/UploadDocumentsModal/UploadDocumentsModal.types'
import { bookingsService } from '@/api/services/bookings.service'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
const ACCEPTED_EXTENSION_REGEX = /\.(pdf|png|jpe?g)$/i

/**
 * A batch of files the user tried to add but that failed validation.
 * Only one kind is surfaced at a time so a single popup is shown; `fileNames`
 * lets the popup name the offending files instead of just stating the rule.
 */
export interface FileRejection {
  kind: 'size' | 'type'
  fileNames: string[]
}

/**
 * Guest names can be missing: the bookings mapper pads the guest list up to
 * `guestsCount` with empty strings when the backend has no personal details,
 * which would otherwise render as "Passport  ".
 */
function buildPassportLabel(guest: GuestInfo, index: number): string {
  const fullName = [guest.firstName, guest.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
  return fullName ? `Passport ${fullName}` : `Passport Guest ${index + 1}`
}

/**
 * Build the field list for the modal.
 *
 * - Fresh mode (no backendDocs): all fields start empty.
 * - Update mode (backendDocs supplied): maps typed backend documents to their
 *   passport guest or payment-confirmation field.
 *   Each pre-existing file gets `backendDocumentId` set so the diff algorithm
 *   can decide whether to DELETE or keep it on Save.
 */
function buildFields(guests: GuestInfo[], backendDocs?: BookingDocumentItem[]): DocumentField[] {
  const passportFields: DocumentField[] = guests.map((guest, index) => ({
    fieldId: `passport-${index}`,
    label: buildPassportLabel(guest, index),
    documentType: 'PASSPORT',
    guestIndex: index,
    files: [],
  }))

  const paymentField: DocumentField = {
    fieldId: 'payment-confirmation',
    label: 'Payment confirmation',
    documentType: 'PAYMENT_CONFIRMATION',
    files: [],
  }

  const allFields = [...passportFields, paymentField]

  if (backendDocs && backendDocs.length > 0) {
    const legacyFiles: BookingDocumentItem[] = []

    backendDocs.forEach((doc) => {
      const uploadedFile: UploadedFile = {
        id: `backend-${doc.id}`,
        name: doc.name,
        size: 0,
        file: null,
        backendDocumentId: doc.id,
      }
      if (doc.documentType === 'PASSPORT' && typeof doc.guestIndex === 'number' && passportFields[doc.guestIndex]) {
        passportFields[doc.guestIndex].files.push(uploadedFile)
      } else if (doc.documentType === 'PAYMENT_CONFIRMATION') {
        paymentField.files.push(uploadedFile)
      } else {
        legacyFiles.push(doc)
      }
    })

    if (legacyFiles.length > 0) {
      allFields.push({
        fieldId: 'unclassified',
        label: 'Unclassified documents',
        isLegacy: true,
        files: legacyFiles.map((doc) => ({
        id: `backend-${doc.id}`,
        name: doc.name,
        size: 0,
        file: null,
        backendDocumentId: doc.id,
        })),
      })
    }
  }

  return allFields
}

export function useUploadDocumentsModal(
  guests: GuestInfo[],
  isOpen: boolean,
  onClose: () => void,
  onSave: (
    fields: DocumentField[],
    isUpdate: boolean,
    originalFields: DocumentField[],
    onFileUploaded: (fieldId: string, fileId: string, backendDocumentId: string) => void
  ) => Promise<void> | void,
  isUpdate: boolean,
  bookingId?: string
) {
  const [fields, setFields] = useState<DocumentField[]>(() => buildFields(guests))
  // Snapshot of fields at modal-open time; used by onSave for diff computation
  const [originalFields, setOriginalFields] = useState<DocumentField[]>([])
  const [activeFieldId, setActiveFieldId] = useState<string>('')
  const [fileError, setFileError] = useState<FileRejection | null>(null)
  const [isFetchingDocs, setIsFetchingDocs] = useState(false)
  const [hasFetchError, setHasFetchError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  // Monotonic counter for local file ids — Date.now() collides when several
  // files are added within the same millisecond (duplicate React keys).
  const fileIdCounterRef = useRef(0)

  // Read guests through a ref so `loadDocuments` stays stable across renders
  // even though the prop is a fresh array each time. Declared before the
  // open-effect below so the ref is already current when that effect runs.
  const guestsRef = useRef(guests)
  useEffect(() => {
    guestsRef.current = guests
  }, [guests])

  const loadDocuments = useCallback(async () => {
    if (!bookingId) {
      const newFields = buildFields(guestsRef.current)
      setFields(newFields)
      setOriginalFields(newFields)
      setActiveFieldId(newFields[0]?.fieldId ?? '')
      return
    }

    setIsFetchingDocs(true)
    setHasFetchError(false)
    try {
      const backendDocs = await bookingsService.getBookingDocuments(bookingId)
      const newFields = buildFields(guestsRef.current, backendDocs)
      setFields(newFields)
      setOriginalFields(newFields)
      setActiveFieldId(newFields[0]?.fieldId ?? '')
    } catch {
      // Do not fall back silently to empty fields: that is indistinguishable
      // from "nothing uploaded yet" and would also empty `originalFields`,
      // making the next Save skip the delete diff.
      const newFields = buildFields(guestsRef.current)
      setFields(newFields)
      setOriginalFields([])
      setActiveFieldId(newFields[0]?.fieldId ?? '')
      setHasFetchError(true)
    } finally {
      setIsFetchingDocs(false)
    }
  }, [bookingId])

  // On open: reset UI state, then fetch existing backend docs
  useEffect(() => {
    if (!isOpen) return

    setFileError(null)
    setIsDragOver(false)
    setIsSubmitting(false)
    void loadDocuments()
  }, [isOpen, loadDocuments])

  const activeField = fields.find((f) => f.fieldId === activeFieldId) ?? null

  const isFileTypeAllowed = useCallback((file: File): boolean => {
    return ACCEPTED_MIME_TYPES.includes(file.type) || ACCEPTED_EXTENSION_REGEX.test(file.name)
  }, [])

  const addFiles = useCallback(
    (fieldId: string, incoming: File[]) => {
      const accepted: UploadedFile[] = []
      const rejectedType: string[] = []
      const rejectedSize: string[] = []

      incoming.forEach((file) => {
        if (!isFileTypeAllowed(file)) {
          rejectedType.push(file.name)
          return
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          rejectedSize.push(file.name)
          return
        }
        fileIdCounterRef.current += 1
        accepted.push({
          id: `${fieldId}-${fileIdCounterRef.current}`,
          name: file.name,
          size: file.size,
          file,
        })
      })

      if (accepted.length > 0) {
        setFields((prev) =>
          prev.map((f) =>
            f.fieldId === fieldId ? { ...f, files: [...f.files, ...accepted] } : f
          )
        )
      }

      // Size takes precedence: it is the rule the acceptance criteria calls out.
      if (rejectedSize.length > 0) {
        setFileError({ kind: 'size', fileNames: rejectedSize })
      } else if (rejectedType.length > 0) {
        setFileError({ kind: 'type', fileNames: rejectedType })
      }
    },
    [isFileTypeAllowed]
  )

  const handleDropOrSelect = useCallback(
    (files: File[]) => {
      if (files.length === 0) return
      // Ignore input until the initial fetch has settled: `loadDocuments`
      // replaces the whole field list when it resolves, which would silently
      // discard anything attached in the meantime.
      if (isFetchingDocs) return
      const field = fields.find((item) => item.fieldId === activeFieldId)
      if (!field || field.isLegacy) return
      addFiles(activeFieldId, files)
    },
    [activeFieldId, fields, addFiles, isFetchingDocs]
  )

  const handleRemoveFile = useCallback((fieldId: string, fileId: string) => {
    setFields((prev) =>
      prev.map((f) =>
        f.fieldId === fieldId
          ? { ...f, files: f.files.filter((uf) => uf.id !== fileId) }
          : f
      )
    )
  }, [])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleDropOrSelect(Array.from(e.target.files ?? []))
      // Reset so the same file can be re-selected after removal
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [handleDropOrSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      handleDropOrSelect(Array.from(e.dataTransfer.files ?? []))
    },
    [handleDropOrSelect]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  /**
   * Save requires a document in every field the customer is responsible for:
   * a passport per guest plus the payment confirmation. The legacy
   * "Unclassified documents" bucket is read-only and excluded — documents
   * stored before classification existed cannot be attributed to a guest.
   */
  const requiredFields = fields.filter((f) => !f.isLegacy)
  const hasAllRequiredDocuments =
    requiredFields.length > 0 && requiredFields.every((f) => f.files.length > 0)
  const isSaveEnabled =
    hasAllRequiredDocuments && !isSubmitting && !isFetchingDocs && !hasFetchError

  /**
   * Records the backend id assigned to a file once its upload has been
   * confirmed. A later failure in the same batch therefore leaves the
   * successful files marked, so pressing Save again resumes instead of
   * re-uploading them as duplicates.
   */
  const markFileUploaded = useCallback(
    (fieldId: string, fileId: string, backendDocumentId: string) => {
      setFields((prev) =>
        prev.map((f) =>
          f.fieldId === fieldId
            ? {
              ...f,
              files: f.files.map((uf) =>
                uf.id === fileId ? { ...uf, backendDocumentId } : uf
              ),
            }
            : f
        )
      )
    },
    []
  )

  const handleSave = useCallback(async () => {
    if (!isSaveEnabled) return
    setIsSubmitting(true)
    try {
      await onSave(fields, isUpdate, originalFields, markFileUploaded)
    } finally {
      // onSave controls modal closure; reset submitting regardless of outcome
      setIsSubmitting(false)
    }
  }, [isSaveEnabled, fields, isUpdate, originalFields, onSave, markFileUploaded])

  const handleCancel = useCallback(() => {
    onClose()
  }, [onClose])

  const dismissFileError = useCallback(() => {
    setFileError(null)
  }, [])

  return {
    fields,
    activeFieldId,
    setActiveFieldId,
    activeField,
    fileError,
    dismissFileError,
    isDragOver,
    isFetchingDocs,
    hasFetchError,
    retryLoadDocuments: loadDocuments,
    isSubmitting,
    fileInputRef,
    isSaveEnabled,
    handleFileInputChange,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleDropZoneClick,
    handleRemoveFile,
    handleSave,
    handleCancel,
  }
}
