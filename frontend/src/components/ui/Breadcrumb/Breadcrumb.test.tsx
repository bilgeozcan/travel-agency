import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Breadcrumb } from './Breadcrumb'

describe('Breadcrumb Component', () => {
  it('renders nothing when items list is empty', () => {
    const { container } = render(<Breadcrumb items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders inactive links and active current page per design spec', () => {
    const items = [
      { label: 'All tours', href: '/' },
      { label: 'A guided hike in the Dolomites' },
    ]

    render(<Breadcrumb items={items} />)

    const nav = screen.getByTestId('breadcrumb')
    expect(nav).toBeInTheDocument()
    expect(nav).toHaveAttribute('aria-label', 'Breadcrumb')

    const previousItem = screen.getByTestId('breadcrumb-item-0')
    expect(previousItem).toHaveTextContent('All tours')
    expect(previousItem).toHaveClass('breadcrumb__link--previous')

    const activeItem = screen.getByTestId('breadcrumb-active-item')
    expect(activeItem).toHaveTextContent('A guided hike in the Dolomites')
    expect(activeItem).toHaveClass('breadcrumb__link--active')
    expect(activeItem).toHaveAttribute('aria-current', 'page')
  })

  it('triggers onClick handler when inactive item is clicked', () => {
    const handleClick = vi.fn()
    const items = [
      { label: 'All tours', onClick: handleClick },
      { label: 'Tour details' },
    ]

    render(<Breadcrumb items={items} />)

    const previousBtn = screen.getByTestId('breadcrumb-item-0')
    fireEvent.click(previousBtn)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
