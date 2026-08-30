import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCustomerInfoSection } from './useCustomerInfoSection'

describe('useCustomerInfoSection Hook', () => {
  it('formats customer name, guest summary, and documents count correctly', () => {
    const { result } = renderHook(() =>
      useCustomerInfoSection({
        firstCustomer: { firstName: 'Taylor', lastName: 'Smith', email: 'taylor@example.com' },
        customerEmail: 'taylor@example.com',
        totalGuestsCount: 2,
        documentsCount: 2,
      })
    )

    expect(result.current.customerName).toBe('Taylor Smith')
    expect(result.current.displayEmail).toBe('taylor@example.com')
    expect(result.current.guestSummaryText).toBe('Taylor Smith (2 guests)')
    expect(result.current.docsText).toBe('Documents uploaded: 2 items')
  })

  it('handles fallback defaults when guest info or documents are missing', () => {
    const { result } = renderHook(() =>
      useCustomerInfoSection({
        totalGuestsCount: 0,
        documentsCount: 0,
      })
    )

    expect(result.current.customerName).toBe('Customer')
    expect(result.current.displayEmail).toBe('')
    expect(result.current.guestSummaryText).toBe('Customer (1 guest)')
    expect(result.current.docsText).toBe('No documents uploaded')
  })
})
