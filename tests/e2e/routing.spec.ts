import { expect, test } from '@playwright/test'
import { loadDemo } from './helpers'

test('nested routes load directly, survive refresh and back/forward', async ({ page }) => {
  await loadDemo(page)

  for (const [path, heading] of [
    ['/admin/calendar', 'Calendar'],
    ['/admin/reports', 'Reports'],
    ['/admin/settings?tab=data', 'Settings'],
    ['/booking-lookup', 'Find my booking'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  }

  // A booking step without its prerequisites sends the customer to the first step.
  await page.goto('/book/date-time')
  await expect(page.getByRole('heading', { name: 'Choose a service' })).toBeVisible()

  await page.goto('/admin/services')
  await page.getByRole('link', { name: 'Customers' }).click()
  await expect(page).toHaveURL(/\/admin\/customers$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/admin\/services$/)
  await page.goForward()
  await expect(page).toHaveURL(/\/admin\/customers$/)

  await page.goto('/admin/does-not-exist')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.goto('/nope')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

test('makes no requests to other origins', async ({ page }) => {
  const foreign: string[] = []
  page.on('request', (req) => {
    if (new URL(req.url()).origin !== 'http://localhost:4173') foreign.push(req.url())
  })
  await loadDemo(page)
  await page.goto('/admin/reports')
  await page.goto('/book')
  expect(foreign).toEqual([])
})
