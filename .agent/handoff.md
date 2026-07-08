# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current behavior, macOS package usability, and the existing 100% production line-coverage gate.

## Current Status

- Branch: `feat/macos-preview`.
- Current local slice: extract search result row/list markup into a renderer core helper.
- Latest committed renderer slices:
  - `7b34391 refactor: extract renderer stylesheet`
  - `a99b3f5 refactor: extract renderer script`
  - `27c322d test: add renderer DOM harness`
  - `633d5f9 refactor: extract renderer mini queue helper`
- Relevant architecture state:
  - `public/index.html` loads renderer core classic scripts before `renderer/app.js`.
  - Renderer remains classic-script based, not ESM, because existing inline handlers depend on global function names.
  - `public/renderer/app.js` still owns DOM state/effects but delegates tested pure helpers for API, preferences, update state, lyrics, search logic, player queue, mini queue, and now search result markup.

## Current Local Changes

- `public/renderer/core/search-results.js`: new classic-script/Node-exported helper as `window.MineradioSearchResults`; renders source tags, metadata text/html, single search result rows, and joined search result lists.
- `public/index.html`: loads `renderer/core/search-results.js` before `renderer/app.js`.
- `public/renderer/app.js`: keeps existing wrapper function names and `renderSongSearchResults` DOM responsibilities, but delegates search result markup to `window.MineradioSearchResults`.
- `tests/renderer-search-results.test.js`: protects source labels, metadata/artist link markup, cover fallback, VIP/source tags, action buttons, escaping, default dependency behavior, and list joining.
- `tests/renderer-contract.test.js`: verifies the new core global loads before `renderer/app.js`, verifies app wiring, and includes extracted helper inline handlers in the existing handler-definition contract.

## Verification

- RED before implementation:
  - `npm run test:renderer -- --test-name-pattern "search result"` failed because `public/renderer/core/search-results.js` did not exist.
  - `npm run test:renderer -- --test-name-pattern "search result markup"` failed because `renderer/core/search-results.js` was not loaded and `MineradioSearchResults` did not exist before `renderer/app.js`.
- GREEN after implementation:
  - `npm run test:renderer -- --test-name-pattern "search result markup"`: 55/55 pass.
  - `npm run test:renderer`: 55/55 pass before default-deps coverage test; search-result-focused rerun is 56/56 pass after adding it.
  - `npm test`: 633/633 pass before the final default-deps coverage test.
  - `npm run coverage`: 634/634 pass; all included production files line coverage `100.00%`, including `public/renderer/core/search-results.js`.
  - `git diff --check`: pass.

## Guardrails

- User wants renderer refactors in this order: add tests against current behavior, refactor/split, then rerun the original tests.
- Do not convert renderer scripts to ESM yet.
- Do not move UI styling or visible behavior inside this refactor slice.
- Do not run `npm test` and `npm run coverage` in parallel. Update patch route tests share `public/.mineradio-patch-test.txt`.
- Keep package/build verification separate unless the user asks for a build.

## Next Actions

1. Run independent read-only QA gate for the search-results slice.
2. If QA passes, commit with message `refactor: extract renderer search result helper`.
3. Next renderer candidates:
   - Extract queue panel row/list markup from `public/renderer/app.js`.
   - Extract podcast result/program markup after queue panel if the contract remains stable.
   - Use the DOM harness for stateful renderer DOM behavior before splitting handlers with side effects.
