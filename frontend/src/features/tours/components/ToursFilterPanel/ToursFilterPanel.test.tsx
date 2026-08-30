import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ToursFilterPanel } from './ToursFilterPanel'

describe('ToursFilterPanel Component', () => {
  it('renders all filter fields and search button', () => {
    render(<ToursFilterPanel onSearch={vi.fn()} />)

    expect(screen.getByPlaceholderText('Any destination')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Any start date, any duration...')).toBeInTheDocument()
    expect(screen.getByTestId('filter-guests')).toBeInTheDocument()
    expect(screen.getByTestId('filter-meal-plan')).toBeInTheDocument()
    expect(screen.getByTestId('filter-resort-type')).toBeInTheDocument()
    expect(screen.getByTestId('filter-search-btn')).toBeInTheDocument()
  })

  it('triggers search with entered filters on Search button click', async () => {
    const user = userEvent.setup()
    const handleSearch = vi.fn()

    render(<ToursFilterPanel onSearch={handleSearch} />)

    await user.type(screen.getByPlaceholderText('Any destination'), 'Santorini')
    await user.click(screen.getByTestId('filter-search-btn'))

    expect(handleSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: 'Santorini',
      })
    )
  })

  it('resets filters when clicking Reset button', async () => {
    const user = userEvent.setup()
    const handleReset = vi.fn()

    render(<ToursFilterPanel onSearch={vi.fn()} onReset={handleReset} />)

    await user.type(screen.getByPlaceholderText('Any destination'), 'Greece')
    await user.click(screen.getByTestId('filter-reset-btn'))

    expect(screen.getByPlaceholderText('Any destination')).toHaveValue('')
    expect(handleReset).toHaveBeenCalled()
  })

  it('opens tour type popover and selects a tour type option', async () => {
    const user = userEvent.setup()
    const handleSearch = vi.fn()

    render(<ToursFilterPanel onSearch={handleSearch} />)

    await user.click(screen.getByTestId('tour-type-picker-trigger'))
    expect(screen.getByTestId('tour-type-dropdown-popover')).toBeInTheDocument()

    await user.click(screen.getByText('Cruises'))
    await user.click(screen.getByTestId('filter-search-btn'))

    expect(handleSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        tourTypes: ['CRUISE'],
      })
    )
  })

  it('handles special characters in destination search gracefully', async () => {
    const user = userEvent.setup()
    const handleSearch = vi.fn()

    render(<ToursFilterPanel onSearch={handleSearch} />)

    await user.type(screen.getByPlaceholderText('Any destination'), 'Punta Cana #1!')
    await user.click(screen.getByTestId('filter-search-btn'))

    expect(handleSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: 'Punta Cana #1!',
      })
    )
  })
})
