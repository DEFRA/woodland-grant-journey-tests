# woodland-grant-journey-tests

Playwright journey test suite for the Woodland Management Plan grant.

## What This Tests

This test suite provides journey testing coverage for:

- Woodland Management Plan grant application journeys served by [grants-ui](https://github.com/DEFRA/grants-ui)

## Technology Stack

- **Playwright** - Browser automation framework
- **Node.js 22+** - Runtime environment

## Prerequisites

- Node.js `>=22.13.1` (check with `node --version`)
- npm (comes with Node.js)
- Access to a running instance of the service under test (local or CDP)

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/DEFRA/woodland-grant-journey-tests.git
cd woodland-grant-journey-tests
npm install
npx playwright install chromium
```

### 2. Run Tests

```bash
npm run test:local
```

## Running the Test Suite

There are three Playwright configuration files for different environments:

### Local Development — playwright.local.config.js

```bash
npm run test:local
```

- Runs against `http://localhost:3000`
- Headed browser (visible)
- Report opens automatically on failure

### CDP Portal — playwright.config.js

```bash
npm test
```

- Runs against the CDP environment specified by the `ENVIRONMENT` env var
- Base URL pattern: `https://woodland-grant-journey-tests.${ENVIRONMENT}.cdp-int.defra.cloud`
- Triggered via the CDP Portal under Test Suites
- Publishes an HTML report to S3

### CI Pipeline — playwright.ci.config.js

```bash
npm run test:ci
```

- Runs against the URL specified by the `BASE_URL` env var
- Used in the `grants-ui` GitHub Actions CI pipeline
- Automated execution on creating and updating a `grants-ui` PR
- Can also be run locally using the [grants-ui compose file](https://github.com/DEFRA/grants-ui/blob/main/compose.tests.yml)

## Project Structure

```
woodland-grant-journey-tests/
├── test/
│   └── specs/                  # Playwright test files (*.spec.js)
├── playwright.config.js        # CDP Portal config
├── playwright.local.config.js  # Local development config
└── playwright.ci.config.js     # CI pipeline config
```

## Writing Tests

Tests are written using the Playwright test runner in `test/specs/`. Example:

```js
import { test, expect } from '@playwright/test'

test.describe('Woodland', () => {
  test('should load the woodland page', async ({ page }) => {
    const response = await page.goto('/woodland')
    expect(response.status()).toBe(200)
  })
})
```

## Test Reports

The native Playwright HTML report is used. When running on CDP, the report is automatically published to S3 and made available in the portal.

## Troubleshooting

### Tests Won't Run

- Ensure you have the correct Node.js version: `node --version` should be `>=22.13.1`
- Ensure the service under test is running and accessible at the configured base URL
- Run `npx playwright install chromium` if the browser is not installed

## Related Repositories

- [grants-ui](https://github.com/DEFRA/grants-ui) - The main grants application UI service

## Support

For questions or issues with this test suite, please contact the Grants Application Enablement (GAE) team.

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government licence v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
