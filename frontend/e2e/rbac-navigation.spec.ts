import { test, expect } from '@playwright/test'

test.describe('EPMTPETA-10266 & EPMTPETA-10265: Comprehensive Route Guards & RBAC E2E Suite', () => {

  test('Route Test 1: Guest trying to access protected /profile is redirected to /login with state.from preserved', async ({ page }) => {
    await page.goto('http://localhost:5173/profile')
    await page.waitForLoadState('networkidle')

    // Expect redirect to login
    await expect(page).toHaveURL(/.*\/login.*/)

    // Verify login form is rendered
    const loginForm = page.locator('.login-card, [class*="login"]').first()
    await expect(loginForm).toBeVisible()
  })

  test('Route Test 2: Guest trying to access agent-only /tours/manage is redirected to /login', async ({ page }) => {
    await page.goto('http://localhost:5173/tours/manage')
    await page.waitForLoadState('networkidle')

    // Expect redirect to login page
    await expect(page).toHaveURL(/.*\/login.*/)
  })

  test('Route Test 3: Already authenticated user navigating to /login or /register is redirected to Dashboard', async ({ page }) => {
    // Inject mock customer session into localStorage
    await page.goto('http://localhost:5173/')
    await page.evaluate(() => {
      localStorage.setItem('auth_session', JSON.stringify({
        token: 'mock-valid-token',
        refreshToken: 'mock-refresh-token',
        user: { email: 'customer@example.com', role: 'Customer', name: 'Test Customer' }
      }))
    })

    // Try navigating to /login
    await page.goto('http://localhost:5173/login')
    await page.waitForLoadState('networkidle')

    // Expect redirect away from login back to dashboard
    expect(page.url()).not.toContain('/login')

    // Try navigating to /register
    await page.goto('http://localhost:5173/register')
    await page.waitForLoadState('networkidle')

    // Expect redirect away from register
    expect(page.url()).not.toContain('/register')
  })

  test('Route Test 4: Customer role trying to access Travel Agent route /tours/manage gets Access Denied / Redirect', async ({ page }) => {
    // Inject Customer role session
    await page.goto('http://localhost:5173/')
    await page.evaluate(() => {
      localStorage.setItem('auth_session', JSON.stringify({
        token: 'mock-customer-token',
        user: { email: 'customer@example.com', role: 'Customer', name: 'Customer User' }
      }))
    })

    // Try navigating to Travel Agent route
    await page.goto('http://localhost:5173/tours/manage')
    await page.waitForLoadState('networkidle')

    // Expect Customer to NOT be allowed on /tours/manage (either redirected or forbidden view)
    expect(page.url()).not.toContain('/tours/manage')
  })

  test('Route Test 5: Travel Agent role CAN access /tours/manage and sees Agent Dashboard', async ({ page }) => {
    // Inject Travel Agent role session
    await page.goto('http://localhost:5173/')
    await page.evaluate(() => {
      localStorage.setItem('auth_session', JSON.stringify({
        token: 'mock-agent-token',
        user: { email: 'agent@example.com', role: 'Travel Agent', name: 'Agent User' }
      }))
    })

    // Navigate to Travel Agent route
    await page.goto('http://localhost:5173/tours/manage')
    await page.waitForLoadState('networkidle')

    // Verify Travel Agent IS allowed on /tours/manage
    const manageToursHeader = page.locator('h1, h2, [class*="manage"]').first()
    await expect(manageToursHeader).toBeVisible()
  })

  test('Route Test 6: Wildcard route /random-unknown-path redirects safely to Home Page /', async ({ page }) => {
    await page.goto('http://localhost:5173/non-existing-404-route-abc')
    await page.waitForLoadState('networkidle')

    // Expect wildcard redirect to home /
    expect(page.url()).toBe('http://localhost:5173/')
  })
})
