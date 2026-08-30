import type {
  BackendBookingItem,
  BookingDocumentItem,
  CancelBookingResponse,
  CreateBookingRequest,
  CreateBookingResponse,
  TourBooking,
  TourFeedbackResponse,
  UpdateBookingRequest,
} from '@/features/bookings/types/bookings'
import type { DocumentField } from '@/features/bookings/components/UploadDocumentsModal/UploadDocumentsModal.types'
import { apiClient } from '../client/apiClient'
import { mapBackendBookingToFrontend } from '../mappers/bookings.mapper'

export interface ValidateBookingRequest {
  packageId: string
  startDate: string
  duration: string
  guestCount: number
  adults?: number
  children?: number
  mealPlan?: string
  quotedPrice: number
}

export interface ValidateBookingResponse {
  message?: string
  isValid?: boolean
  bookingToken: string
}

export const bookingsService = {
  async validateBooking(payload: ValidateBookingRequest): Promise<ValidateBookingResponse> {
    const res = await apiClient.post<ValidateBookingResponse>('/bookings/validate', payload)
    if (res?.data) {
      return res.data
    }
    throw new Error('Failed to validate booking availability')
  },

  async createBooking(payload: CreateBookingRequest): Promise<CreateBookingResponse> {
    const res = await apiClient.post<CreateBookingResponse>('/bookings', payload)
    if (res?.data) {
      return res.data
    }
    throw new Error('Failed to create booking')
  },

  async getUserBookings(role?: string | null): Promise<TourBooking[]> {
    const res = await apiClient.get<{ bookings: BackendBookingItem[] }>('/bookings')
    if (res?.data && Array.isArray(res.data.bookings)) {
      return res.data.bookings.map((b) => mapBackendBookingToFrontend(b, role))
    }
    return []
  },

  async updateBooking(id: string, payload: UpdateBookingRequest, role?: string | null): Promise<TourBooking> {
    const res = await apiClient.put<BackendBookingItem>(`/bookings/${id}`, payload)
    if (res?.data) {
      return mapBackendBookingToFrontend(res.data, role)
    }
    throw new Error(`Failed to update booking ${id}`)
  },

  async cancelBooking(id: string, cancellationReason?: string): Promise<CancelBookingResponse> {
    const res = cancellationReason
      ? await apiClient.delete<CancelBookingResponse>(`/bookings/${id}`, { cancelReason: cancellationReason })
      : await apiClient.delete<CancelBookingResponse>(`/bookings/${id}`)
    if (res?.data) {
      return res.data
    }
    throw new Error(`Failed to cancel booking ${id}`)
  },

  async confirmBooking(id: string): Promise<void> {
    const res = await apiClient.post<{ message: string }>(`/bookings/${id}/confirm`, {})
    if (!res?.data) {
      throw new Error(`Failed to confirm booking ${id}`)
    }
  },

  async sendDocumentFeedback(id: string, comment: string): Promise<{ success: boolean; message?: string }> {
    const res = await apiClient.post<{ success?: boolean; message?: string }>(`/bookings/${id}/reject-documents`, {
      reason: comment,
    })
    if (res?.data) {
      return {
        success: res.data.success ?? true,
        message: res.data.message ?? 'Document rejection feedback sent successfully',
      }
    }
    throw new Error(`Failed to send document feedback for booking ${id}`)
  },

  /**
   * Throws on network/API failure. Callers must distinguish "no documents
   * uploaded yet" (empty array) from "could not load them" — swallowing the
   * error here made the upload modal silently drop the delete diff.
   */
  async getBookingDocuments(id: string): Promise<BookingDocumentItem[]> {
    const res = await apiClient.get<{ documents: BookingDocumentItem[] }>(`/bookings/${id}/documents`)
    if (res?.data && Array.isArray(res.data.documents)) {
      return res.data.documents
    }
    return []
  },

  async getDocumentDownloadUrl(bookingId: string, documentId: string): Promise<string> {
    const res = await apiClient.get<{ downloadUrl: string }>(
      `/bookings/${bookingId}/documents/${documentId}/download-url`
    )
    if (res?.data?.downloadUrl) {
      return res.data.downloadUrl
    }
    throw new Error('Failed to retrieve document download URL')
  },

  /**
   * Diff-based document upload:
   * 1. For each new file (no backendDocumentId): POST presigned URL → PUT to S3 → PUT confirm.
   * 2. DELETE any backend docs that were in `originalFields` but removed by the user.
   *
   * Uploads run before deletes on purpose: if an upload fails partway, the
   * document it was replacing must still be there.
   *
   * Each new-file upload is serial (fail-fast) so a single bad file stops the
   * batch. `onFileUploaded` fires as each file is confirmed, letting the caller
   * record its backend id — a retry then skips it instead of uploading a
   * duplicate.
   */
  async uploadBookingDocuments(
    bookingId: string,
    fields: DocumentField[],
    originalFields?: DocumentField[],
    onFileUploaded?: (fieldId: string, fileId: string, backendDocumentId: string) => void
  ): Promise<void> {
    // --- 1. Upload new files (serial, fail-fast) ---
    for (const field of fields) {
      for (const uf of field.files) {
        // Skip existing backend docs and safety-guard against null file
        if (uf.backendDocumentId || !uf.file) continue

        const ext = uf.name.split('.').pop()?.toUpperCase() ?? 'PDF'
        const contentType = uf.file.type || 'application/octet-stream'

        // Step A: Get presigned URL from backend
        const postRes = await apiClient.post<{
          document: { id: string; name: string; fileFormat: string }
          uploadUrl: string
        }>(`/bookings/${bookingId}/documents`, {
          name: uf.name,
          fileFormat: ext,
          contentType,
          documentType: field.documentType,
          ...(field.documentType === 'PASSPORT' ? { guestIndex: field.guestIndex } : {}),
        })
        if (!postRes?.data) {
          throw new Error(`Failed to get upload URL for "${uf.name}"`)
        }
        const { document: doc, uploadUrl } = postRes.data

        // Step B: Upload binary directly to S3 (no apiClient — presigned URL is external)
        const s3Res = await fetch(uploadUrl, {
          method: 'PUT',
          body: uf.file,
          headers: { 'Content-Type': contentType },
        })
        if (!s3Res.ok) {
          throw new Error(
            `Failed to upload "${uf.name}" to storage (HTTP ${s3Res.status})`
          )
        }

        // Step C: Confirm upload on backend
        await apiClient.put(`/bookings/${bookingId}/documents/${doc.id}`, {})

        // This file is now durable — tell the caller so a retry skips it.
        onFileUploaded?.(field.fieldId, uf.id, doc.id)
      }
    }

    // --- 2. DELETE backend docs the user removed ---
    if (originalFields) {
      const keptBackendIds = new Set<string>()
      for (const f of fields) {
        for (const uf of f.files) {
          if (uf.backendDocumentId) keptBackendIds.add(uf.backendDocumentId)
        }
      }
      for (const origField of originalFields) {
        for (const origFile of origField.files) {
          if (origFile.backendDocumentId && !keptBackendIds.has(origFile.backendDocumentId)) {
            await apiClient.delete(`/bookings/${bookingId}/documents/${origFile.backendDocumentId}`)
          }
        }
      }
    }
  },

  async submitFeedback(
    tourId: string,
    bookingId: string,
    rating: number,
    comment?: string,
    isUpdate = false
  ): Promise<TourFeedbackResponse> {
    const payload: { rating: number; comment?: string } = { rating }
    if (comment && comment.trim()) {
      payload.comment = comment.trim()
    }

    const res = isUpdate
      ? await apiClient.put<TourFeedbackResponse>(
          `/tours/${tourId}/feedbacks?bookingId=${bookingId}`,
          payload
        )
      : await apiClient.post<TourFeedbackResponse>(
          `/tours/${tourId}/feedbacks?bookingId=${bookingId}`,
          payload
        )

    if (res?.data) {
      return res.data
    }
    throw new Error(`Failed to submit feedback for tour ${tourId}`)
  },

  async updateFeedback(
    tourId: string,
    bookingId: string,
    rating: number,
    comment?: string
  ): Promise<TourFeedbackResponse> {
    return this.submitFeedback(tourId, bookingId, rating, comment, true)
  },

  async confirmEdit(id: string, role?: string | null): Promise<TourBooking> {
    const res = await apiClient.post<{ message: string; booking?: BackendBookingItem }>(`/bookings/${id}/confirm-edit`, {})
    if (res?.data?.booking) {
      return mapBackendBookingToFrontend(res.data.booking, role)
    }
    const updated = await apiClient.get<{ bookings: BackendBookingItem[] }>('/bookings')
    const item = updated.data?.bookings?.find((b) => b.id === id)
    if (item) {
      return mapBackendBookingToFrontend(item, role)
    }
    throw new Error(`Failed to confirm edits for booking ${id}`)
  },

  async declineEdit(id: string): Promise<void> {
    await apiClient.post<{ message: string }>(`/bookings/${id}/decline-edit`, {})
  },
}
