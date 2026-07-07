# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current behavior, macOS package usability, and the existing 100% production line-coverage gate.

## Current Status

- Branch: `feat/macos-preview`
- Latest committed renderer slices:
  - `7b34391 refactor: extract renderer stylesheet`
  - `a99b3f5 refactor: extract renderer script`
- Current local slice: API client renderer wiring, the first low-risk split from `public/renderer/app.js`.
- Local changes:
  - `public/renderer/core/api-client.js` now supports both Node `module.exports` and browser classic-script global export as `window.MineradioApiClient`.
  - `public/index.html` loads `renderer/core/api-client.js` immediately before `renderer/app.js`.
  - `public/renderer/app.js` no longer defines inline `async function apiJson`; it creates `apiJson` via `window.MineradioApiClient.createApiJson(...)`.
  - `tests/renderer-contract.test.js` adds a wiring contract for API client load order, browser global exposure, and removal of the old inline `apiJson` declaration.
- No visible UI behavior is intended to change in this slice. Other `public/renderer/core/*.js` modules are still characterization/protection modules and are not yet wired into `app.js`.

## Renderer State

- `public/index.html`: 849 lines.
- `public/styles/app.css`: 2172 lines.
- `public/renderer/app.js`: approximately 24193 lines after API client wiring.
- Renderer still uses classic scripts, not `type="module"`, because many inline handlers rely on global function names.
- Current renderer tests protect:
  - `public/index.html`, `public/styles/app.css`, and `public/renderer/app.js` existence.
  - Electron package inclusion through `build.files` containing `public/**/*`.
  - Script order: `vendor/three.r128.min.js` -> `vendor/music-tempo.min.js` -> `vendor/gsap.min.js` -> DIY preload inline script, with `renderer/app.js` loaded last.
  - Inline `on*` handlers from both `public/index.html` and renderer-generated HTML strings in `public/renderer/app.js`.
  - Renderer classic-JS syntax through `vm.Script`.
  - Pure renderer behavior for API calls, preferences, update panel state, search, player queue, and lyric parsing.
  - API client browser wiring: `renderer/core/api-client.js` must load before `renderer/app.js`, expose `window.MineradioApiClient`, and `app.js` must use `MineradioApiClient.createApiJson`.

## Guardrails

- User explicitly wants renderer refactors to follow this order:
  1. Add tests that pass against current behavior.
  2. Refactor/split renderer code.
  3. Re-run the original tests and require them to keep passing.
- Do not split renderer files before the relevant contract/unit tests are already green.
- Do not convert renderer scripts to ESM yet; global inline handlers must remain compatible.
- Any renderer core module loaded by `index.html` must support browser classic-script execution. `api-client.js` already does; the remaining core modules still need browser-compatible wrappers or a bundling step before adding script tags.
- Do not run `npm test` and `npm run coverage` in parallel. Update patch route tests share `public/.mineradio-patch-test.txt`, so parallel full-suite commands can interfere with each other.
- Keep UI changes separate from test/refactor slices unless the user explicitly asks for visible UI work.

## Latest Verification

- Initial RED for API client wiring: `npm run test:renderer` failed with `renderer/core/api-client.js must be loaded`.
- `npm run test:renderer`: 30/30 pass.
- `npm test`: 608/608 pass.
- `npm run coverage`: 608/608 pass; all included files line coverage `100.00%`, including `public/renderer/core/api-client.js`.
- `git diff --check`: pass.
- QA subagent verdict for this slice: `PASS`. It reran `npm run test:renderer`, `node --check public/renderer/core/api-client.js && node --check public/renderer/app.js`, `npm test && npm run coverage`, and `git diff --check`.

## Next Actions

1. Commit the API client wiring slice if it is not already committed.
2. Next renderer refactor candidate: preference/localStorage helpers. Add/adjust a wiring contract first, make `preferences.js` browser-compatible before loading it, then replace only the matching `app.js` helpers.
3. Preserve classic script/global-handler compatibility and re-run `npm run test:renderer`, `npm test`, and `npm run coverage`.
