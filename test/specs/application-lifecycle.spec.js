import { test, expect } from '@playwright/test'
import { authenticate } from '../utils/auth.js'
import { clearApplicationState } from '../utils/backend.js'
import { clearExpectation, setDefaultStatusQuery404Response, getApplicationSubmission, setStatusQueryResponse } from '../utils/gas.js'

const CRN = '1100943838'
const SBI = '107173507'

test.describe('Woodland Management Plan application lifecycle', () => {
  const expectationIds = []

  test.beforeEach(async () => {
    await clearApplicationState(CRN, SBI)
    expectationIds.push(await setDefaultStatusQuery404Response())
  })

  test.afterEach(async () => {
    for (const id of expectationIds) {
      await clearExpectation(id)
    }
    expectationIds.length = 0
  })

  test('submits, amends, receives an offer, and is withdrawn', { tag: ['@ci'] }, async ({ page: initialPage, browser }) => {
    let page = initialPage
    let referenceNumber

    await test.step('submit application', async () => {
      await authenticate(page, CRN)

      // start
      await expect(page).toHaveURL('/woodland/start')
      await page.getByRole('button', { name: 'Start now' }).click()

      // check-details
      await expect(page).toHaveURL('/woodland/check-details')
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

      // tasks
      await expect(page).toHaveURL('/woodland/tasks')
      await page.getByRole('link', { name: 'Land registration' }).click()

      // eligibility-land-registered
      await expect(page).toHaveURL('/woodland/eligibility-land-registered')
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

      // eligibility-management-control
      await expect(page).toHaveURL('/woodland/eligibility-management-control')
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

      // eligibility-tenant
      await expect(page).toHaveURL('/woodland/eligibility-tenant')
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

      // eligibility-grazing-rights
      await expect(page).toHaveURL('/woodland/eligibility-grazing-rights')
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

      // eligibility-valid-wmp
      await expect(page).toHaveURL('/woodland/eligibility-valid-wmp')
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

      // eligibility-higher-tier
      await expect(page).toHaveURL('/woodland/eligibility-higher-tier')
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

      // tasks
      await expect(page).toHaveURL('/woodland/tasks')
      await page.getByRole('link', { name: 'Select land parcels' }).click()

      // land-parcels
      await expect(page).toHaveURL('/woodland/land-parcels')
      await page.getByRole('checkbox', { name: 'SD6351 8781' }).check()
      await page.getByRole('button', { name: 'Continue' }).click()

      // total-area-of-land-over-10-years-old
      await expect(page).toHaveURL('/woodland/total-area-of-land-over-10-years-old')
      await page.getByRole('textbox').fill('60')
      await page.getByRole('button', { name: 'Continue' }).click()

      // total-area-of-land-under-10-years-old
      await expect(page).toHaveURL('/woodland/total-area-of-land-under-10-years-old')
      await page.getByRole('textbox').fill('8.0498')
      await page.getByRole('button', { name: 'Continue' }).click()

      // centre-of-woodland
      await expect(page).toHaveURL('/woodland/centre-of-woodland')
      await page.getByRole('textbox').fill('SP 1234 5678')
      await page.getByRole('button', { name: 'Continue' }).click()

      // which-forestry-commission-team
      await expect(page).toHaveURL('/woodland/which-forestry-commission-team')
      await page.getByRole('radio', { name: 'East and East Midlands' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

      // tasks
      await expect(page).toHaveURL('/woodland/tasks')
      await page.getByRole('link', { name: 'Check your answers' }).click()

      // summary
      await expect(page).toHaveURL('/woodland/summary')
      await page.getByRole('button', { name: 'Continue' }).click()

      // potential-funding
      await expect(page).toHaveURL('/woodland/potential-funding')
      await page.getByRole('button', { name: 'Continue' }).click()

      // declaration
      await expect(page).toHaveURL('/woodland/declaration')
      await page.getByRole('button', { name: 'Confirm and send' }).click()

      // confirmation
      await expect(page).toHaveURL('/woodland/confirmation')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Application submitted')
      await expect(page.locator('.govuk-panel__body')).toContainText(/WMP-[A-Z0-9]+-[A-Z0-9]+/)
      referenceNumber = await page.locator('.govuk-panel__body strong').textContent()
    })

    await test.step('verify application submission to GAS', async () => {
      const request = await getApplicationSubmission(referenceNumber)
      expect(request).not.toBeNull()
      expect(request.body.json.metadata.clientRef).toEqual(referenceNumber.toLowerCase())
      expect(request.body.json.metadata.sbi).toEqual(SBI)
      expect(request.body.json.metadata.crn).toEqual(CRN)
      expect(request.body.json.answers.referenceNumber).toEqual(referenceNumber)
    })

    await test.step('GAS status is now APPLICATION_RECEIVED', async () => {
      expectationIds.push(await setStatusQueryResponse(referenceNumber, 'APPLICATION_RECEIVED'))
    })

    await test.step('reopen browser and are redirected to /confirmation', async () => {
      await page.context().close()
      const context = await browser.newContext()
      page = await context.newPage()
      await authenticate(page, CRN)
      await expect(page).toHaveURL('/woodland/confirmation')
    })

    await test.step('GAS status is now APPLICATION_AMEND', async () => {
      expectationIds.push(await setStatusQueryResponse(referenceNumber, 'APPLICATION_AMEND'))
    })

    await test.step('reopen browser and are redirected to /tasks', async () => {
      await page.context().close()
      const context = await browser.newContext()
      page = await context.newPage()
      await authenticate(page, CRN)
      await expect(page).toHaveURL('/woodland/tasks')
      await assertTaskStatuses(page, {
        'Check your eligibility': [
          { name: 'Land registration', status: 'Completed' },
          { name: 'Management control', status: 'Completed' },
          { name: 'Public body tenancy', status: 'Completed' },
          { name: 'Grazing rights', status: 'Completed' },
          { name: 'Existing WMPs', status: 'Completed' },
          { name: 'Higher Tier intention', status: 'Completed' },
        ],
        'About your woodland': [
          { name: 'Select land parcels', status: 'Completed' },
          { name: 'Land over 10 years old', status: 'Completed' },
          { name: 'Land under 10 years old', status: 'Completed' },
          { name: 'Centre of your woodland', status: 'Completed' },
          { name: 'Forestry commission team', status: 'Completed' },
        ],
        'Check and submit application': [
          { name: 'Check your answers', status: 'Not started' },
          { name: 'Potential funding', status: 'Cannot start yet' },
          { name: 'Submit your application', status: 'Cannot start yet' },
        ],
      })
    })

    await test.step('amend application and resubmit', async () => {
      await page.getByRole('link', { name: 'Higher Tier intention' }).click()

      // eligibility-higher-tier
      await expect(page).toHaveURL('/woodland/eligibility-higher-tier')
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

      // tasks
      await expect(page).toHaveURL('/woodland/tasks')
      await page.getByRole('link', { name: 'Check your answers' }).click()

      // summary
      await expect(page).toHaveURL('/woodland/summary')
      await page.getByRole('button', { name: 'Continue' }).click()

      // potential-funding
      await expect(page).toHaveURL('/woodland/potential-funding')
      await page.getByRole('button', { name: 'Continue' }).click()

      // declaration
      await expect(page).toHaveURL('/woodland/declaration')
      await page.getByRole('button', { name: 'Confirm and send' }).click()

      // confirmation
      await expect(page).toHaveURL('/woodland/confirmation')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Application submitted')
      await expect(page.locator('.govuk-panel__body')).toContainText(/WMP-[A-Z0-9]+-[A-Z0-9]+/)
      referenceNumber = await page.locator('.govuk-panel__body strong').textContent()
    })

    await test.step('GAS status is now OFFER_SENT', async () => {
      expectationIds.push(await setStatusQueryResponse(referenceNumber, 'OFFER_SENT'))
    })

    await test.step('reopen browser and are redirected to /agreements', async () => {
      await page.context().close()
      const context = await browser.newContext()
      page = await context.newPage()
      await authenticate(page, CRN)
      await expect(page).toHaveURL(/\/agreement/)
    })

    await test.step('GAS status is now APPLICATION_WITHDRAWN', async () => {
      expectationIds.push(await setStatusQueryResponse(referenceNumber, 'APPLICATION_WITHDRAWN'))
    })

    await test.step('reopen browser and are redirected to /start', async () => {
      await page.context().close()
      const context = await browser.newContext()
      page = await context.newPage()
      await authenticate(page, CRN)
      await expect(page).toHaveURL('/woodland/start')
    })
  })
})

async function assertTaskStatuses(page, sections) {
  for (const [heading, tasks] of Object.entries(sections)) {
    const section = page.locator('.govuk-task-list', {
      has: page.locator('xpath=preceding-sibling::h2', { hasText: heading }),
    })
    for (const { name, status } of tasks) {
      const item = section.locator('.govuk-task-list__item', { hasText: name })
      await expect(item.locator('.govuk-task-list__status')).toContainText(status)
    }
  }
}
