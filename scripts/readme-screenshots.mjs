// Takes the README screenshots (PNG) from a running BookEase (dev server, Docker or preview).
// Usage: node scripts/readme-screenshots.mjs <out-dir> [base-url]
// Then convert to WebP (q80) into docs/. 1280×800 viewport at 1.5× = 1920×1200 images.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] ?? 'screenshots'
const base = process.argv[3] ?? 'http://localhost:5173'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge' })

async function session(colorScheme) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1.5,
    colorScheme,
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.goto(`${base}/admin`)
  await page.getByRole('button', { name: /Explore with sample data/ }).click()
  await page.getByRole('button', { name: /^Notifications/ }).waitFor({ timeout: 30_000 })
  // Hide the "sample data loaded" toast.
  await page.waitForTimeout(500)
  await page.evaluate(() => document.querySelectorAll('[data-sonner-toaster]').forEach((t) => t.remove()))
  return { context, page }
}

async function shot(page, path, name) {
  await page.goto(`${base}${path}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)
  await page.evaluate(() => document.querySelectorAll('[data-sonner-toaster]').forEach((t) => t.remove()))
  await page.screenshot({ path: join(out, `${name}.png`) })
  console.log('saved', name)
}

for (const scheme of ['light', 'dark']) {
  const { context, page } = await session(scheme)
  const suffix = scheme === 'dark' ? '-dark' : ''
  await shot(page, '/admin?range=last30', `screenshot-dashboard${suffix}`)
  await shot(page, `/admin/calendar?view=week&date=2026-10-28`, `screenshot-calendar${suffix}`)
  await shot(page, '/admin/appointments', `screenshot-appointments${suffix}`)
  await shot(page, '/admin/reports?range=last30', `screenshot-reports${suffix}`)

  // Booking portal at the date-and-time step with a day picked.
  await page.goto(`${base}/book/service`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /^General Consultation/ }).click()
  await page.getByRole('button', { name: /Any available/ }).click()
  const days = page.locator('[role="grid"] button:not([disabled])')
  const slots = page.getByRole('group', { name: 'Available times' }).getByRole('button')
  for (let i = 1; i < 10; i++) {
    await days.nth(i).click()
    if (await slots.first().isVisible({ timeout: 3000 }).catch(() => false)) break
  }
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(out, `screenshot-booking${suffix}.png`) })
  console.log('saved', `screenshot-booking${suffix}`)
  await context.close()
}

await browser.close()
