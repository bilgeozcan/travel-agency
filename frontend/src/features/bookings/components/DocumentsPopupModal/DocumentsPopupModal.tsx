import React, { useEffect, useState } from 'react'
import { ModalShell } from '@/components/ui/Modal/ModalShell'
import documentIcon from '@/assets/icons/document.svg'
import { bookingsService } from '@/api/services/bookings.service'
import type { BookingDocumentItem, DocumentsPopupModalProps } from './DocumentsPopupModal.types'
import './DocumentsPopupModal.css'

export type { DocumentsPopupModalProps, BookingDocumentItem }

const EMPTY_DOCUMENTS: BookingDocumentItem[] = []

export const DocumentsPopupModal: React.FC<DocumentsPopupModalProps> = ({
  isOpen,
  booking,
  documents: initialDocuments = EMPTY_DOCUMENTS,
  onClose,
}) => {
  const [docs, setDocs] = useState<BookingDocumentItem[]>(initialDocuments)
  const [isLoading, setIsLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !booking) return

    setDownloadError(null)

    if (initialDocuments.length > 0) {
      setDocs(initialDocuments)
      return
    }

    setIsLoading(true)
    bookingsService
      .getBookingDocuments(booking.id)
      .then((fetchedDocs) => {
        setDocs(fetchedDocs)
      })
      .catch(() => {
        setDocs([])
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [isOpen, booking, initialDocuments])

  if (!booking || !isOpen) return null

  const handleDownload = async (doc: BookingDocumentItem) => {
    setDownloadError(null)
    setDownloadingId(doc.id)
    try {
      if (doc.url && !doc.url.startsWith('#')) {
        window.open(doc.url, '_blank')
        return
      }

      const downloadUrl = await bookingsService.getDocumentDownloadUrl(booking.id, doc.id)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = doc.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch {
      setDownloadError(`Failed to download ${doc.name}. Please try again.`)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <ModalShell
      isOpen={isOpen}
      title="Uploaded Documents"
      onClose={onClose}
      dataTestId="documents-popup-backdrop"
      className="documents-popup-shell"
    >
      <div className="documents-popup-body" data-testid="documents-popup-content">
        <p className="documents-popup-description">
          {booking.guests?.[0]?.firstName ?? 'Customer'} {booking.guests?.[0]?.lastName ?? ''}
        </p>

        {downloadError && (
          <div className="documents-popup-error" style={{ color: 'var(--color-red, #dc2626)', fontSize: '13px' }}>
            {downloadError}
          </div>
        )}

        {isLoading ? (
          <div className="documents-popup-empty" data-testid="documents-popup-loading">
            Loading documents…
          </div>
        ) : docs.length > 0 ? (
          <div className="documents-popup-list" data-testid="documents-popup-list">
            {docs.map((doc) => {
              const format = doc.fileFormat || (doc.name.split('.').pop() || 'file').toUpperCase()
              const isDownloading = downloadingId === doc.id
              return (
                <div key={doc.id} className="documents-popup-item" data-testid={`doc-item-${doc.id}`}>
                  <div className="documents-popup-item-info">
                    <img src={documentIcon} alt="" aria-hidden="true" className="documents-popup-icon" />
                    <div>
                      <span className="documents-popup-name">{doc.name}</span>
                    </div>
                    <span className="documents-popup-format">{format}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                      disabled={isDownloading}
                      className="documents-popup-download-btn"
                      data-testid={`download-doc-${doc.id}`}
                  >
                    {isDownloading ? 'Downloading…' : 'Download'}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="documents-popup-empty" data-testid="documents-popup-empty">
            No documents uploaded yet for this booking.
          </div>
        )}
      </div>
    </ModalShell>
  )
}
