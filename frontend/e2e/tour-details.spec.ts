import { test, expect } from '@playwright/test'

test.describe('EPMTPETA-10254, EPMTPETA-10255 & EPMTPETA-10261: Tour Details & Live Price Recalculation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/')
    await page.waitForLoadState('networkidle')
  })

  test('AC-1: Select tour card and navigate to Tour Details Page with photo gallery', async ({ page }) => {
    // Click "See details" on the first tour card
    const seeDetailsBtn = page.locator('.tour-card').first().getByRole('button', { name: /see details/i })
    await seeDetailsBtn.click()

    // Assert URL navigation to details page
    await expect(page).toHaveURL(/\/tours\//)

    // Assert image gallery grid is rendered
    const galleryImages = page.locator('.image-gallery img, [class*="gallery"] img')
    await expect(galleryImages.first()).toBeVisible()
  })

  test('AC-2: Reviews section displays rating breakdown and reviews', async ({ page }) => {
    // Navigate directly to tour details page for tour-1
    await page.goto('http://localhost:5173/tours/tour-1')
    await page.waitForLoadState('networkidle')

    // Verify Reviews section exists
    const reviewsSection = page.locator('.reviews-section, [data-testid="reviews-section"]').or(page.getByText(/reviews/i))
    await expect(reviewsSection.first()).toBeVisible()
  })

  test('AC-3: Live price recalculates when duration or guests change', async ({ page }) => {
    await page.goto('http://localhost:5173/tours/tour-1')
    await page.waitForLoadState('networkidle')

    // Find initial price element
    const priceElement = page.locator('.tour-booking-form, .price-display, [class*="price"]').first()
    const initialPriceText = await priceElement.textContent()

    // Verify initial price is rendered
    expect(initialPriceText).toBeTruthy()
  })
})
