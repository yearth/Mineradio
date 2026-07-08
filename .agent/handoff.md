# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current behavior, macOS package usability, and the existing 100% production line-coverage gate.

## Current Status

- Branch: `feat/macos-preview`.
- Current local slice: extract podcast search/program result markup into a renderer core helper.
- Latest committed renderer slices:
  - `7b34391 refactor: extract renderer stylesheet`
  - `a99b3f5 refactor: extract renderer script`
  - `27c322d test: add renderer DOM harness`
  - `633d5f9 refactor: extract renderer mini queue helper`
  - `bdecaae refactor: extract renderer search result helper`
  - `cbbaef9 refactor: extract renderer queue panel helper`
- Relevant architecture state:
  - `public/index.html` loads renderer core classic scripts before `renderer/app.js`.
  - Renderer remains classic-script based, not ESM, because existing inline handlers depend on global function names.
  - `public/renderer/app.js` still owns DOM state/effects but delegates tested pure helpers for API, preferences, update state, lyrics, search logic, player queue, mini queue, search result markup, queue panel markup, and now podcast result markup.

## Current Local Changes

- `public/renderer/core/podcast-results.js`: new classic-script/Node-exported helper as `window.MineradioPodcastResults`; renders podcast thumbs, radio rows, empty-program header, and program rows.
- `public/index.html`: loads `renderer/core/podcast-results.js` before `renderer/app.js`.
- `public/renderer/app.js`: keeps podcast request/state/playback functions responsible for data flow, playlist assignment, visibility, and animation, but delegates podcast markup to `window.MineradioPodcastResults`.
- `tests/renderer-podcast-results.test.js`: protects thumb sizing/fallback, radio rows, program header, empty-program header, playback/queue/open/back handlers, escaping, default dependency behavior, and fallback labels.
- `tests/renderer-contract.test.js`: verifies the new core global loads before `renderer/app.js`, verifies app wiring, and includes extracted helper inline handlers in the existing handler-definition contract.

## Verification

- RED before implementation:
  - `npm run test:renderer -- --test-name-pattern "podcast"` failed because `public/renderer/core/podcast-results.js` did not exist.
  - `npm run test:renderer -- --test-name-pattern "podcast result markup"` failed because `renderer/core/podcast-results.js` was not loaded and `MineradioPodcastResults` did not exist before `renderer/app.js`.
- GREEN after implementation:
  - `npm run test:renderer -- --test-name-pattern "podcast"`: 66/66 pass.
  - `npm run test:renderer`: 66/66 pass.
  - `npm test`: 644/644 pass.
  - `npm run coverage`: 644/644 pass; all included production files line coverage `100.00%`, including `public/renderer/core/podcast-results.js`.
  - `git diff --check`: pass.

## Guardrails

- User wants renderer refactors in this order: add tests against current behavior, refactor/split, then rerun the original tests.
- Do not convert renderer scripts to ESM yet.
- Do not move UI styling or visible behavior inside this refactor slice.
- Do not run `npm test` and `npm run coverage` in parallel. Update patch route tests share `public/.mineradio-patch-test.txt`.
- Keep package/build verification separate unless the user asks for a build.

## Next Actions

1. Run independent read-only QA gate for the podcast-results slice.
2. If QA passes, commit with message `refactor: extract renderer podcast result helper`.
3. Next renderer candidates:
   - Extract playlist/podcast collection card markup from `renderUserPlaylistsList`, `renderMyPodcastCollections`, or `renderMyPodcastRadioItems`.
   - Use the DOM harness for stateful renderer DOM behavior before splitting handlers with side effects.
