import { test, expect } from '@playwright/test'
import { clearApplicationState } from '../utils/backend.js'

const CRN = '1100945520'
const SBI = '106842593'

test.describe('Whitelisting', () => {
  test.beforeEach(async () => {
    await clearApplicationState(CRN, SBI)
  })

  test('redirects a non-whitelisted user to the unauthorised page', { tag: ['@cdp', '@ci'] }, async ({ page }) => {
    await test.step('authentication', async () => {
      await page.goto('/woodland')
      const crnInput = page.locator('input#crn')
      await crnInput.waitFor({ state: 'visible', timeout: 30_000 })
      await crnInput.fill(CRN)
      await page.locator('input#password').fill(process.env.DEFRA_ID_USER_PASSWORD ?? 'x')
      await page.locator('button[type="submit"]').click()
    })

    await test.step('journey-unauthorised', async () => {
      await expect(page).toHaveURL('/auth/journey-unauthorised', { timeout: 30_000 })
    })
  })
})
