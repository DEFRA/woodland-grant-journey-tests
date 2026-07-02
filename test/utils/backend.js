import { getAuthorizationHeader } from './backend-auth.js'
import { mintLockToken } from './lock-token.js'

const GRANT_CODE = 'woodland'
const BASE_URL = process.env.BASE_BACKEND_URL

// The resolved grant version is a grant-level property, so cache it to avoid
// re-probing the backend on every state/lock operation.
let grantVersionCache

/**
 * Probes POST /state/with-definition for a single (crn, sbi) and derives the
 * grant version the backend resolves, mirroring the grants-ui app's own
 * resolution.
 *
 * @returns {Promise<string | undefined | 'locked'>} the version, undefined
 *   when the grant has no backend definition (404), or 'locked' on 423
 */
async function probeGrantVersion(crn, sbi) {
  const response = await fetch(`${BASE_URL}/state/with-definition`, {
    method: 'POST',
    headers: {
      Authorization: getAuthorizationHeader(),
      'Content-Type': 'application/json',
      'x-application-lock-owner': mintLockToken(crn, sbi, GRANT_CODE),
    },
    body: JSON.stringify({ sbi, grantCode: GRANT_CODE, includeDefinition: true }),
  })

  if (response.status === 404) {
    return undefined
  }
  if (response.status === 423) {
    return 'locked'
  }
  if (response.status !== 200) {
    throw new Error(`Failed to probe grant version: ${response.status}`)
  }

  const body = await response.json()
  if (body?.upgraded && body.toVersion) {
    return body.toVersion
  }
  if (body?.state?.grantVersion) {
    return body.state.grantVersion
  }
  const definition = body?.definition
  return definition ? `${definition.major}.${definition.minor}.${definition.patch}` : undefined
}

/**
 * Resolves the grant version the backend persists state and locks under,
 * mirroring the grants-ui app. Backend-sourced (config-broker) grants are
 * served at their released version (e.g. "1.0.1"); legacy YAML-only grants
 * have no backend definition and resolve to undefined (the backend default
 * applies). The version is grant-level, so when the requested application is
 * locked by another applicant it is resolved from an unlocked probe instead.
 *
 * @returns {Promise<string | undefined>} the resolved version, or undefined
 */
async function resolveGrantVersion(crn, sbi) {
  if (grantVersionCache !== undefined) {
    return grantVersionCache
  }

  let version = await probeGrantVersion(crn, sbi)
  if (version === 'locked') {
    const unlockedSbi = String(Math.floor(900000000 + Math.random() * 99999999))
    version = await probeGrantVersion(crn, unlockedSbi)
  }
  if (version === 'locked') {
    version = undefined
  }

  grantVersionCache = version
  return version
}

/**
 * Clears application lock and state for a given user before a test run.
 * Both 200 (deleted) and 404 (not found) are acceptable responses.
 *
 * @param {string} crn
 * @param {string} sbi
 */
export async function clearApplicationState(crn, sbi) {
  const authorization = getAuthorizationHeader()
  const grantVersion = (await resolveGrantVersion(crn, sbi)) ?? 1

  const lockResponse = await fetch(
    `${BASE_URL}/admin/application-lock?ownerId=${crn}&sbi=${sbi}&grantCode=${GRANT_CODE}&grantVersion=${grantVersion}`,
    { method: 'DELETE', headers: { Authorization: authorization } }
  )
  if (![200, 404].includes(lockResponse.status)) {
    throw new Error(`Failed to delete application lock: ${lockResponse.status}`)
  }

  const versionQuery = grantVersion ? `&grantVersion=${grantVersion}` : ''
  const stateResponse = await fetch(
    `${BASE_URL}/state?sbi=${sbi}&grantCode=${GRANT_CODE}${versionQuery}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: authorization,
        'x-application-lock-owner': mintLockToken(crn, sbi, GRANT_CODE, grantVersion),
      },
    }
  )
  if (![200, 404].includes(stateResponse.status)) {
    throw new Error(`Failed to delete application state: ${stateResponse.status}`)
  }
}
