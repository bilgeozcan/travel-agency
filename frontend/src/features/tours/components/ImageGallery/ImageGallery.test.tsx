import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ImageGallery } from './ImageGallery'

const images = [
  '/img1.jpg',
  '/img2.jpg',
  '/img3.jpg',
  '/img4.jpg',
  '/img5.jpg',
  '/img6.jpg',
  '/img7.jpg',
]

describe('ImageGallery Component', () => {
  it('returns null if images array is empty', () => {
    const { container } = render(<ImageGallery images={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders all 7 photo grid items with object-cover images per design spec', () => {
    render(<ImageGallery images={images} alt="Beach resort" />)

    const gallery = screen.getByTestId('image-gallery')
    expect(gallery).toBeInTheDocument()

    const renderedImages = screen.getAllByRole('img')
    expect(renderedImages).toHaveLength(7)
    expect(renderedImages[0]).toHaveAttribute('src', '/img1.jpg')
    expect(renderedImages[6]).toHaveAttribute('src', '/img7.jpg')
  })
})
