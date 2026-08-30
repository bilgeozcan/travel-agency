import React from 'react'
import { ModalShell } from '@/components/ui/Modal/ModalShell'
import { Button } from '@/components/ui/Button/Button'
import uploadIcon from '@/assets/icons/upload.svg'
import circleCheckIcon from '@/assets/icons/circle-check.svg'
import trashIcon from '@/assets/icons/trash.svg'
import documentIcon from '@/assets/icons/document.svg'
import type { UploadDocumentsModalProps, UploadedFile } from './UploadDocumentsModal.types'
import { useUploadDocumentsModal } from '../../hooks/useUploadDocumentsModal'
import { bookingsService } from '@/api/services/bookings.service'
import './UploadDocumentsModal.css'

export type { UploadDocumentsModalProps }

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const UploadDocumentsModal: React.FC<UploadDocumentsModalProps> = ({
  isOpen,
  booking,
  isUpdate = false,
  onClose,
  onSave,
}) => {
  const guests = booking?.guests ?? []
  const bookingId = booking?.id

  const {
    fields,
    activeFieldId,
    setActiveFieldId,
    activeField,
    fileError,
    dismissFileError,
    isDragOver,
    isFetchingDocs,
    hasFetchError,
    retryLoadDocuments,
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
  } = useUploadDocumentsModal(guests, isOpen, onClose, onSave, isUpdate, bookingId)

  const handleDownloadFile = async (uf: UploadedFile) => {
    if (uf.file) {
      const url = URL.createObjectURL(uf.file)
      const a = document.createElement('a')
      a.href = url
      a.download = uf.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else if (uf.backendDocumentId && bookingId) {
      try {
        const downloadUrl = await bookingsService.getDocumentDownloadUrl(bookingId, uf.backendDocumentId)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = uf.name
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } catch (err) {
        console.error('Failed to download document', err)
      }
    }
  }

  if (!booking || !isOpen) return null

  const modalTitle = isUpdate ? 'Update documents' : 'Upload documents'

  return (
    <>
      <ModalShell
        isOpen={isOpen}
        title={modalTitle}
        onClose={handleCancel}
        dataTestId="upload-documents-modal-backdrop"
        className="upload-documents-modal-shell"
        maxWidth="880px"
      >
        <div className="upload-documents-body" data-testid="upload-documents-body">
          {hasFetchError && (
            <div className="upload-documents-fetch-error" data-testid="upload-documents-fetch-error">
              <span>
                We couldn&apos;t load your previously uploaded documents. Please try again before
                saving.
              </span>
              <Button
                variant="outline"
                fullWidth={false}
                disabled={isFetchingDocs}
                onClick={() => void retryLoadDocuments()}
                data-testid="upload-documents-fetch-retry-btn"
              >
                {isFetchingDocs ? 'Retrying…' : 'Retry'}
              </Button>
            </div>
          )}

          {/* Two-panel layout */}
          <div className="upload-documents-panels">
            {/* LEFT PANEL — Field tabs */}
            <div className="upload-documents-left-panel">
              {fields.map((field) => {
                const isActive = field.fieldId === activeFieldId
                const hasFiles = field.files.length > 0
                return (
                  <button
                    key={field.fieldId}
                    type="button"
                    className={[
                      'upload-documents-field-tab',
                      isActive ? 'upload-documents-field-tab--active' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setActiveFieldId(field.fieldId)}
                    data-testid={`upload-field-tab-${field.fieldId}`}
                    aria-pressed={isActive}
                  >
                    <span className="upload-documents-field-tab-label">{field.label}</span>
                    {hasFiles && (
                      <img
                        src={circleCheckIcon}
                        alt="Uploaded"
                        className="upload-documents-field-check"
                        aria-label="Documents uploaded"
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Vertical divider */}
            <div className="upload-documents-divider" aria-hidden="true" />

            {/* RIGHT PANEL — Drop zone + file list */}
            <div className="upload-documents-right-panel">
              <p className="upload-documents-add-label">
                {activeField?.isLegacy ? 'Previously uploaded documents' : 'Add attachments'}
              </p>

              {!activeField?.isLegacy && (
                <>
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="upload-documents-file-input"
                    onChange={handleFileInputChange}
                    data-testid="upload-documents-file-input"
                    tabIndex={-1}
                    aria-hidden="true"
                  />

                  {/* Drop zone */}
                  <div
                    className={[
                      'upload-documents-dropzone',
                      isDragOver ? 'upload-documents-dropzone--drag-over' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={handleDropZoneClick}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    role="button"
                    tabIndex={0}
                    aria-label="Click to upload or drag and drop a file"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleDropZoneClick()
                    }}
                    data-testid="upload-documents-dropzone"
                  >
                    <img src={uploadIcon} alt="" aria-hidden="true" className="upload-documents-dropzone-icon" />
                    <span className="upload-documents-dropzone-text">Click to upload or drag and drop</span>
                  </div>
                </>
              )}

              {/* Uploaded files list */}
              {activeField && activeField.files.length > 0 && (
                <div
                  className="upload-documents-file-list"
                  data-testid="upload-documents-file-list"
                >
                  {activeField.files.map((uf) => (
                    <div
                      key={uf.id}
                      className="upload-documents-file-item"
                      data-testid={`upload-file-item-${uf.id}`}
                    >
                      <div className="upload-documents-file-item-info">
                        <img
                          src={documentIcon}
                          alt=""
                          aria-hidden="true"
                          className="upload-documents-file-icon"
                        />
                        <div className="upload-documents-file-text">
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(uf)}
                            className="upload-documents-file-name"
                            style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', textDecoration: 'underline' }}
                            title="Click to download"
                          >
                            {uf.name}
                          </button>
                          {/* Documents fetched from the backend carry no byte
                              size, so render nothing rather than a placeholder. */}
                          {uf.size > 0 && (
                            <span className="upload-documents-file-size">
                              {formatFileSize(uf.size)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="upload-documents-file-trash"
                        onClick={() => handleRemoveFile(activeField.fieldId, uf.id)}
                        aria-label={`Remove ${uf.name}`}
                        data-testid={`upload-file-trash-${uf.id}`}
                      >
                        <img src={trashIcon} alt="" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="upload-documents-actions">
            <Button
              variant="outline"
              fullWidth={false}
              disabled={isSubmitting}
              onClick={handleCancel}
              data-testid="upload-documents-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth={false}
              disabled={!isSaveEnabled}
              onClick={handleSave}
              data-testid="upload-documents-save-btn"
            >
              {isSubmitting ? 'Saving…' : isFetchingDocs ? 'Loading…' : 'Save'}
            </Button>
          </div>
        </div>
      </ModalShell>

      {/* Rejected-file popup: oversized files or unsupported formats */}
      {fileError && (
        <ModalShell
          isOpen={true}
          title={fileError.kind === 'size' ? 'File too large' : 'Invalid file type'}
          onClose={dismissFileError}
          dataTestId={`upload-documents-${fileError.kind}-error-backdrop`}
          className="upload-documents-size-error-shell"
          maxWidth="400px"
        >
          <div
            className="upload-documents-size-error-body"
            data-testid={`upload-documents-${fileError.kind}-error-body`}
          >
            <p className="upload-documents-size-error-text">
              {fileError.kind === 'size'
                ? 'The file you try to upload is larger than 5MB'
                : 'Please upload a PDF, PNG, or JPG file'}
            </p>
            <ul className="upload-documents-error-file-names">
              {fileError.fileNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <div className="upload-documents-size-error-actions">
              <Button
                variant="primary"
                fullWidth={false}
                onClick={dismissFileError}
                data-testid={`upload-documents-${fileError.kind}-error-close-btn`}
              >
                OK
              </Button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  )
}
