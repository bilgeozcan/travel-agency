import { useEffect, useMemo, useRef, useState } from 'react'
import type { CreateBookingRequest, GuestInfo, UpdateBookingRequest } from '../../types/bookings'
import { useBookingSelection } from '../../hooks/useBookingSelection'
import { validateGuestInputs } from '../../utils/bookingsValidation'
import type { UseBookingModalStateProps } from './useBookingModalState.types'

export type { UseBookingModalStateProps }

export function useBookingModalState({
  isOpen,
  tour,
  initialSelection,
  initialGuests,
  mode = 'create',
  roleMode = 'customer',
  onConfirmBooking,
  onSubmit,
}: UseBookingModalStateProps) {
  const selection = useBookingSelection(tour, initialSelection)

  const [isDateDurationOpen, setIsDateDurationOpen] = useState(false)
  const [isGuestsOpen, setIsGuestsOpen] = useState(false)
  const modalBodyRef = useRef<HTMLDivElement>(null)
  const guestsTriggerTopBeforeCountChangeRef = useRef<number | null>(null)

  const [guestDetails, setGuestDetails] = useState<GuestInfo[]>(() =>
    Array.from({ length: selection.totalGuests }, (_, index) => initialGuests?.[index] ?? { firstName: '', lastName: '' })
  )

  useEffect(() => {
    if (!isOpen) return
    setGuestDetails((prev) => {
      if (prev.length === selection.totalGuests) return prev
      return Array.from({ length: selection.totalGuests }, (_, idx) => prev[idx] ?? { firstName: '', lastName: '' })
    })
  }, [selection.totalGuests, isOpen])

  // Reset popovers and scroll refs when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsDateDurationOpen(false)
      setIsGuestsOpen(false)
      guestsTriggerTopBeforeCountChangeRef.current = null
    }
  }, [isOpen])

  const preserveScrollPosition = (containerRef: React.RefObject<HTMLDivElement | null>) => {
    if (!isGuestsOpen || !containerRef.current) return
    guestsTriggerTopBeforeCountChangeRef.current = containerRef.current.getBoundingClientRect().top
  }

  const restoreScrollPosition = (
    containerRef: React.RefObject<HTMLDivElement | null>,
    ignoreNextGuestsPopoverScroll: () => void,
    updateGuestsPopoverPosition: () => void
  ) => {
    if (!isOpen) return
    const previousTop = guestsTriggerTopBeforeCountChangeRef.current
    if (previousTop === null || !isGuestsOpen || !modalBodyRef.current || !containerRef.current) return

    const nextTop = containerRef.current.getBoundingClientRect().top
    ignoreNextGuestsPopoverScroll()
    modalBodyRef.current.scrollTop += nextTop - previousTop
    updateGuestsPopoverPosition()
    guestsTriggerTopBeforeCountChangeRef.current = null
  }

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isSubmitDisabled = useMemo(() => {
    if (tour.isFullyBooked || isSubmitting) return true
    if (tour.maxParticipants && selection.totalGuests > tour.maxParticipants) return true
    if (tour.adultsMax && selection.adultsCount > tour.adultsMax) return true
    if (tour.childrenMax && selection.childrenCount > tour.childrenMax) return true
    return false
  }, [tour, isSubmitting, selection.totalGuests, selection.adultsCount, selection.childrenCount])

  const guestsDisplayValue = useMemo(() => {
    const adultLabel = `${selection.adultsCount} ${selection.adultsCount === 1 ? 'adult' : 'adults'}`
    const childLabel = selection.childrenCount > 0 ? `, ${selection.childrenCount} ${selection.childrenCount === 1 ? 'child' : 'children'}` : ''
    return `${adultLabel}${childLabel}`
  }, [selection.adultsCount, selection.childrenCount])

  const handleGuestInputChange = (index: number, field: keyof GuestInfo, value: string) => {
    setGuestDetails((prev) => {
      const next = [...prev]
      if (next[index]) {
        next[index] = { ...next[index], [field]: value }
      }
      return next
    })
    const errorKey = `customer_${index}_${field}`
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[errorKey]
        return next
      })
    }
  }

  const activeSubmitHandler = onSubmit ?? (onConfirmBooking
    ? (payload, guests) => onConfirmBooking(payload as CreateBookingRequest, guests)
    : undefined)

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (isSubmitting || !activeSubmitHandler) return

    const normalizedGuestDetails = Array.from(
      { length: selection.totalGuests },
      (_, index) => guestDetails[index] ?? { firstName: '', lastName: '' }
    )

    const { isValid, errors: validationErrors } = validateGuestInputs(normalizedGuestDetails)
    if (!isValid) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    try {
      const durationText = `${selection.duration} days`
      if (mode === 'edit') {
        const editPayload: UpdateBookingRequest = {
          date: selection.startDate,
          duration: durationText,
          mealPlan: selection.mealPlan,
          guests: { adult: selection.adultsCount, children: selection.childrenCount },
          personalDetails: normalizedGuestDetails,
        }
        await activeSubmitHandler(editPayload, normalizedGuestDetails)
      } else {
        const createPayload: CreateBookingRequest = {
          tourId: tour.id,
          date: selection.startDate,
          duration: durationText,
          mealPlan: selection.mealPlan,
          guests: { adult: selection.adultsCount, children: selection.childrenCount },
          personalDetails: normalizedGuestDetails,
          quotedPrice: selection.totalPrice,
        }
        await activeSubmitHandler(createPayload, normalizedGuestDetails)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const isPrimaryGuestReadOnly = mode === 'edit' && roleMode === 'agent'

  return {
    selection,
    isDateDurationOpen,
    setIsDateDurationOpen,
    isGuestsOpen,
    setIsGuestsOpen,
    modalBodyRef,
    guestDetails,
    errors,
    isSubmitting,
    isSubmitDisabled,
    guestsDisplayValue,
    isPrimaryGuestReadOnly,
    handleGuestInputChange,
    handleSubmit,
    preserveScrollPosition,
    restoreScrollPosition,
  }
}
