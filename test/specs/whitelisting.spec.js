import { test, expect } from '@playwright/test'
import { clearApplicationData } from '../utils/backend.js'

const CRN = '1100945520'
const SBI = '106842593'
const GRANT_CODE = 'woodland'

test.describe('Whitelisting', () => {
  test.beforeEach(async () => {
    await clearApplicationData(SBI, GRANT_CODE)
  })

  test('redirects a non-whitelisted user to the unauthorised page', { tag: ['@cdp', '@ci'] }, async ({ page }) => {
    await test.step('authentication', async () => {
      page.goto('/woodland').catch(() => {})

      const crnInput = page.locator('input#crn')
      await crnInput.waitFor({ state: 'visible', timeout: 90_000 })
      await crnInput.fill(CRN)
      await page.locator('input#password').fill('x')
      await page.locator('button[type="submit"]').click()
    })

    await test.step('journey-unauthorised', async () => {
      await expect(page).toHaveURL('/auth/journey-unauthorised', { timeout: 30_000 })
    })
  })
})
