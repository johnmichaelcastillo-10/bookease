import { expect, test } from '@playwright/test'
import { expectNoHorizontalOverflow, loadDemo } from './helpers'

const PAGES = [
  '/admin',
  '/admin/appointments',
  '/admin/calendar',
  '/admin/availability',
  '/admin/services',
  '/admin/staff',
  '/admin/customers',
  '/admin/reports',
  '/admin/activity',
  '/admin/settings',
  '/book',
  '/book/service',
  '/booking-lookup',
]

test('no page scrolls sideways on a phone', async ({ page }) => {
  await loadDemo(page)
  for (const path of PAGES) {
    await page.goto(path)
    await expect(page.locator('h1').first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
  }
})

test('the mobile navigation opens from the menu button', async ({ page }) => {
  await loadDemo(page)
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'Staff' }).click()
  await expect(page).toHaveURL(/\/admin\/staff$/)
})
