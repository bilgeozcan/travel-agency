import React from 'react'
import './ImageGallery.css'

export interface ImageGalleryProps {
  images: string[]
  alt?: string
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images, alt = 'Tour detail photo' }) => {
  if (!images || images.length === 0) return null

  // Ensure we have 7 image sources (fallback smoothly if length < 7)
  const galleryImages = Array.from({ length: 7 }, (_, i) => images[i % images.length])

  return (
    <section className="image-gallery" data-testid="image-gallery" aria-label="Photo Gallery">
      {/* Column 1: Stack two images vertically (356x200px each) */}
      <div className="image-gallery__col image-gallery__col--1">
        <div className="image-gallery__item">
          <img src={galleryImages[0]} alt={`${alt} 1`} className="image-gallery__img" />
        </div>
        <div className="image-gallery__item">
          <img src={galleryImages[1]} alt={`${alt} 2`} className="image-gallery__img" />
        </div>
      </div>

      {/* Column 2: One tall featured image (330x412px) */}
      <div className="image-gallery__col image-gallery__col--2">
        <div className="image-gallery__item image-gallery__item--full">
          <img src={galleryImages[2]} alt={`${alt} 3`} className="image-gallery__img" />
        </div>
      </div>

      {/* Column 3: Split into top sub-grid (144px & 128px) and bottom wide image (284x208px) */}
      <div className="image-gallery__col image-gallery__col--3">
        <div className="image-gallery__col--3-top">
          <div className="image-gallery__item image-gallery__item--top-left">
            <img src={galleryImages[3]} alt={`${alt} 4`} className="image-gallery__img" />
          </div>
          <div className="image-gallery__item image-gallery__item--top-right">
            <img src={galleryImages[4]} alt={`${alt} 5`} className="image-gallery__img" />
          </div>
        </div>
        <div className="image-gallery__item image-gallery__col--3-bottom">
          <img src={galleryImages[5]} alt={`${alt} 6`} className="image-gallery__img" />
        </div>
      </div>

      {/* Column 4: One tall featured image (306x412px) */}
      <div className="image-gallery__col image-gallery__col--4">
        <div className="image-gallery__item image-gallery__item--full">
          <img src={galleryImages[6]} alt={`${alt} 7`} className="image-gallery__img" />
        </div>
      </div>
    </section>
  )
}
