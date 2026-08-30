export interface FeedbackModalProps {
  isOpen: boolean
  hasFeedback?: boolean
  onClose: () => void
  onSubmit?: (rating: number, comment: string) => void
  isLoading?: boolean
  initialRating?: number
  initialComment?: string
}
