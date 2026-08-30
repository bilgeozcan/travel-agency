import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Pagination } from './Pagination'

describe('Pagination Component', () => {
  it('renders active and inactive pages according to specs', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />)

    const page1 = screen.getByRole('button', { name: 'Page 1' })
    const page2 = screen.getByRole('button', { name: 'Page 2' })

    expect(page1).toHaveClass('pagination-item--active')
    expect(page2).toHaveClass('pagination-item--inactive')
  })

  it('hides/disables left control on first page and renders double-chevron right icon', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'Previous page' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument()
  })

  it('shows left control on page > 1 and triggers onPageChange', async () => {
    const user = userEvent.setup()
    const handlePageChange = vi.fn()

    render(<Pagination currentPage={2} totalPages={3} onPageChange={handlePageChange} />)

    const prevBtn = screen.getByRole('button', { name: 'Previous page' })
    expect(prevBtn).toBeInTheDocument()

    await user.click(prevBtn)
    expect(handlePageChange).toHaveBeenCalledWith(1)
  })

  it('triggers onPageChange when clicking a page number', async () => {
    const user = userEvent.setup()
    const handlePageChange = vi.fn()

    render(<Pagination currentPage={1} totalPages={3} onPageChange={handlePageChange} />)

    await user.click(screen.getByRole('button', { name: 'Page 3' }))
    expect(handlePageChange).toHaveBeenCalledWith(3)
  })
})
