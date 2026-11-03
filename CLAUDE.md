# CLAUDE.md

Project rules for coding assistants and contributors.

## What this is

A Gladys Assistant **external integration** that tracks the mileage of a
leased car (French LOA/LLD) against its contract allowance. Node.js 22+, ESM,
no build step, a single runtime dependency:
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).
The tooling (CI, release workflow, Dockerfile, manifest tests) comes from the
official `integration-template-js`.

## Commands

```bash
npm install
npm test               # node --test, the built-in runner
npm run lint           # ESLint
npm run format:check   # Prettier, as the CI runs it
npm run format         # Prettier, fix in place
```

Run the three checks before pushing; the CI runs them on Node 22 and 24 and
builds the Docker image.

## Architecture

- `src/lease.js` holds ALL the arithmetic, pure (config + reading + now in,
  figures out). Change the computation there, with a test in
  `test/lease.test.js`.
- `src/lease-service.js` owns the state (config, last reading) and publishes;
  every surface (action, widget, scenes, hourly timer) goes through it.
- `src/app.js` registers every SDK handler; `index.js` only connects.
- Tests drive the real wiring against `createFakeGladys()` (SDK testing
  module) with an injected `now`: never depend on the wall clock.

## Rules

- **External ids and keys are forever**: the device id (`lease` /
  `contract-1`), the feature keys in `src/vehicle.js`, the manifest
  `config_schema`, action, scene action, output and widget keys. Renaming one
  orphans the history, scenes and dashboards that use it.
- The last reading lives in the integration config under `last_reading_km` /
  `last_reading_at` (outside the `config_schema`). Keep those names.
- Figures that cannot be computed (no reading, first week) are not published,
  never published as 0.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json` or the manifest, nor the `docker_image` tag, by hand.
- Every user-visible change adds a line under `## [Unreleased]` in
  `CHANGELOG.md`.
- User-facing text is bilingual (French and English): manifest texts, action
  messages, errors, `docs/fr.md` / `docs/en.md` kept in sync.
- Comments explain why, in English. Tests never touch the network.
