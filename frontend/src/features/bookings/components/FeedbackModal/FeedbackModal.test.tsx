import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FeedbackModal } from './FeedbackModal'

describe('FeedbackModal Component - Edge Cases & Interactions (MR 2)', () => {
  it('does not render when isOpen is false', () => {
    render(<FeedbackModal isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByTestId('feedback-modal-content')).not.toBeInTheDocument()
  })

  it('renders initial static elements with 0/5 stars and disabled Submit button', () => {
    render(<FeedbackModal isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Feedback')).toBeInTheDocument()
    expect(screen.getByTestId('feedback-stars-text')).toHaveTextContent('0/5 stars')
    expect(screen.getByTestId('feedback-char-counter')).toHaveTextContent('0/500')

    const submitBtn = screen.getByTestId('feedback-submit-btn')
    expect(submitBtn).toBeDisabled()
    expect(screen.queryByTestId('feedback-low-rating-warning')).not.toBeInTheDocument()
  })

  it('edge case: hovering over stars previews X/5 stars text in DOM, mouse leave restores saved rating text', () => {
    render(<FeedbackModal isOpen={true} onClose={vi.fn()} />)

    const star3 = screen.getByTestId('feedback-star-3')
    const star5 = screen.getByTestId('feedback-star-5')

    // Click 3 stars
    fireEvent.click(star3)
    expect(screen.getByTestId('feedback-stars-text')).toHaveTextContent('3/5 stars')

    // Hover over 5 stars
    fireEvent.mouseEnter(star5)
    expect(screen.getByTestId('feedback-stars-text')).toHaveTextContent('5/5 stars')

    // Mouse leave stars container
    fireEvent.mouseLeave(screen.getByTestId('feedback-stars-container').parentElement!)
    expect(screen.getByTestId('feedback-stars-text')).toHaveTextContent('3/5 stars')
  })

  it('edge case: low rating (1-3 stars) with empty or whitespace comment shows warning message and disables Submit', () => {
    render(<FeedbackModal isOpen={true} onClose={vi.fn()} />)

    // Click 2 stars -> warning shows, submit disabled
    fireEvent.click(screen.getByTestId('feedback-star-2'))
    expect(screen.getByTestId('feedback-low-rating-warning')).toBeInTheDocument()
    expect(screen.getByTestId('feedback-submit-btn')).toBeDisabled()

    // Type whitespace only -> warning stays visible, submit stays disabled
    const textarea = screen.getByTestId('feedback-comment-input')
    fireEvent.change(textarea, { target: { value: '    \n  ' } })
    expect(screen.getByTestId('feedback-low-rating-warning')).toBeInTheDocument()
    expect(screen.getByTestId('feedback-submit-btn')).toBeDisabled()
  })

  it('edge case: entering non-empty comment for low rating clears warning and enables Submit button', () => {
    render(<FeedbackModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('feedback-star-2'))
    const textarea = screen.getByTestId('feedback-comment-input')
    fireEvent.change(textarea, { target: { value: 'Average tour experience' } })

    expect(screen.queryByTestId('feedback-low-rating-warning')).not.toBeInTheDocument()
    expect(screen.getByTestId('feedback-char-counter')).toHaveTextContent('23/500')
    expect(screen.getByTestId('feedback-submit-btn')).not.toBeDisabled()
  })

  it('edge case: ratings 4-5 enable Submit immediately without warning even with empty comment', () => {
    render(<FeedbackModal isOpen={true} onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('feedback-star-5'))

    expect(screen.getByTestId('feedback-stars-text')).toHaveTextContent('5/5 stars')
    expect(screen.queryByTestId('feedback-low-rating-warning')).not.toBeInTheDocument()
    expect(screen.getByTestId('feedback-submit-btn')).not.toBeDisabled()
  })

  it('edge case: typing to 500-char limit applies visual at-limit CSS class and red counter', () => {
    render(<FeedbackModal isOpen={true} onClose={vi.fn()} />)

    const textarea = screen.getByTestId('feedback-comment-input')
    const exactly500 = 'x'.repeat(500)
    fireEvent.change(textarea, { target: { value: exactly500 } })

    const counter = screen.getByTestId('feedback-char-counter')
    expect(counter).toHaveTextContent('500/500')
    expect(counter.className).toContain('feedback-char-counter--at-limit')

    const container = textarea.closest('.feedback-comment-container')
    expect(container?.className).toContain('feedback-comment-container--at-limit')
  })


  it('edge case: when isLoading is true, Submit and Cancel buttons are both disabled; isAtCharLimit not triggered', () => {
    render(<FeedbackModal isOpen={true} isLoading={true} onClose={vi.fn()} />)

    expect(screen.getByTestId('feedback-cancel-btn')).toBeDisabled()
    expect(screen.getByTestId('feedback-submit-btn')).toBeDisabled()
  })

  it('calls onClose when Cancel button or Close icon is clicked', () => {
    const handleClose = vi.fn()
    render(<FeedbackModal isOpen={true} onClose={handleClose} />)

    fireEvent.click(screen.getByTestId('feedback-cancel-btn'))
    expect(handleClose).toHaveBeenCalledTimes(1)

    const closeIconBtn = screen.getByRole('button', { name: /close modal/i })
    fireEvent.click(closeIconBtn)
    expect(handleClose).toHaveBeenCalledTimes(2)
  })

  it('calls onSubmit with rating and comment when Submit button is clicked', () => {
    const handleSubmit = vi.fn()
    render(<FeedbackModal isOpen={true} onClose={vi.fn()} onSubmit={handleSubmit} />)

    fireEvent.click(screen.getByTestId('feedback-star-4'))
    fireEvent.change(screen.getByTestId('feedback-comment-input'), { target: { value: 'Wonderful trip!' } })

    fireEvent.click(screen.getByTestId('feedback-submit-btn'))
    expect(handleSubmit).toHaveBeenCalledTimes(1)
    expect(handleSubmit).toHaveBeenCalledWith(4, 'Wonderful trip!')
  })
})
