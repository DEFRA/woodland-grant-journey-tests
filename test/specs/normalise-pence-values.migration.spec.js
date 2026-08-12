import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'

import { authenticateTo } from '../utils/auth.js'
import { clearApplicationState } from '../utils/backend.js'

const BACKEND_DIR = process.env.GRANTS_UI_BACKEND_DIR ?? '../grants-ui-backend'
const BACKEND_MONGO_URI = process.env.GRANTS_UI_BACKEND_MONGO_URI ?? 'mongodb://localhost:27017/?directConnection=true'
const BACKEND_MONGO_DATABASE = process.env.GRANTS_UI_BACKEND_MONGO_DATABASE ?? 'grants-ui-backend'
const STATE_COLLECTION = process.env.STATE_COLLECTION ?? 'state__grant_application_state'
const SOURCE_CRN = '1100943757'
const SOURCE_SBI = '113593357'
const GRANT_CODE = 'woodland'
const GRANT_VERSION = '1.0.0'
const PROOF_PREFIX = 'normalise-pence-values-proof'
const PROOF_RECORD_COUNT = 100

const TOTAL_GBP = 19.99
const RATE_GBP = 0.29
const FLAT_RATE_GBP = 0.57

const toBadPence = (value) => value * 100

const BAD_PENCE = {
  total: toBadPence(TOTAL_GBP),
  rate: toBadPence(RATE_GBP),
  flatRate: toBadPence(FLAT_RATE_GBP)
}

const EXPECTED_PENCE = {
  total: Math.round(BAD_PENCE.total),
  rate: Math.round(BAD_PENCE.rate),
  flatRate: Math.round(BAD_PENCE.flatRate)
}

const PENCE_FIELD_ASSERTIONS = [
  {
    path: 'state.totalPence',
    statePath: 'totalPence',
    bad: BAD_PENCE.total,
    expected: EXPECTED_PENCE.total
  },
  {
    path: 'state.payment.agreementTotalPence',
    statePath: 'payment.agreementTotalPence',
    bad: BAD_PENCE.total,
    expected: EXPECTED_PENCE.total
  },
  {
    path: 'state.payment.agreementLevelItems.1.activeTierRatePence',
    statePath: 'payment.agreementLevelItems.1.activeTierRatePence',
    bad: BAD_PENCE.rate,
    expected: EXPECTED_PENCE.rate
  },
  {
    path: 'state.payment.agreementLevelItems.1.activeTierFlatRatePence',
    statePath: 'payment.agreementLevelItems.1.activeTierFlatRatePence',
    bad: BAD_PENCE.flatRate,
    expected: EXPECTED_PENCE.flatRate
  },
  {
    path: 'state.payment.agreementLevelItems.1.agreementTotalPence',
    statePath: 'payment.agreementLevelItems.1.agreementTotalPence',
    bad: BAD_PENCE.total,
    expected: EXPECTED_PENCE.total
  },
  {
    path: 'state.payment.payments.0.totalPaymentPence',
    statePath: 'payment.payments.0.totalPaymentPence',
    bad: BAD_PENCE.total,
    expected: EXPECTED_PENCE.total
  },
  {
    path: 'state.payment.payments.0.lineItems.0.paymentPence',
    statePath: 'payment.payments.0.lineItems.0.paymentPence',
    bad: BAD_PENCE.total,
    expected: EXPECTED_PENCE.total
  }
]

const PROOF_USERS = Array.from({ length: PROOF_RECORD_COUNT }, (_, index) => ({
  crn: String(1300000001 + index),
  sbi: String(300000001 + index)
}))

test.describe('normalise pence values migration proof', () => {
  test(`normalise pence migration fixes ${PROOF_RECORD_COUNT} cloned Woodlands states and reviews submission`, { tag: ['@runme'] }, async ({
    page,
    browser
  }) => {
    let sourceDoc
    let proofStates
    let proofIds

    await test.step('complete a real Woodlands journey once', async () => {
      await clearApplicationState(SOURCE_CRN, SOURCE_SBI)
      await completeWoodlandJourney(page, SOURCE_CRN)

      sourceDoc = await readStateBySbi(SOURCE_SBI)

      expect(sourceDoc).not.toBeNull()
      expect(sourceDoc.sbi).toBe(SOURCE_SBI)
      assertRealCompletedWoodlandsShape([sourceDoc])
      assertAllCurrentPenceFieldsAreCovered([sourceDoc])
    })

    await test.step(`clone the completed Woodlands state for ${PROOF_RECORD_COUNT} proof users`, async () => {
      proofStates = buildProofStatesFromSource(sourceDoc)
      proofIds = proofStates.map(({ _id }) => _id)

      await seedBadWoodlandStates(proofStates)
    })

    await test.step('prove the seeded states only differ by CRN/SBI identity and corrupt monetary values', async () => {
      const seededDocs = await readProofStates(proofIds)

      expect(seededDocs).toHaveLength(PROOF_RECORD_COUNT)
      assertProofIdentity(seededDocs)
      assertRealCompletedWoodlandsShape(seededDocs)
      assertAllCurrentPenceFieldsAreCovered(seededDocs)
      assertClonedStateOnlyChangesPence(seededDocs, sourceDoc.state)
      assertBrokenPenceValues(seededDocs)
    })

    await test.step('run the backend migration against the seeded database records', async () => {
      const result = await runBackendScript(`
        const migration = require('./migrations/state/20260702000000-normalise-pence-values')
        const { createServer } = require('./src/server')

        ;(async () => {
          const server = await createServer()

          try {
            await migration.up(server.stateDb)
          } finally {
            await server.stop()
          }

          console.log(JSON.stringify({ migrated: true }))
        })().catch((error) => {
          console.error(error)
          process.exit(1)
        })
      `)

      expect(result.migrated).toBe(true)
    })

    await test.step('prove the database records have been rounded and non-monetary state is unchanged', async () => {
      const fixedDocs = await readProofStates(proofIds)

      expect(fixedDocs).toHaveLength(PROOF_RECORD_COUNT)
      assertProofIdentity(fixedDocs)
      assertRealCompletedWoodlandsShape(fixedDocs)
      assertAllCurrentPenceFieldsAreCovered(fixedDocs)
      assertClonedStateOnlyChangesPence(fixedDocs, sourceDoc.state)
      assertFixedPenceValues(fixedDocs)
      expect(buildDatabaseProof(fixedDocs)).toEqual(
        PROOF_USERS.map((user, index) => ({
          _id: proofIds[index],
          sbi: user.sbi,
          totalPence: EXPECTED_PENCE.total,
          agreementTotalPence: EXPECTED_PENCE.total,
          activeTierRatePence: EXPECTED_PENCE.rate,
          activeTierFlatRatePence: EXPECTED_PENCE.flatRate,
          paymentPence: EXPECTED_PENCE.total
        }))
      )
    })

    await test.step('authenticate as a proof user and review the fixed submitted application', async () => {
      await page.context().close()

      const reviewContext = await browser.newContext()
      const reviewPage = await reviewContext.newPage()

      await authenticateTo(reviewPage, 'woodland', PROOF_USERS[0].crn)
      await reviewPage.goto('woodland/print-submitted-application')

      await expect(reviewPage).toHaveURL('/woodland/print-submitted-application')
      await expect(reviewPage.getByRole('heading', { level: 1 })).toContainText('Apply for a woodland management plan (WMP)')
      await expect(reviewPage.getByText(sourceDoc.state.$$__referenceNumber)).toBeVisible()
      await expect(reviewPage.getByText(String(sourceDoc.state.hectaresTenOrOverYearsOld)).first()).toBeVisible()
      await expect(reviewPage.getByText(sourceDoc.state.landParcelsDisplay)).toBeVisible()
      await expect(reviewPage.getByRole('button', { name: 'Print this page' })).toBeVisible()

      await reviewContext.close()
    })
  })
})

async function completeWoodlandJourney(page, crn) {
  await authenticateTo(page, 'woodland', crn)

  await expect(page).toHaveURL('/woodland/check-details')
  await page.getByRole('radio', { name: 'Yes' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page).toHaveURL('/woodland/tasks')
  await page.getByRole('link', { name: 'Check your eligibility' }).click()

  await expect(page).toHaveURL('/woodland/eligibility-land-registered')
  await page.getByRole('radio', { name: 'Yes' }).click()
  await page.getByRole('button', { name: 'Save and continue' }).click()

  await expect(page).toHaveURL('/woodland/eligibility-management-control')
  await page.getByRole('radio', { name: 'Yes' }).click()
  await page.getByRole('button', { name: 'Save and continue' }).click()

  await expect(page).toHaveURL('/woodland/eligibility-tenant')
  await page.getByRole('radio', { name: 'No' }).click()
  await page.getByRole('button', { name: 'Save and continue' }).click()

  await expect(page).toHaveURL('/woodland/eligibility-grazing-rights')
  await page.getByRole('radio', { name: 'No' }).click()
  await page.getByRole('button', { name: 'Save and continue' }).click()

  await expect(page).toHaveURL('/woodland/eligibility-valid-wmp')
  await page.getByRole('radio', { name: 'No' }).click()
  await page.getByRole('button', { name: 'Save and continue' }).click()

  await expect(page).toHaveURL('/woodland/eligibility-higher-tier')
  await page.getByRole('radio', { name: 'Yes' }).click()
  await page.getByRole('button', { name: 'Save and continue' }).click()

  await expect(page).toHaveURL('/woodland/tasks')
  await page.getByRole('link', { name: 'About your woodland' }).click()

  await expect(page).toHaveURL('/woodland/land-parcels')
  await page.getByRole('checkbox', { name: 'SD6351 8781' }).check()
  await page.getByRole('checkbox', { name: 'SD6352 8774' }).check()
  await page.getByRole('checkbox', { name: 'SD6252 7537' }).check()
  await page.getByRole('button', { name: 'Save and continue' }).click()

  await expect(page).toHaveURL('/woodland/total-area-of-woodland')
  await page.getByLabel('Enter total area of woodland over 10 years old').fill('40.25')
  await page.getByLabel('Enter total area of new woodland under 10 years old').fill('15.75')
  await page.getByRole('button', { name: 'Save and continue' }).click()

  await expect(page).toHaveURL('/woodland/centre-of-woodland')
  await page.getByRole('textbox').fill('SP 1234 5678')
  await page.getByRole('button', { name: 'Save and continue' }).click()

  await expect(page).toHaveURL('/woodland/woodland-name')
  await page.getByRole('textbox').fill('Test Woodland')
  await page.getByRole('button', { name: 'Save and continue' }).click()

  await expect(page).toHaveURL('/woodland/which-forestry-commission-team')
  await page.getByRole('radio', { name: 'East and East Midlands' }).click()
  await page.getByRole('button', { name: 'Save and continue' }).click()

  await expect(page).toHaveURL('/woodland/tasks')
  await page.getByRole('link', { name: 'Check and submit application' }).click()

  await expect(page).toHaveURL('/woodland/summary')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page).toHaveURL('/woodland/potential-funding')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page).toHaveURL('/woodland/declaration')
  await page.getByRole('button', { name: 'Confirm and submit' }).click()

  await expect(page).toHaveURL('/woodland/confirmation')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Application submitted')
}

function buildProofStatesFromSource(sourceDoc) {
  return PROOF_USERS.map((user, index) => {
    const proofNumber = String(index + 1).padStart(String(PROOF_RECORD_COUNT).length, '0')
    const state = deepClone(sourceDoc.state)

    applyBadPenceValues(state)

    return {
      ...sourceDoc,
      _id: `${PROOF_PREFIX}-${proofNumber}`,
      sbi: user.sbi,
      grantCode: GRANT_CODE,
      grantVersion: GRANT_VERSION,
      state
    }
  })
}

async function seedBadWoodlandStates(states) {
  return runBackendScript(
    `
      const { createServer } = require('./src/server')

      const readStdin = () => new Promise((resolve, reject) => {
        let data = ''
        process.stdin.setEncoding('utf8')
        process.stdin.on('data', (chunk) => {
          data += chunk
        })
        process.stdin.on('end', () => resolve(data))
        process.stdin.on('error', reject)
      })

      ;(async () => {
        const states = JSON.parse(await readStdin())
        const server = await createServer()
        const db = server.stateDb
        const ids = states.map(({ _id }) => _id)

        await db.collection('${STATE_COLLECTION}').deleteMany({ _id: { $in: ids } })
        await db.collection('${STATE_COLLECTION}').insertMany(states)
        await server.stop()

        console.log(JSON.stringify({ inserted: states.length }))
      })().catch((error) => {
        console.error(error)
        process.exit(1)
      })
    `,
    { input: JSON.stringify(states) }
  )
}

async function readStateBySbi(sbi) {
  return runBackendScript(
    `
      const { createServer } = require('./src/server')

      const readStdin = () => new Promise((resolve, reject) => {
        let data = ''
        process.stdin.setEncoding('utf8')
        process.stdin.on('data', (chunk) => {
          data += chunk
        })
        process.stdin.on('end', () => resolve(data))
        process.stdin.on('error', reject)
      })

      ;(async () => {
        const { sbi } = JSON.parse(await readStdin())
        const server = await createServer()
        const db = server.stateDb
        const state = await db
          .collection('${STATE_COLLECTION}')
          .findOne({ sbi, grantCode: '${GRANT_CODE}', grantVersion: '${GRANT_VERSION}' })

        await server.stop()

        console.log(JSON.stringify(state))
      })().catch((error) => {
        console.error(error)
        process.exit(1)
      })
    `,
    { input: JSON.stringify({ sbi }) }
  )
}

async function readProofStates(ids) {
  const result = await runBackendScript(
    `
      const { createServer } = require('./src/server')

      const readStdin = () => new Promise((resolve, reject) => {
        let data = ''
        process.stdin.setEncoding('utf8')
        process.stdin.on('data', (chunk) => {
          data += chunk
        })
        process.stdin.on('end', () => resolve(data))
        process.stdin.on('error', reject)
      })

      ;(async () => {
        const { ids } = JSON.parse(await readStdin())
        const server = await createServer()
        const db = server.stateDb
        const states = await db
          .collection('${STATE_COLLECTION}')
          .find({ _id: { $in: ids } })
          .sort({ _id: 1 })
          .toArray()

        await server.stop()

        console.log(JSON.stringify(states))
      })().catch((error) => {
        console.error(error)
        process.exit(1)
      })
    `,
    { input: JSON.stringify({ ids }) }
  )

  return result.sort((left, right) => left._id.localeCompare(right._id))
}

async function runBackendScript(script, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script], {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        MONGO_URI: BACKEND_MONGO_URI,
        MONGO_DATABASE: BACKEND_MONGO_DATABASE,
        LOG_ENABLED: 'false'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Backend script failed with code ${code}\n${stderr}`))
        return
      }

      try {
        resolve(JSON.parse(stdout.trim()))
      } catch (error) {
        reject(new Error(`Unable to parse backend script output:\n${stdout}\n${stderr}\n${error.message}`))
      }
    })

    if (input) {
      child.stdin.write(input)
    }

    child.stdin.end()
  })
}

function applyBadPenceValues(state) {
  for (const assertion of PENCE_FIELD_ASSERTIONS) {
    setByPath(state, assertion.statePath, assertion.bad)
  }
}

function assertProofIdentity(docs) {
  expect(docs.map(({ _id }) => _id)).toEqual(
    Array.from({ length: PROOF_RECORD_COUNT }, (_, index) => {
      const proofNumber = String(index + 1).padStart(String(PROOF_RECORD_COUNT).length, '0')

      return `${PROOF_PREFIX}-${proofNumber}`
    })
  )
  expect(docs.map(({ sbi }) => sbi)).toEqual(PROOF_USERS.map(({ sbi }) => sbi))
}

function assertRealCompletedWoodlandsShape(docs) {
  for (const doc of docs) {
    expect(doc.grantCode).toBe(GRANT_CODE)
    expect(doc.grantVersion).toBe(GRANT_VERSION)
    expect(doc.state.formSlug).toBe('woodland')
    expect(doc.state.applicationStatus).toBe('SUBMITTED')
    expect(doc.state.submittedAt).toBeTruthy()
    expect(doc.state.submittedBy).toBe(SOURCE_CRN)
    expect(doc.state.$$__referenceNumber).toMatch(/^WMP-[A-Z0-9]+-[A-Z0-9]+$/)
    expect(doc.state.hectaresTenOrOverYearsOld).toBe(40.25)
    expect(doc.state.hectaresUnderTenYearsOld).toBe(15.75)
    expect(doc.state.landParcelsDisplay).toContain('SD6351-8781')
    expect(doc.state.landParcelsDisplay).toContain('SD6352-8774')
    expect(doc.state.landParcelsDisplay).toContain('SD6252-7537')
    expect(doc.state.payment.frequency).toBe('Single')
    expect(doc.state.payment.parcelItems).toEqual({})
    expect(doc.state.payment.payments).toHaveLength(1)
    expect(doc.state.payment.payments[0].paymentDate).toBeNull()
    expect(doc.state.payment.payments[0].lineItems).toHaveLength(1)
  }
}

function assertAllCurrentPenceFieldsAreCovered(docs) {
  const expectedPaths = PENCE_FIELD_ASSERTIONS.map(({ path }) => path).sort()

  for (const doc of docs) {
    expect(collectPencePaths(doc.state).sort()).toEqual(expectedPaths)
  }
}

function assertClonedStateOnlyChangesPence(docs, sourceState) {
  const expectedState = stripPenceFields(sourceState)

  for (const doc of docs) {
    expect(stripPenceFields(doc.state)).toEqual(expectedState)
  }
}

function assertBrokenPenceValues(docs) {
  for (const doc of docs) {
    for (const { path, bad } of PENCE_FIELD_ASSERTIONS) {
      const value = getByPath(doc, path)

      expect(value).toBe(bad)
      expect(Number.isInteger(value)).toBe(false)
    }
  }
}

function assertFixedPenceValues(docs) {
  for (const doc of docs) {
    for (const { path, expected } of PENCE_FIELD_ASSERTIONS) {
      const value = getByPath(doc, path)

      expect(value).toBe(expected)
      expect(Number.isInteger(value)).toBe(true)
    }
  }
}

function buildDatabaseProof(docs) {
  return docs.map((doc) => ({
    _id: doc._id,
    sbi: doc.sbi,
    totalPence: doc.state.totalPence,
    agreementTotalPence: doc.state.payment.agreementTotalPence,
    activeTierRatePence: doc.state.payment.agreementLevelItems[1].activeTierRatePence,
    activeTierFlatRatePence: doc.state.payment.agreementLevelItems[1].activeTierFlatRatePence,
    paymentPence: doc.state.payment.payments[0].lineItems[0].paymentPence
  }))
}

function stripPenceFields(state) {
  const stripped = deepClone(state)

  for (const { statePath } of PENCE_FIELD_ASSERTIONS) {
    deleteByPath(stripped, statePath)
  }

  return stripped
}

function collectPencePaths(value, prefix = 'state') {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectPencePaths(item, `${prefix}.${index}`))
  }

  if (!isObject(value)) {
    return []
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const path = `${prefix}.${key}`
    const nestedPaths = collectPencePaths(nestedValue, path)

    return key.endsWith('Pence') ? [path, ...nestedPaths] : nestedPaths
  })
}

function getByPath(value, path) {
  return path.split('.').reduce((current, part) => current?.[part], value)
}

function setByPath(value, path, newValue) {
  const parts = path.split('.')
  const lastPart = parts.pop()
  const parent = parts.reduce((current, part) => current[part], value)

  parent[lastPart] = newValue
}

function deleteByPath(value, path) {
  const parts = path.split('.')
  const lastPart = parts.pop()
  const parent = parts.reduce((current, part) => current?.[part], value)

  if (parent) {
    delete parent[lastPart]
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function isObject(value) {
  return value !== null && typeof value === 'object'
}
