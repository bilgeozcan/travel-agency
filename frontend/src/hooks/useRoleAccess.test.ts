import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useRoleAccess } from './useRoleAccess'

describe('useRoleAccess Custom Hook', () => {
  it('correctly evaluates Customer role permissions', () => {
    const { result } = renderHook(() => useRoleAccess(null, 'Customer'))

    expect(result.current.userRole).toBe('Customer')
    expect(result.current.isCustomer).toBe(true)
    expect(result.current.isTravelAgent).toBe(false)
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.isStaff).toBe(false)
    expect(result.current.canAccess(['Customer', 'Admin'])).toBe(true)
    expect(result.current.canAccess(['Travel Agent'])).toBe(false)
  })

  it('correctly evaluates Travel Agent staff role permissions', () => {
    const { result } = renderHook(() =>
      useRoleAccess({ role: 'TRAVEL_AGENT' }, undefined)
    )

    expect(result.current.userRole).toBe('Travel Agent')
    expect(result.current.isCustomer).toBe(false)
    expect(result.current.isTravelAgent).toBe(true)
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.isStaff).toBe(true)
    expect(result.current.canAccess(['Travel Agent', 'Admin'])).toBe(true)
  })

  it('correctly evaluates Admin staff role permissions', () => {
    const { result } = renderHook(() => useRoleAccess(null, 'Admin'))

    expect(result.current.userRole).toBe('Admin')
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.isStaff).toBe(true)
    expect(result.current.canAccess(['Customer', 'Admin'])).toBe(true)
    expect(result.current.canAccess(['Travel Agent', 'Admin'])).toBe(true)
  })

  it('defaults to Customer for null/undefined role input', () => {
    const { result } = renderHook(() => useRoleAccess(null, undefined))

    expect(result.current.userRole).toBe('Customer')
    expect(result.current.isCustomer).toBe(true)
    expect(result.current.isStaff).toBe(false)
  })
})
