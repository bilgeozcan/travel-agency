import type { BookingDocumentItem } from '../CheckConfirmModal/CheckConfirmModal.types'

export interface BookingDocumentsSectionProps {
  title?: string
  documents: BookingDocumentItem[]
  className?: string
  dataTestId?: string
  onDownload?: (document: BookingDocumentItem) => void
  downloadingDocumentId?: string | null
}
