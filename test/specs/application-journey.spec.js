import { test, expect } from '@playwright/test'
import Ajv2020 from 'ajv/dist/2020.js'
import { authenticate } from '../utils/auth.js'
import { clearApplicationState } from '../utils/backend.js'
import { analyzeAccessibility } from '../utils/accessibility.js'
import { getApplicationSubmission } from '../utils/gas.js'
import gasSchemaFile from '../schemas/gas.schema.json' with { type: 'json' }

const CRN = '1100943757'
const SBI = '113593357'

const gasAnswersSchema = gasSchemaFile.questions

test.describe('Woodland Management Plan application', () => {
  test.beforeEach(async () => {
    await clearApplicationState(CRN, SBI)
  })

  test('submits a full WMP application from start to confirmation', { tag: ['@cdp', '@ci', '@runme'] }, async ({ page }) => {
    let referenceNumber
    await test.step('authentication', async () => {
      await page.goto('/woodland')
      await authenticate(page, CRN)
    })

    await test.step('check-details', async () => {
      await expect(page).toHaveURL('/woodland/check-details')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Confirm your details')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()

      await expect(page).toHaveURL('/woodland/update-details')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Update your details')
      await analyzeAccessibility(page)
      await page.getByRole('link', { name: 'Back' }).click()

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
          { name: 'All land registered', status: 'Not started' },
          { name: 'Management control', status: 'Cannot start yet' },
          { name: 'Public body tenant', status: 'Cannot start yet' },
          { name: 'Common or shared grazing rights', status: 'Cannot start yet' },
          { name: 'Live WMPs on land', status: 'Cannot start yet' },
          { name: 'Apply for CSHT', status: 'Cannot start yet' },
        ],
        'About your woodland': [
          { name: 'Land parcels', status: 'Cannot start yet' },
          { name: 'Enter total area of woodland in your application', status: 'Cannot start yet' },
          { name: 'Grid reference', status: 'Cannot start yet' },
          { name: 'Name of woodland', status: 'Cannot start yet' },
          { name: 'Forestry Commission (FC) team', status: 'Cannot start yet' },
        ],
        'Check and submit application': [
          { name: 'Check your answers', status: 'Cannot start yet' },
          { name: 'Potential funding', status: 'Cannot start yet' },
          { name: 'Submit your application', status: 'Cannot start yet' },
        ],
      })
      await page.getByRole('link', { name: 'All land registered' }).click()
    })

    await test.step('eligibility-land-registered', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-land-registered')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Is all the land in your application registered with the Rural Payments service?')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Save and continue' }).click()

      await expect(page).toHaveURL('/woodland/exit-eligibility-land-registered')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('All the land in your application must be registered with the Rural Payments service')
      await analyzeAccessibility(page)
      await page.getByRole('link', { name: 'Back' }).click()

      await expect(page).toHaveURL('/woodland/eligibility-land-registered')
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('eligibility-management-control -> eligibility-tenant', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-management-control')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Management control')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Save and continue' }).click()
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
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('eligibility-countersignature', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-countersignature')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Have you got the countersignature of the parties who do have management control of the land?')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Save and continue' }).click()

      await expect(page).toHaveURL('/woodland/exit-eligibility-countersignature')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('You must get your landlord\'s countersignature')
      await analyzeAccessibility(page)
      await page.getByRole('link', { name: 'Back' }).click()

      await expect(page).toHaveURL('/woodland/eligibility-countersignature')
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('eligibility-tenant -> eligibility-grazing-rights', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-tenant')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Are you a tenant of a public body?')
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Save and continue' }).click()

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
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('eligibility-tenant-obligations', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-tenant-obligations')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Is the proposed plan a requirement of your tenancy or any other legally binding obligation?')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Save and continue' }).click()

      await expect(page).toHaveURL('/woodland/exit-eligibility-tenant-obligations')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('You cannot apply for a woodland management plan (WMP) for any work that is a requirement of your tenancy or any other legally binding obligation')
      await analyzeAccessibility(page)
      await page.getByRole('link', { name: 'Back' }).click()

      await expect(page).toHaveURL('/woodland/eligibility-tenant-obligations')
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('eligibility-grazing-rights', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-grazing-rights')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Are you applying for land covered by common or shared grazing rights?')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('eligibility-valid-wmp -> eligibility-higher-tier', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-valid-wmp')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Do you already have any live woodland management plans (WMPs) on any land in your application?')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'No' }).click()
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('eligibility-higher-tier', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-higher-tier')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Countryside Stewardship Higher Tier (CSHT)')
      await analyzeAccessibility(page)
      await page.getByRole('link', { name: 'Back' }).click()
    })

    await test.step('eligibility-valid-wmp -> eligibility-wmp-agreement', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-valid-wmp')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Do you already have any live woodland management plans (WMPs) on any land in your application?')
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('eligibility-wmp-agreement', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-wmp-agreement')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Enter the FC plan references for any live WMPs')
      await analyzeAccessibility(page)
      await page.getByRole('textbox').fill('WMP-12345, WMP-23456')
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('eligibility-higher-tier', async () => {
      await expect(page).toHaveURL('/woodland/eligibility-higher-tier')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Countryside Stewardship Higher Tier (CSHT)')
      await page.getByRole('radio', { name: 'Yes' }).click()
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('tasks', async () => {
      await expect(page).toHaveURL('/woodland/tasks')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Woodland Management Plan')
      await assertTaskStatuses(page, {
        'Check your eligibility': [
          { name: 'All land registered', status: 'Completed' },
          { name: 'Management control', status: 'Completed' },
          { name: 'Public body tenant', status: 'Completed' },
          { name: 'Common or shared grazing rights', status: 'Completed' },
          { name: 'Live WMPs on land', status: 'Completed' },
          { name: 'Live WMP plan references', status: 'Completed' },
          { name: 'Apply for CSHT', status: 'Completed' },
        ],
        'About your woodland': [
          { name: 'Land parcels', status: 'Not started' },
          { name: 'Enter total area of woodland in your application', status: 'Cannot start yet' },
          { name: 'Grid reference', status: 'Cannot start yet' },
          { name: 'Name of woodland', status: 'Cannot start yet' },
          { name: 'Forestry Commission (FC) team', status: 'Cannot start yet' },
        ],
        'Check and submit application': [
          { name: 'Check your answers', status: 'Cannot start yet' },
          { name: 'Potential funding', status: 'Cannot start yet' },
          { name: 'Submit your application', status: 'Cannot start yet' },
        ],
      })
      await page.getByRole('link', { name: 'Land parcels' }).click()
    })

    await test.step('land-parcels', async () => {
      await expect(page).toHaveURL('/woodland/land-parcels')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Select all the eligible land parcels for the location of your woodland')
      await analyzeAccessibility(page)
      // SD6252 7537 is under 0.5ha — selecting it alone should fail validation
      await page.getByRole('checkbox', { name: 'SD6252 7537' }).check()
      await page.getByRole('button', { name: 'Save and continue' }).click()

      await expect(page).toHaveURL('/woodland/land-parcels')
      await expect(page.locator('.govuk-error-summary')).toContainText('Total area of selected land parcels must be more than 0.5ha')

      await page.getByRole('checkbox', { name: 'SD6351 8781' }).check()
      await page.getByRole('checkbox', { name: 'SD6352 8774' }).check()
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('total-area-of-woodland', async () => {
      await expect(page).toHaveURL('/woodland/total-area-of-woodland')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Enter total area of woodland in your application')
      await analyzeAccessibility(page)
      await expect(page.locator('.govuk-inset-text')).toContainText('The total area of your selected land parcels is 79.4865 ha')
      await page.getByLabel('Enter total area of woodland over 10 years old').fill('40.25')
      await page.getByLabel('Enter total area of new woodland under 10 years old').fill('15.75')
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('centre-of-woodland', async () => {
      await expect(page).toHaveURL('/woodland/centre-of-woodland')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Grid reference')
      await analyzeAccessibility(page)
      await page.getByRole('textbox').fill('SP 1234 5678')
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('woodland-name', async () => {
      await expect(page).toHaveURL('/woodland/woodland-name')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('What is the name of your woodland?')
      await analyzeAccessibility(page)
      await page.getByRole('textbox').fill('Test Woodland')
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('which-forestry-commission-team', async () => {
      await expect(page).toHaveURL('/woodland/which-forestry-commission-team')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Which Forestry Commission (FC) team will be advising you?')
      await analyzeAccessibility(page)
      await page.getByRole('radio', { name: 'East and East Midlands' }).click()
      await page.getByRole('button', { name: 'Save and continue' }).click()
    })

    await test.step('tasks', async () => {
      await expect(page).toHaveURL('/woodland/tasks')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Woodland Management Plan')
      await assertTaskStatuses(page, {
        'Check your eligibility': [
          { name: 'All land registered', status: 'Completed' },
          { name: 'Management control', status: 'Completed' },
          { name: 'Public body tenant', status: 'Completed' },
          { name: 'Common or shared grazing rights', status: 'Completed' },
          { name: 'Live WMPs on land', status: 'Completed' },
          { name: 'Live WMP plan references', status: 'Completed' },
          { name: 'Apply for CSHT', status: 'Completed' },
        ],
        'About your woodland': [
          { name: 'Land parcels', status: 'Completed' },
          { name: 'Enter total area of woodland in your application', status: 'Completed' },
          { name: 'Grid reference', status: 'Completed' },
          { name: 'Name of woodland', status: 'Completed' },
          { name: 'Forestry Commission (FC) team', status: 'Completed' },
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
      await page.getByRole('button', { name: 'Confirm and submit' }).click()
    })

    await test.step('confirmation', async () => {
      await expect(page).toHaveURL('/woodland/confirmation')
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Application submitted')
      await analyzeAccessibility(page)
      await expect(page.locator('.govuk-panel__body')).toContainText(/WMP-[A-Z0-9]+-[A-Z0-9]+/)
      referenceNumber = await page.locator('.govuk-panel__body strong').textContent()
    })

    await test.step('print-submitted-application', async () => {
      const [printTab] = await Promise.all([
        page.context().waitForEvent('page'),
        page.getByRole('link', { name: 'View / Print submitted application' }).click(),
      ])
      await printTab.waitForLoadState()
      await expect(printTab).toHaveURL('/woodland/print-submitted-application')
      await expect(printTab.getByRole('heading', { level: 1 })).toContainText('Woodland Management Plan application')
      await expect(printTab.getByText(referenceNumber)).toBeVisible()
      await expect(printTab.getByRole('button', { name: 'Print this page' })).toBeVisible()
      await printTab.close()
    })

    if (process.env.MOCKSERVER_HOST) {
      await test.step('verify GAS submission', async () => {
        const request = await getApplicationSubmission(referenceNumber)
        expect(request).not.toBeNull()
        expect(request.body.json.metadata.clientRef).toEqual(referenceNumber.toLowerCase())
        expect(request.body.json.metadata.sbi).toEqual(SBI)
        expect(request.body.json.metadata.crn).toEqual(CRN)
        expect(request.body.json.metadata.frn).toBeTruthy()

        const ajv = new Ajv2020({ strict: false })
        const validate = ajv.compile(gasAnswersSchema)
        const valid = validate(request.body.json.answers)
        expect(valid, ajv.errorsText(validate.errors)).toBe(true)
      })
    }
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
