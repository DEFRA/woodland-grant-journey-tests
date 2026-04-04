# woodland-grant-journey-tests

Playwright journey test suite for the Woodland Grant service, designed to run on the Defra CDP platform and in the `grants-ui` CI pipeline.

## Tech stack

- **Test framework**: Playwright (`@playwright/test`) — JavaScript only, no TypeScript
- **Node version**: 22.13.1 (see `.nvmrc`)

## Project policies

- **JavaScript only** — no TypeScript. Defra policy.
- **No assertions in page objects** — page objects encapsulate navigation and interaction only. Assertions belong in the spec.
- **Helper functions at the bottom of the file** — any file-scoped helper functions (e.g. `assertTaskStatuses`) must be declared after the `test.describe` block, not before.

## Modes of running

### Local — `npm run test:local`

Runs against a local instance of `grants-ui` at `http://localhost:3000`. Uses a headed browser. Config: `playwright.local.config.js`.

### grants-ui CI pipeline — `npm run test:ci`

Runs inside the `grants-ui` GitHub Actions CI pipeline against a dockerised instance of the system under test. The base URL is provided via the `BASE_URL` env var. Worker count is controlled via `MAX_INSTANCES` (default 1). Config: `playwright.ci.config.js`.

### CDP — `npm test`

Runs against a CDP-deployed instance of `grants-ui`. The base URL is built from the `ENVIRONMENT` env var:

```
https://grants-ui.${ENVIRONMENT}.cdp-int.defra.cloud
```

Triggered via the CDP Portal. The HTML report is published to S3 after the run. Config: `playwright.config.js`.

## npm scripts

| Script | What it does |
|---|---|
| `npm test` | CDP mode (requires `ENVIRONMENT` env var) |
| `npm run test:local` | Local mode against localhost:3000 |
| `npm run test:ci` | CI pipeline mode (requires `BASE_URL` env var) |
| `npm run report:publish` | Push `playwright-report/` to S3 via `RESULTS_OUTPUT_S3_PATH` |

## Entrypoint behaviour

`entrypoint.sh` accepts the command as arguments (`"$@"`), defaulting to `npm test` via the Dockerfile `CMD`. This allows the `grants-ui` CI pipeline to override it with `npm run test:ci`.

- If tests fail, a `FAILED` file is written and the process exits with code 1
- Report publishing via `npm run report:publish` only runs when `CDP_HTTP_PROXY` is set (i.e. on CDP, not in CI)
- `RESULTS_OUTPUT_S3_PATH` must be set when running on CDP

## Docker

The `Dockerfile` installs the AWS CLI and Playwright's Chromium with system dependencies via `npx playwright install --with-deps chromium`. Build for linux/amd64 on M1 Macs:

```sh
docker build . --platform=linux/amd64
```

## Test structure

```
test/
  utils/
    auth.js              # login() helper — handles OIDC flow
    gas.js               # MockServer wrapper for GAS interactions
  specs/
    application-journey.spec.js    # Full WMP happy path journey
    application-lifecycle.spec.js  # Submit → amend → offer → withdraw (@ci only)
```

### GAS (Grant Application Service)

`grants-ui` submits applications to an external service called GAS. In CI, GAS is replaced by a **MockServer** instance, which is why tests that interact with GAS are tagged `@ci` only.

The `test/utils/gas.js` helper wraps `mockserver-client` and provides:

- `setDefaultStatusQuery404Response()` — catch-all 404 for status queries; called in `beforeEach`
- `setStatusQueryResponse(referenceNumber, gasStatus)` — mock a status query response
- `getApplicationSubmission(referenceNumber)` — retrieve the recorded POST request from MockServer for assertions
- `clearExpectation(expectationId)` — clean up; called in `afterEach` for all IDs accumulated during the test

**Env vars required:** `MOCKSERVER_HOST`, `MOCKSERVER_PORT`. These are set by the CI environment. Tests using GAS are tagged `@ci` only, so MockServer is always available when these tests run.

### Authentication

All journey tests authenticate via the `Defra ID` OIDC provider used by `grants-ui`. In local running, CI, and the CDP Dev environment this is a stub (`fct-defra-id-stub`). In the CDP Test environment this is a real instance of Defra ID, which can be slower to respond and must be catered for. The `login()` helper in `test/helpers/auth.js` handles the full flow:

1. Navigate to a protected URL → app redirects to stub login page
2. Fill in CRN + password and submit
3. Stub redirects back via OIDC to `/auth/sign-in-oidc`

Each spec must supply its own CRN so tests can run in parallel without sharing session state. There is no default — `crn` is required.
**Password:** controlled by `DEFRA_ID_USER_PASSWORD` env var (default: `x`)

The stub must be running and reachable for journey tests to work. In CI it runs as a Docker service defined in `grants-ui/compose.tests.yml`.

### WMP journey pages (in order)

All pages are prefixed `/woodland/`:

| Path | Description |
|---|---|
| `/start` | Application start page |
| `/check-details` | Confirm applicant/org details |
| `/tasks` | Task list |
| `/eligibility-land-registered` | Land registered with RPA? |
| `/eligibility-management-control` | Management control for duration? |
| `/eligibility-tenant` | Tenant of a public body? |
| `/eligibility-grazing-rights` | Land with grazing rights? |
| `/eligibility-valid-wmp` | Existing valid WMPs? |
| `/eligibility-higher-tier` | Intend to apply for CSHT? |
| `/total-area-of-land-parcels` | Total area (ha) of land parcels |
| `/total-area-of-land-over-10-years-old` | Woodland over 10 years old (ha) |
| `/total-area-of-land-under-10-years-old` | Newly planted woodland under 10 years (ha) |
| `/centre-of-woodland` | Grid reference for centre of woodland |
| `/which-forestry-commission-team` | FC team advising |
| `/summary` | Check your answers |
| `/potential-funding` | Potential funding estimate |
| `/declaration` | Submit your application |
| `/confirmation` | Application received |

Conditional pages (not on happy path): `/eligibility-countersignature`, `/eligibility-tenant-obligations`, `/eligibility-wmp-agreement`, and three exit/terminal pages.

## CI pipeline integration

This suite is integrated into the `grants-ui` CI pipeline. Key points:

- `ignoreHTTPSErrors: true` is set in `playwright.ci.config.js` — the CI environment uses a self-signed cert that Playwright cannot resolve via `NODE_EXTRA_CA_CERTS` (Playwright uses its own certificate store)
- `MAX_INSTANCES` env var controls worker count (default 1)
- No report is generated or published in CI mode — console output only (`list` reporter)

## GitHub Actions

- `.github/workflows/check-pull-request.yml` — installs dependencies on PRs
- `.github/workflows/publish.yml` — builds and publishes the Docker image on merge to main
