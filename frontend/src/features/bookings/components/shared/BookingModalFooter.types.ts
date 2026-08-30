export interface BookingModalFooterProps {
  totalPrice: number
  submitText: string
  loadingText?: string
  isSubmitting?: boolean
  isSubmitDisabled?: boolean
  type?: 'button' | 'submit'
  onSubmit?: () => void
  submitTestId?: string
  priceTestId?: string
  className?: string
  secondaryAction?: React.ReactNode
}
