import { test, expect } from '@playwright/test'

test.describe('EPMTPETA-10741 & EPMTPETA-10257: Auth, Session & Auth Guard Popup Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/')
    await page.waitForLoadState('networkidle')
  })

  test('AC-1: Guest clicking "Book the tour" triggers AuthRequiredPopup', async ({ page }) => {
    // Locate the first tour card's "Book the tour" button
    const bookButton = page.locator('.tour-card').first().getByRole('button', { name: /book the tour/i })
    await bookButton.click()

    // Assert AuthRequiredPopup modal appears
    const popup = page.locator('[data-testid="auth-required-popup"]').or(page.locator('.auth-popup-container')).or(page.getByText(/sign in to book/i))
    await expect(popup.first()).toBeVisible()

    // Verify Sign In button inside popup is clickable
    const signInBtn = page.getByRole('button', { name: /sign in/i }).first()
    await expect(signInBtn).toBeVisible()
  })

  test('AC-2: Invalid login attempt displays error notification toast', async ({ page }) => {
    // Navigate to Sign In
    await page.goto('http://localhost:5173/login')
    await page.waitForLoadState('networkidle')

    // Fill form with invalid credentials
    await page.locator('input[type="email"]').fill('nonexistent_user@example.com')
    await page.locator('input[type="password"]').fill('WrongPassword123!')

    // Submit form
    await page.getByRole('button', { name: /sign in|login/i }).click()

    // Expect error toast or error message
    const errorMessage = page.locator('.toast, [class*="error"]').first()
    await expect(errorMessage).toBeVisible({ timeout: 5000 })
  })
})
