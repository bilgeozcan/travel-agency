import type { TourBooking } from '../../types/bookings'

export interface UploadedFile {
  id: string
  name: string
  size: number
  /**
   * null when the file already exists on the backend (pre-populated in Update mode).
   * A real File object when the user has just selected a new file for upload.
   */
  file: File | null
  /**
   * Set to the backend document id when this entry was fetched from
   * GET /bookings/{id}/documents. Used to distinguish "existing" from "new"
   * files and to build the DELETE list when the user removes a pre-existing doc.
   */
  backendDocumentId?: string
}

export interface DocumentField {
  fieldId: string
  label: string
  documentType?: 'PASSPORT' | 'PAYMENT_CONFIRMATION'
  guestIndex?: number
  isLegacy?: boolean
  files: UploadedFile[]
}

export interface UploadDocumentsModalProps {
  isOpen: boolean
  booking: TourBooking | null
  isUpdate?: boolean
  onClose: () => void
  /**
   * Performs the uploads and deletes, and closes the modal on success.
   * `originalFields` is the snapshot of fields at modal-open time — used by the
   * caller to compute which backend documents were removed.
   * `onFileUploaded` must be invoked as each file is confirmed so that a retry
   * after a mid-batch failure does not re-upload it.
   */
  onSave: (
    fields: DocumentField[],
    isUpdate: boolean,
    originalFields: DocumentField[],
    onFileUploaded: (fieldId: string, fileId: string, backendDocumentId: string) => void
  ) => Promise<void> | void
}
