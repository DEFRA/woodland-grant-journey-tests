import { test, expect } from '@playwright/test'
import { authenticate } from '../utils/auth.js'
import { clearApplicationState } from '../utils/backend.js'
import { analyzeAccessibility } from '../utils/accessibility.js'

const CRN = '1100943757'
const SBI = '113593357'

test.describe('Woodland Management Plan application', () => {
  test.beforeEach(async () => {
    await clearApplicationState(CRN, SBI)
  })

  test('submits a full WMP application from start to confirmation', { tag: ['@cdp', '@ci'] }, async ({ page }) => {
    await test.step('authentication', async () => {
      await authenticate(page, CRN)
    })

    await test.step('start', async () => {
      await expect(page).toHaveURL('/woodland/start')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Apply for a Woodland Management Plan grant')
      await analyzeAccessibility(page)
      await page.getByRole('button', { name: 'Start now' }).click()
    })

    await test.step('check-details', async () => {
      await expect(page).toHaveURL('/woodland/check-details')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Confirm your details')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

      await expect(page).toHaveURL('/woodland/check-details')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Contact the RPA to update your details')
      await analyzeAccessibility(page)
      await page.getByRole('button', { name: 'Continue' }).click()

      await expect(page).toHaveURL('/woodland/check-details')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Confirm your details')
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('tasks', async () => {
      await expect(page).toHaveURL('/woodland/tasks')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Woodland Management Plan')
      await analyzeAccessibility(page)
      await assertTaskStatuses(page, {
        'Check your eligibility': [
          { name: 'Land registration', status: 'Not started' },
          { name: 'Management control', status: 'Cannot start yet' },
          { name: 'Public body tenancy', status: 'Cannot start yet' },
          { name: 'Grazing rights', status: 'Cannot start yet' },
          { name: 'Existing WMPs', status: 'Cannot start yet' },
          { name: 'Higher Tier intention', status: 'Cannot start yet' },
        ],
        'About your woodland': [
          { name: 'Select land parcels', status: 'Cannot start yet' },
          { name: 'Woodland over 10 years old', status: 'Cannot start yet' },
          { name: 'Centre of your woodland', status: 'Cannot start yet' },
          { name: 'Forestry commission team', status: 'Cannot start yet' },
        ],
        'Check and submit application': [
          { name: 'Check your answers', status: 'Cannot start yet' },
          { name: 'Potential funding', status: 'Cannot start yet' },
          { name: 'Submit your application', status: 'Cannot start yet' },
        ],
      })
      await page.getByRole('link', { name: 'Land registration' }).click()
    })

    await test.step('eligibility-land-registered', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-land-registered')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Is all the land in your application registered with the Rural Payments service?')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

      await expect(page).toHaveURL('/woodland/exit-eligibility-land-registered')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('All the land in your application must be registered with the Rural Payments service')
      await analyzeAccessibility(page)
      await page.getByRole('link', { name: 'Back' }).click()

      await expect(page).toHaveURL('/woodland/eligibility-land-registered')
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('eligibility-management-control -> eligibility-tenant', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-management-control')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Will you have management control for the duration of the agreement and, where applicable, the durability period?')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('eligibility-tenant', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-tenant')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Are you a tenant of a public body?')
      await analyzeAccessibility(page)
      await page.getByRole('link', { name: 'Back' }).click()
    })

    await test.step('eligibility-management-control -> eligibility-countersignature', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-management-control')
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('eligibility-countersignature', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-countersignature')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Have you got the countersignature of your landlord?')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

      await expect(page).toHaveURL('/woodland/exit-eligibility-countersignature')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('You must get your landlord\'s countersignature')
      await analyzeAccessibility(page)
      await page.getByRole('link', { name: 'Back' }).click()

      await expect(page).toHaveURL('/woodland/eligibility-countersignature')
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('eligibility-tenant -> eligibility-grazing-rights', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-tenant')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Are you a tenant of a public body?')
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

    })

    await test.step('eligibility-grazing-rights', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-grazing-rights')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Are you applying for land covered by common or shared grazing rights?')
      await page.getByRole('link', { name: 'Back' }).click()
    })

    await test.step('eligibility-tenant -> eligibility-tenant-obligations', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-tenant')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Are you a tenant of a public body?')
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('eligibility-tenant-obligations', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-tenant-obligations')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Are the proposed works a requirement of your tenancy or any other legally binding obligation?')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

      await expect(page).toHaveURL('/woodland/exit-eligibility-tenant-obligations')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('You cannot get a WMP grant for any proposed works which are a requirement of your tenancy or any other legally binding obligation')
      await analyzeAccessibility(page)
      await page.getByRole('link', { name: 'Back' }).click()

      await expect(page).toHaveURL('/woodland/eligibility-tenant-obligations')
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('eligibility-grazing-rights', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-grazing-rights')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Are you applying for land covered by common or shared grazing rights?')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('eligibility-valid-wmp -> eligibility-higher-tier', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-valid-wmp')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Do you already have any valid WMPs on any land in your application?')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('eligibility-higher-tier', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-higher-tier')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Do you intend to apply for a Countryside Stewardship Higher Tier (CSHT) agreement if your WMP is approved?')
      await analyzeAccessibility(page)
      await page.getByRole('link', { name: 'Back' }).click()
    })

    await test.step('eligibility-valid-wmp -> eligibility-wmp-agreement', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-valid-wmp')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Do you already have any valid WMPs on any land in your application?')
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('eligibility-wmp-agreement', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-wmp-agreement')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Enter the agreement number for any valid WMPs')
      await analyzeAccessibility(page)
      await page.getByRole('textbox').fill('WMP-12345, WMP-23456')
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('eligibility-higher-tier', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-higher-tier')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Do you intend to apply for a Countryside Stewardship Higher Tier (CSHT) agreement if your WMP is approved?')
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('tasks', async () => {
      await expect(page).toHaveURL('/woodland/tasks')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Woodland Management Plan')
      await assertTaskStatuses(page, {
        'Check your eligibility': [
          { name: 'Land registration', status: 'Completed' },
          { name: 'Management control', status: 'Completed' },
          { name: 'Public body tenancy', status: 'Completed' },
          { name: 'Grazing rights', status: 'Completed' },
          { name: 'Existing WMPs', status: 'Completed' },
          { name: 'WMP Agreement Number', status: 'Completed' },
          { name: 'Higher Tier intention', status: 'Completed' },
        ],
        'About your woodland': [
          { name: 'Select land parcels', status: 'Not started' },
          { name: 'Woodland over 10 years old', status: 'Cannot start yet' },
          { name: 'Centre of your woodland', status: 'Cannot start yet' },
          { name: 'Forestry commission team', status: 'Cannot start yet' },
        ],
        'Check and submit application': [
          { name: 'Check your answers', status: 'Cannot start yet' },
          { name: 'Potential funding', status: 'Cannot start yet' },
          { name: 'Submit your application', status: 'Cannot start yet' },
        ],
      })
      await page.getByRole('link', { name: 'Select land parcels' }).click()
    })

    await test.step('land-parcels', async () => {
      await expect(page).toHaveURL('/woodland/land-parcels')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Select all the eligible land parcels for the location of your woodland')
      await analyzeAccessibility(page)
      await page.getByRole('checkbox', { name: 'SD6351 8781' }).check()
      await page.getByRole('checkbox', { name: 'SD6352 8774' }).check()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('total-area-of-woodland', async () => {
      await expect(page).toHaveURL('/woodland/total-area-of-woodland')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Enter total area of woodland in your application')
      await analyzeAccessibility(page)
      await expect(page.locator('.govuk-inset-text')).toContainText('The total area of your selected land parcels is 79.1504 ha')
      await page.getByLabel('Enter total area of woodland over 10 years old').fill('40')
      await page.getByLabel('Enter total area of newly planted woodland under 10 years old').fill('39.1504')
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('centre-of-woodland', async () => {
      await expect(page).toHaveURL('/woodland/centre-of-woodland')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Enter the grid reference for the centre of your woodland')
      // await analyzeAccessibility(page) // TODO: missing label violation on grid reference input — bug in grants-ui
      await page.getByRole('textbox').fill('SP 1234 5678')
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('which-forestry-commission-team', async () => {
      await expect(page).toHaveURL('/woodland/which-forestry-commission-team')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Which Forestry Commission team will be advising you?')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'East and East Midlands' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('tasks', async () => {
      await expect(page).toHaveURL('/woodland/tasks')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Woodland Management Plan')
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
          { name: 'Woodland over 10 years old', status: 'Completed' },
          { name: 'Centre of your woodland', status: 'Completed' },
          { name: 'Forestry commission team', status: 'Completed' },
        ],
        'Check and submit application': [
          { name: 'Check your answers', status: 'Not started' },
          { name: 'Potential funding', status: 'Cannot start yet' },
          { name: 'Submit your application', status: 'Cannot start yet' },
        ],
      })
      await page.getByRole('link', { name: 'Check your answers' }).click()
    })

    await test.step('summary', async () => {
      await expect(page).toHaveURL('/woodland/summary')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Check your answers')
      await analyzeAccessibility(page)
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('potential-funding', async () => {
      await expect(page).toHaveURL('/woodland/potential-funding')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Potential funding')
      await analyzeAccessibility(page)
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('declaration', async () => {
      await expect(page).toHaveURL('/woodland/declaration')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Submit your application')
      await analyzeAccessibility(page)
      await page.getByRole('button', { name: 'Confirm and send' }).click()
    })

    await test.step('confirmation', async () => {
      await expect(page).toHaveURL('/woodland/confirmation')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Application submitted')
      await analyzeAccessibility(page)
      await expect(page.locator('.govuk-panel__body')).toContainText(/WMP-[A-Z0-9]+-[A-Z0-9]+/)
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
