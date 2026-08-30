import React from 'react'
import { BookingDetailsSection } from './BookingDetailsSection'
import type { BookingDocumentsSectionProps } from './BookingDocumentsSection.types'
import './BookingDocumentsSection.css'

export type { BookingDocumentsSectionProps }

export const BookingDocumentsSection: React.FC<BookingDocumentsSectionProps> = ({
  title = 'Documents',
  documents,
  className = '',
  dataTestId = 'booking-documents-section',
  onDownload,
  downloadingDocumentId,
}) => {
  if (!documents || documents.length === 0) {
    return (
      <BookingDetailsSection
        title={title}
        className={className}
        dataTestId={dataTestId}
        items={[
          {
            label: 'Documents:',
            value: <span className="booking-documents-empty">No documents uploaded</span>,
          },
        ]}
      />
    )
  }

  const items = documents.map((doc, idx) => {
    // Derive clean row label: Passport, Payment, or Document
    const labelText = doc.name.toLowerCase().includes('passport')
      ? 'Passport:'
      : doc.name.toLowerCase().includes('payment') || doc.name.toLowerCase().includes('receipt')
      ? 'Payment:'
      : `Document ${idx + 1}:`

    return {
      id: doc.id,
      label: labelText,
      value: (
        <button
          type="button"
          onClick={() => onDownload?.(doc)}
          disabled={!onDownload || downloadingDocumentId === doc.id}
          className="booking-document-link"
          data-testid={`download-link-${doc.id}`}
        >
          {downloadingDocumentId === doc.id ? 'Downloading...' : doc.name}
        </button>
      ),
      testId: `doc-value-${doc.id}`,
    }
  })

  return (
    <BookingDetailsSection
      title={title}
      items={items}
      className={`booking-documents-section ${className}`}
      dataTestId={dataTestId}
    />
  )
}
