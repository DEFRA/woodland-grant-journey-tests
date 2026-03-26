import { test, expect } from '@playwright/test'

test.describe('Woodland', () => {
  test('should navigate to /woodland', async ({ page }) => {
    const response = await page.goto('/woodland')
    expect(response.status()).toBe(200)
  })
})
