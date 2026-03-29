import { getAuthorizationHeader } from './backend-auth.js'
import { mintLockToken } from './lock-token.js'

const GRANT_CODE = 'woodland'
const BASE_URL = process.env.BASE_BACKEND_URL

/**
 * Clears application lock and state for a given user before a test run.
 * Both 200 (deleted) and 404 (not found) are acceptable responses.
 *
 * @param {string} crn
 * @param {string} sbi
 */
export async function clearApplicationState(crn, sbi) {
  const authorization = getAuthorizationHeader()

  const lockResponse = await fetch(
    `${BASE_URL}/admin/application-lock?ownerId=${crn}&sbi=${sbi}&grantCode=${GRANT_CODE}&grantVersion=1`,
    { method: 'DELETE', headers: { Authorization: authorization } }
  )
  if (![200, 404].includes(lockResponse.status)) {
    throw new Error(`Failed to delete application lock: ${lockResponse.status}`)
  }

  const stateResponse = await fetch(
    `${BASE_URL}/state?sbi=${sbi}&grantCode=${GRANT_CODE}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: authorization,
        'x-application-lock-owner': mintLockToken(crn, sbi, GRANT_CODE),
      },
    }
  )
  if (![200, 404].includes(stateResponse.status)) {
    throw new Error(`Failed to delete application state: ${stateResponse.status}`)
  }
}
