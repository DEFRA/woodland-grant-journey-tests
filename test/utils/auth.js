import { expect } from '@playwright/test'

/**
 * Log in via the Defra ID OIDC provider.
 *
 * Each spec must pass its own CRN so tests can run in parallel without
 * sharing session state.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} crn
 */
export async function login(page, crn) {
  await page.goto('/woodland')

  const crnInput = page.locator('input#crn')
  if (await crnInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await crnInput.fill(crn)
    await page.locator('input#password').fill(process.env.DEFRA_ID_USER_PASSWORD ?? 'x')
    await page.locator('button[type="submit"]').click()

    await expect(page.getByRole('heading', { level: 1 })).not.toContainText('Sign in', { timeout: 20_000 })
  }
}
