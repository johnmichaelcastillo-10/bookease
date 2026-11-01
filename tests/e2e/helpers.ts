import { expect, type Page } from '@playwright/test'

/** Every Playwright context starts with an empty browser profile: pick the demo workspace. */
export async function loadDemo(page: Page) {
  await page.goto('/admin')
  await page.getByRole('button', { name: /Explore with sample data/ }).click()
  await expect(page.getByRole('button', { name: /^Notifications/ })).toBeVisible({ timeout: 20_000 })
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}
