import { useState } from 'react'
import {
  type CancellationReason,
  validateCancellationReason,
} from '../utils/bookingsValidation'

export function useCancelBookingModal() {
  const [selectedReason, setSelectedReason] = useState<CancellationReason | ''>('')

  const isSubmitDisabled = !validateCancellationReason(selectedReason)

  const handleReasonChange = (reason: string) => {
    setSelectedReason(reason as CancellationReason)
  }

  const resetState = () => {
    setSelectedReason('')
  }

  return {
    selectedReason,
    isSubmitDisabled,
    handleReasonChange,
    resetState,
  }
}
