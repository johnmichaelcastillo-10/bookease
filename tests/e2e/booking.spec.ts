import { expect, test } from '@playwright/test'
import { loadDemo } from './helpers'

test('a customer books online and the booking appears in the admin', async ({ page }) => {
  await loadDemo(page)

  await page.goto('/book')
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'Book an appointment' }).click()
  await expect(page.getByRole('heading', { name: 'Choose a service' })).toBeVisible()
  await page.getByRole('button', { name: /^General Consultation/ }).click()
  await page.getByRole('button', { name: /Any available/ }).click()

  // First enabled day that actually has times.
  await expect(page.getByRole('heading', { name: 'Pick a date and time' })).toBeVisible()
  const days = page.locator('[role="grid"] button:not([disabled])')
  const slots = page.getByRole('group', { name: 'Available times' }).getByRole('button')
  for (let i = 0; i < 10; i++) {
    await days.nth(i).click()
    if (await slots.first().isVisible({ timeout: 3000 }).catch(() => false)) break
  }
  await slots.first().click()

  await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible()
  await page.getByLabel(/Full name/).fill('Playwright Tester')
  await page.getByLabel(/Email/).fill('e2e@example.com')
  await page.getByLabel(/Phone/).fill('555 010 7777')
  await page.getByRole('button', { name: /Review booking/ }).click()

  await expect(page.getByRole('heading', { name: 'Review and confirm' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm booking' }).click()
  await expect(page.getByRole('heading', { name: 'Your booking is saved' })).toBeVisible()
  const reference = new URL(page.url()).searchParams.get('ref')
  expect(reference).toMatch(/^BE-[A-Z2-9]{6}$/)

  // Survives a reload (IndexedDB), and the confirmation page reloads from the URL.
  await page.reload()
  await expect(page.getByText(reference!).first()).toBeVisible()

  // Lookup in the same browser.
  await page.goto('/booking-lookup')
  await page.getByLabel('Booking reference').fill(reference!)
  await page.getByLabel('Email').fill('E2E@example.com')
  await page.getByRole('button', { name: /Find booking/ }).click()
  await expect(page.getByText(reference!).first()).toBeVisible()

  // The admin sees the same record.
  await page.goto('/admin/appointments?range=all')
  await page.getByRole('searchbox').fill(reference!)
  await expect(page.getByRole('table').getByText('Playwright Tester')).toBeVisible()
})
