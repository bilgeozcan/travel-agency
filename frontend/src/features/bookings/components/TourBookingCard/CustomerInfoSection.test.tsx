import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CustomerInfoSection } from './CustomerInfoSection'

describe('CustomerInfoSection Component', () => {
  const firstCustomer = {
    firstName: 'Taylor',
    lastName: 'Smith',
    email: 'taylor.smith@example.com',
  }

  it('renders customer name and email correctly', () => {
    render(
      <CustomerInfoSection
        firstCustomer={firstCustomer}
        totalGuestsCount={3}
        documentsCount={2}
      />
    )

    expect(screen.getByText('Customer details')).toBeInTheDocument()
    expect(screen.getByText(/Taylor Smith/)).toBeInTheDocument()
    expect(screen.getByText('taylor.smith@example.com')).toBeInTheDocument()
  })

  it('renders document count link text correctly', () => {
    render(
      <CustomerInfoSection
        firstCustomer={firstCustomer}
        totalGuestsCount={3}
        documentsCount={2}
      />
    )

    expect(screen.getByTestId('customer-info-docs-link')).toHaveTextContent(
      'Documents uploaded: 2 items'
    )
    expect(screen.getByTestId('customer-info-guests-link')).toHaveTextContent(
      'Taylor Smith (3 guests)'
    )
  })

  it('triggers onOpenDocuments and onOpenGuests callbacks when clicked', () => {
    const onOpenDocuments = vi.fn()
    const onOpenGuests = vi.fn()

    render(
      <CustomerInfoSection
        firstCustomer={firstCustomer}
        totalGuestsCount={2}
        documentsCount={1}
        onOpenDocuments={onOpenDocuments}
        onOpenGuests={onOpenGuests}
      />
    )

    fireEvent.click(screen.getByTestId('customer-info-docs-link'))
    expect(onOpenDocuments).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('customer-info-guests-link'))
    expect(onOpenGuests).toHaveBeenCalledTimes(1)
  })
})
