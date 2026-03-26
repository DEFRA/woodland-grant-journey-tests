# woodland-grant-journey-tests

Playwright journey test suite for the Woodland Grant service, designed to run on the Defra CDP platform and in the `grants-ui` CI pipeline.

## Tech stack

- **Test framework**: Playwright (`@playwright/test`) — JavaScript only, no TypeScript
- **Node version**: 22.13.1 (see `.nvmrc`)

## Project policies

- **JavaScript only** — no TypeScript. Defra policy.

## Modes of running

### Local — `npm run test:local`

Runs against a local instance of `grants-ui` at `http://localhost:3000`. Uses a headed browser. Config: `playwright.local.config.js`.

### grants-ui CI pipeline — `npm run test:ci`

Runs inside the `grants-ui` GitHub Actions CI pipeline against a dockerised instance of the system under test. The base URL is provided via the `BASE_URL` env var. Worker count is controlled via `MAX_INSTANCES` (default 1). Config: `playwright.ci.config.js`.

### CDP — `npm test`

Runs against a CDP-deployed instance of `grants-ui`. The base URL is built from the `ENVIRONMENT` env var:

```
https://woodland-grant-journey-tests.${ENVIRONMENT}.cdp-int.defra.cloud
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
  specs/
    home.spec.js   # Example test — navigates to /woodland and checks HTTP 200
```

## CI pipeline integration

This suite is integrated into the `grants-ui` CI pipeline. Key points:

- `ignoreHTTPSErrors: true` is set in `playwright.ci.config.js` — the CI environment uses a self-signed cert that Playwright cannot resolve via `NODE_EXTRA_CA_CERTS` (Playwright uses its own certificate store)
- `MAX_INSTANCES` env var controls worker count (default 1)
- No report is generated or published in CI mode — console output only (`list` reporter)

## GitHub Actions

- `.github/workflows/check-pull-request.yml` — installs dependencies on PRs
- `.github/workflows/publish.yml` — builds and publishes the Docker image on merge to main
