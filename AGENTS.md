# Repository Guidelines

## Project Structure & Module Organization

Playwright specs live in `test/specs/`, shared helpers in `test/utils/`, and JSON schemas in `test/schemas/`. Environment-specific execution is configured by `playwright.local.config.js`, `playwright.cdp.config.js`, and `playwright.ci.config.js`. Report publishing is handled by `bin/publish-tests.sh`.

## Build, Test, and Development Commands

- `npm install`: install dependencies.
- `npx playwright install chromium`: install the browser for local runs.
- `npm run test:local`: run against local Grants UI.
- `npm test`: run the CDP Portal configuration.
- `npm run test:ci`: run the CI configuration.
- `npm run report:publish`: publish the Playwright HTML report.

## Coding Style & Naming Conventions

Use ES modules and the local Playwright style. Keep specs named after the lifecycle or journey they cover and keep helpers focused on authentication, backend setup, GAS, and accessibility.

## Domain Language

Use `CONTEXT.md` as the source of truth for woodland grant journey-test language. Prefer those terms in specs, helpers, docs, and generated changes.

## Developer Addenda

Developers can add their own `AGENTS.local.md` and should be read as an addendum to this file. Keep that file local to your machine and do not commit it.

## Testing Guidelines

Preserve accessibility checks on journey pages. Run the relevant Playwright config locally or in CI mode before opening a PR.
