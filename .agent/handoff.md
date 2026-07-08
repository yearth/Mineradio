# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current behavior, macOS package usability, and the existing 100% production line-coverage gate.

## Current Status

- Branch: `feat/macos-preview`.
- Current local slice: extract playlist panel list/card markup into a renderer core helper.
- Latest committed renderer slices:
  - `7b34391 refactor: extract renderer stylesheet`
  - `a99b3f5 refactor: extract renderer script`
  - `27c322d test: add renderer DOM harness`
  - `633d5f9 refactor: extract renderer mini queue helper`
  - `bdecaae refactor: extract renderer search result helper`
  - `cbbaef9 refactor: extract renderer queue panel helper`
  - `9756b94 refactor: extract renderer podcast result helper`
- Relevant architecture state:
  - `public/index.html` loads renderer core classic scripts before `renderer/app.js`.
  - Renderer remains classic-script based, not ESM, because existing inline handlers depend on global function names.
  - `public/renderer/app.js` still owns DOM state/effects but delegates tested pure helpers for API, preferences, update state, lyrics, search logic, player queue, mini queue, search result markup, queue panel markup, podcast result markup, and now playlist panel markup.

## Current Local Changes

- `public/renderer/core/playlist-panel.js`: new classic-script/Node-exported helper as `window.MineradioPlaylistPanel`; renders playlist panel section labels, playlist cards, empty fallback, provider/key helpers, and rendered-count metadata.
- `public/index.html`: loads `renderer/core/playlist-panel.js` before `renderer/app.js`.
- `public/renderer/app.js`: keeps playlist request/state/detail/load-more/animation behavior in the renderer app, but delegates playlist panel key/provider-id/list markup to `window.MineradioPlaylistPanel`.
- `tests/renderer-playlist-panel.test.js`: protects provider/key/provider-id/cover rules, QQ/Netease grouping, render-limit behavior, expanded-card class, card data attributes, cover fallback, detail injection, empty fallback, and escaping.
- `tests/renderer-contract.test.js`: verifies the new core global loads before `renderer/app.js` and verifies app wiring to `MineradioPlaylistPanel`.

## Verification

- RED before implementation:
  - `npm run test:renderer -- --test-name-pattern "playlist panel"` failed because `public/renderer/core/playlist-panel.js` did not exist.
  - `npm run test:renderer -- --test-name-pattern "playlist panel markup"` failed because `renderer/core/playlist-panel.js` was not loaded and `MineradioPlaylistPanel` did not exist before `renderer/app.js`.
- GREEN after implementation:
  - `npm run test:renderer -- --test-name-pattern "playlist panel"`: 71/71 pass.
  - `npm run test:renderer`: 71/71 pass.
  - `npm test`: 649/649 pass.
  - `npm run coverage`: 649/649 pass; all included production files line coverage `100.00%`, including `public/renderer/core/playlist-panel.js`.
  - `git diff --check`: pass.

## Guardrails

- User wants renderer refactors in this order: add tests against current behavior, refactor/split, then rerun the original tests.
- Do not convert renderer scripts to ESM yet.
- Do not move UI styling or visible behavior inside this refactor slice.
- Do not run `npm test` and `npm run coverage` in parallel. Update patch route tests share `public/.mineradio-patch-test.txt`.
- Keep package/build verification separate unless the user asks for a build.

## Next Actions

1. Run independent read-only QA gate for the playlist-panel slice.
2. If QA passes, commit with message `refactor: extract renderer playlist panel helper`.
3. Next renderer candidates:
   - Extract podcast collection/radio card markup from `renderMyPodcastCollections` or `renderMyPodcastRadioItems`.
   - Use the DOM harness for stateful renderer DOM behavior before splitting handlers with side effects.
