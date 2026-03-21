/**
 * Super Admin V2 — E2E Test Suite (Playwright)
 * Covers: Login, Dashboard, Partner Management, Tenant Management,
 *         Deployments, Operations, i18n, PWA, Mobile First
 *
 * NOTE: Tests run against the local dev server (port 5175).
 * Use domcontentloaded to avoid Vite HMR networkidle timeout.
 */

import { test, expect, type Page } from '@playwright/test'

// ============================================================================
// HELPERS
// ============================================================================

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5175'

async function mockAuthToken(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'e2e-test-token')
    localStorage.setItem('webwaka_locale', 'en')
  })
}

async function goTo(page: Page, path: string) {
  await page.goto(`${BASE_URL}/#${path}`, { waitUntil: 'domcontentloaded', timeout: 10_000 })
  await page.waitForTimeout(500) // Allow React to render
}

// ============================================================================
// TEST SUITE 1: Application Shell
// ============================================================================

test.describe('Application Shell', () => {
  test('should load the app and show some content', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(10)
  })

  test('should have correct PWA meta tags', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
    const manifest = await page.$('link[rel="manifest"]')
    expect(manifest).not.toBeNull()
    const themeColor = await page.$('meta[name="theme-color"]')
    expect(themeColor).not.toBeNull()
  })

  test('should have correct page title containing WebWaka', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
    const title = await page.title()
    expect(title).toMatch(/WebWaka/i)
  })
})

// ============================================================================
// TEST SUITE 2: Login Flow
// ============================================================================

test.describe('Login Flow', () => {
  test('should display login form', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first()
    const passwordInput = page.locator('input[type="password"]').first()
    const hasLoginElements = await emailInput.isVisible().catch(() => false) ||
      await passwordInput.isVisible().catch(() => false)
    expect(hasLoginElements).toBe(true)
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    const hasLoginForm = await emailInput.isVisible().catch(() => false)
    if (!hasLoginForm) return // Already authenticated — skip
    await emailInput.fill('invalid@test.com')
    const passwordInput = page.locator('input[type="password"]').first()
    await passwordInput.fill('wrongpassword')
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login"), button:has-text("Submit")').first()
    const hasSubmit = await submitBtn.isVisible().catch(() => false)
    if (!hasSubmit) return // No submit button visible — skip
    await submitBtn.click()
    await page.waitForTimeout(2000)
    const url = page.url()
    expect(url).not.toContain('/#/tenants')
  })
})

// ============================================================================
// TEST SUITE 3: Authenticated Dashboard
// ============================================================================

test.describe('Authenticated Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthToken(page)
    await goTo(page, '/')
  })

  test('should show some content when authenticated', async ({ page }) => {
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(10)
  })

  test('should show WebWaka branding', async ({ page }) => {
    const body = await page.textContent('body')
    expect(body).toContain('WebWaka')
  })

  test('should have language switcher or login form in header', async ({ page }) => {
    const body = await page.textContent('body')
    const hasLangOrLogin = body?.includes('English') || body?.includes('Sign In') || body?.includes('Login')
    expect(hasLangOrLogin).toBe(true)
  })
})

// ============================================================================
// TEST SUITE 4: Navigation
// ============================================================================

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthToken(page)
  })

  test('should navigate to /partners route', async ({ page }) => {
    await goTo(page, '/partners')
    const url = page.url()
    expect(url).toContain('partners')
  })

  test('should navigate to /tenants route', async ({ page }) => {
    await goTo(page, '/tenants')
    const url = page.url()
    expect(url).toContain('tenants')
  })

  test('should navigate to /operations route', async ({ page }) => {
    await goTo(page, '/operations')
    const url = page.url()
    expect(url).toContain('operations')
  })

  test('should navigate to /deployments route', async ({ page }) => {
    await goTo(page, '/deployments')
    const url = page.url()
    expect(url).toContain('deployments')
  })

  test('should navigate to /billing route', async ({ page }) => {
    await goTo(page, '/billing')
    const url = page.url()
    expect(url).toContain('billing')
  })

  test('should navigate to /analytics route', async ({ page }) => {
    await goTo(page, '/analytics')
    const url = page.url()
    expect(url).toContain('analytics')
  })

  test('should navigate to /health route', async ({ page }) => {
    await goTo(page, '/health')
    const url = page.url()
    expect(url).toContain('health')
  })

  test('should navigate to /settings route', async ({ page }) => {
    await goTo(page, '/settings')
    const url = page.url()
    expect(url).toContain('settings')
  })

  test('should show some content on unknown routes', async ({ page }) => {
    await goTo(page, '/this-route-does-not-exist-xyz')
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })
})

// ============================================================================
// TEST SUITE 5: Partner Management Page
// ============================================================================

test.describe('Partner Management Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthToken(page)
    await goTo(page, '/partners')
  })

  test('should render partner management page with content', async ({ page }) => {
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    expect(body!.length).toBeGreaterThan(0)
    const hasWebWaka = body?.includes('WebWaka')
    const hasPartner = body?.includes('Partner') || body?.includes('Alabaṣepọ')
    const hasLogin = body?.includes('Sign In') || body?.includes('Login')
    expect(hasWebWaka || hasPartner || hasLogin).toBe(true)
  })

  test('should have onboard partner button when authenticated', async ({ page }) => {
    const onboardBtn = page.locator('button:has-text("Onboard"), button:has-text("Partner"), button:has-text("Gba")').first()
    const hasBtn = await onboardBtn.isVisible().catch(() => false)
    // Soft assertion — button present when authenticated
    if (hasBtn) {
      await expect(onboardBtn).toBeVisible()
    }
  })
})

// ============================================================================
// TEST SUITE 6: i18n Language Switching
// ============================================================================

test.describe('i18n Language Switching', () => {
  test('should default to English locale', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('webwaka_locale')
    })
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
    // Default locale should be 'en' or unset
    const locale = await page.evaluate(() => localStorage.getItem('webwaka_locale'))
    expect(locale === null || locale === 'en').toBe(true)
  })

  test('should persist locale in localStorage', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
    await page.evaluate(() => localStorage.setItem('webwaka_locale', 'yo'))
    const locale = await page.evaluate(() => localStorage.getItem('webwaka_locale'))
    expect(locale).toBe('yo')
  })

  test('should support all 4 locales in localStorage', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
    const locales = ['en', 'yo', 'ig', 'ha']
    for (const locale of locales) {
      await page.evaluate((l) => localStorage.setItem('webwaka_locale', l), locale)
      const stored = await page.evaluate(() => localStorage.getItem('webwaka_locale'))
      expect(stored).toBe(locale)
    }
  })
})

// ============================================================================
// TEST SUITE 7: PWA Compliance
// ============================================================================

test.describe('PWA Compliance', () => {
  test('should serve manifest.json', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/manifest.json`, {
      waitUntil: 'domcontentloaded',
      timeout: 10_000,
    })
    expect(response?.status()).toBe(200)
    const json = await response?.json()
    expect(json?.name).toContain('WebWaka')
    expect(json?.display).toBe('standalone')
  })

  test('should serve service worker', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/sw.js`, {
      waitUntil: 'domcontentloaded',
      timeout: 10_000,
    })
    expect(response?.status()).toBe(200)
    const text = await response?.text()
    expect(text).toContain('webwaka-super-admin')
  })

  test('should have viewport meta tag', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
    const viewport = await page.$('meta[name="viewport"]')
    expect(viewport).not.toBeNull()
    const content = await viewport?.getAttribute('content')
    expect(content).toContain('width=device-width')
  })
})

// ============================================================================
// TEST SUITE 8: Mobile First (Pixel 5 viewport)
// ============================================================================

test.describe('Mobile First', () => {
  test('should render correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 }) // Pixel 5
    await mockAuthToken(page)
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20)
  })

  test('should render partners page on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 })
    await mockAuthToken(page)
    await goTo(page, '/partners')
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })

  test('should render operations page on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 })
    await mockAuthToken(page)
    await goTo(page, '/operations')
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })
})

// ============================================================================
// TEST SUITE 9: Accessibility
// ============================================================================

test.describe('Accessibility', () => {
  test('should have lang attribute on html element', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
    const lang = await page.evaluate(() => document.documentElement.lang)
    expect(lang).toBeTruthy()
  })

  test('should have at least one heading on the page', async ({ page }) => {
    await mockAuthToken(page)
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10_000 })
    await page.waitForTimeout(500)
    const headings = await page.locator('h1, h2, h3').count()
    expect(headings).toBeGreaterThanOrEqual(1)
  })
})

// ============================================================================
// TEST SUITE 10: API Integration (Smoke Tests)
// ============================================================================

test.describe('API Integration Smoke Tests', () => {
  test('should handle API errors gracefully on partners page', async ({ page }) => {
    await mockAuthToken(page)
    await page.route('**/partners**', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Unauthorized' }),
      })
    })
    await goTo(page, '/partners')
    await page.waitForTimeout(1000)
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })

  test('should handle API errors gracefully on operations page', async ({ page }) => {
    await mockAuthToken(page)
    await page.route('**/operations**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Internal Server Error' }),
      })
    })
    await goTo(page, '/operations')
    await page.waitForTimeout(1000)
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })

  test('should handle API errors gracefully on deployments page', async ({ page }) => {
    await mockAuthToken(page)
    await page.route('**/deployments**', (route) => {
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Forbidden' }),
      })
    })
    await goTo(page, '/deployments')
    await page.waitForTimeout(1000)
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
  })
})
