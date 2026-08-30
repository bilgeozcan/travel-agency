import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErrorState } from './ErrorState'

describe('ErrorState UI Component', () => {
  it('renders default title and message correctly', () => {
    render(<ErrorState />)

    expect(screen.getByTestId('tours-error')).toBeInTheDocument()
    expect(screen.getByText('Unable to load tours')).toBeInTheDocument()
    expect(
      screen.getByText(
        "We couldn't connect to our tour catalog right now. Please check your connection or try again."
      )
    ).toBeInTheDocument()
  })

  it('renders custom title, message and calls onRetry when retry button is clicked', async () => {
    const handleRetry = vi.fn()
    const user = userEvent.setup()

    render(
      <ErrorState
        title="Custom Error Title"
        message="Custom detailed error message."
        onRetry={handleRetry}
        retryLabel="Reload"
        testId="custom-error"
      />
    )

    expect(screen.getByTestId('custom-error')).toBeInTheDocument()
    expect(screen.getByText('Custom Error Title')).toBeInTheDocument()
    expect(screen.getByText('Custom detailed error message.')).toBeInTheDocument()

    const retryBtn = screen.getByTestId('custom-error-retry-btn')
    expect(retryBtn).toHaveTextContent('Reload')

    await user.click(retryBtn)
    expect(handleRetry).toHaveBeenCalledTimes(1)
  })
})
