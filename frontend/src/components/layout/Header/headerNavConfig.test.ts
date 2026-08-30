import { describe, expect, it } from 'vitest'
import { canAccessTab, getHeaderTabs, NAV_CONFIG } from './headerNavConfig'

describe('Header Navigation Configuration Engine (headerNavConfig)', () => {
  it('NAV_CONFIG items possess unique tab IDs and explicit permission schema', () => {
    const ids = NAV_CONFIG.map((t) => t.id)
    const uniqueIds = Array.from(new Set(ids))
    expect(ids.length).toBe(uniqueIds.length)
  })

  it('returns only All tours tab for unauthenticated guest sessions', () => {
    const tabs = getHeaderTabs(false, null)
    expect(tabs).toHaveLength(1)
    expect(tabs[0].label).toBe('All tours')
    expect(tabs[0].id).toBe('main')
  })

  it('returns All tours and My tours tabs for Customer sessions', () => {
    const tabs = getHeaderTabs(true, 'Customer')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].label).toBe('All tours')
    expect(tabs[1].label).toBe('My tours')
    expect(tabs[1].id).toBe('my-tours')
  })

  it('returns All tours and Bookings tabs for Travel Agent sessions', () => {
    const tabs = getHeaderTabs(true, 'TRAVEL_AGENT')
    expect(tabs).toHaveLength(2)
    expect(tabs[0].label).toBe('All tours')
    expect(tabs[1].label).toBe('Bookings')
    expect(tabs[1].id).toBe('bookings')
  })

  it('evaluates canAccessTab correctly for explicit auth and role conditions', () => {
    const mainTab = NAV_CONFIG.find((t) => t.id === 'main')!
    const myToursTab = NAV_CONFIG.find((t) => t.id === 'my-tours')!
    const bookingsTab = NAV_CONFIG.find((t) => t.id === 'bookings')!

    expect(canAccessTab(mainTab, false)).toBe(true)
    expect(canAccessTab(myToursTab, false)).toBe(false)
    expect(canAccessTab(myToursTab, true, 'Customer')).toBe(true)
    expect(canAccessTab(bookingsTab, true, 'Customer')).toBe(false)
    expect(canAccessTab(bookingsTab, true, 'Travel Agent')).toBe(true)
  })
})
