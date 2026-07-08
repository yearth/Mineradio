# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current behavior, macOS package usability, and the existing 100% production line-coverage gate.

## Current Status

- Branch: `feat/macos-preview`.
- Current local slice: extend the playlist panel renderer helper to own playlist detail markup.
- Latest committed renderer slices:
  - `7b34391 refactor: extract renderer stylesheet`
  - `a99b3f5 refactor: extract renderer script`
  - `27c322d test: add renderer DOM harness`
  - `633d5f9 refactor: extract renderer mini queue helper`
  - `bdecaae refactor: extract renderer search result helper`
  - `cbbaef9 refactor: extract renderer queue panel helper`
  - `9756b94 refactor: extract renderer podcast result helper`
  - `24cdf58 refactor: extract renderer playlist panel helper`
  - `c50e783 refactor: extract renderer podcast collection helper`
- Relevant architecture state:
  - `public/index.html` loads renderer core classic scripts before `renderer/app.js`.
  - Renderer remains classic-script based, not ESM, because existing inline handlers depend on global function names.
  - `public/renderer/app.js` still owns DOM state/effects but delegates tested pure helpers for API, preferences, update state, lyrics, search logic, player queue, mini queue, search result markup, queue panel markup, podcast result markup, playlist panel markup, my-podcast collection/radio panel markup, and now playlist detail markup.

## Current Local Changes

- `public/renderer/core/playlist-panel.js`: extends existing `window.MineradioPlaylistPanel` with playlist detail helpers for detail cover URL, track rows, loading row, empty fallback, load-more/progress footer, play/top buttons, row/artist data attributes, and escaping.
- `public/renderer/app.js`: keeps playlist detail state, request flow, scrolling, click handling, queue loading, artist opening, render-limit growth, and animation behavior in the renderer app; delegates only detail markup to `window.MineradioPlaylistPanel`.
- `tests/renderer-playlist-panel.test.js`: protects inactive detail behavior, loading state, Netease/QQ cover sizing, row rendering, song cover sizing, artist fallback, load-more, complete progress, empty detail, and default escaping.
- `tests/renderer-contract.test.js`: verifies `MineradioPlaylistPanel` exports `renderPlaylistPanelDetailHtml` and that `renderer/app.js` wires to it.

## Verification

- RED before implementation:
  - `npm run test:renderer -- --test-name-pattern "playlist panel detail|playlist panel markup"` failed because `MineradioPlaylistPanel.renderPlaylistPanelDetailHtml` did not exist, and app wiring still used inline detail markup.
- GREEN after implementation:
  - `npm run test:renderer -- --test-name-pattern "playlist panel detail|playlist panel markup"`: 75/75 pass.
  - `npm run test:renderer`: 75/75 pass.
  - `npm test`: 653/653 pass.
  - `npm run coverage`: 653/653 pass; all included production files line coverage `100.00%`, including `public/renderer/core/playlist-panel.js`.
  - `git diff --check`: pass.

## Guardrails

- User wants renderer refactors in this order: add tests against current behavior, refactor/split, then rerun the original tests.
- Do not convert renderer scripts to ESM yet.
- Do not move UI styling or visible behavior inside this refactor slice.
- Do not run `npm test` and `npm run coverage` in parallel. Update patch route tests share `public/.mineradio-patch-test.txt`.
- Keep package/build verification separate unless the user asks for a build.

## Next Actions

1. Run independent read-only QA gate for the playlist detail helper slice.
2. If QA passes, commit with message `refactor: extract renderer playlist detail helper`.
3. Build a macOS package for the user to verify, because this batch touched visible playlist detail markup.
4. Next renderer candidates after user build verification:
   - Extract the next stateful renderer markup only after adding focused tests first.
   - Candidate areas: shelf/library markup or playlist panel DOM behavior tests around click/scroll/load-more.
   - Use the DOM harness for stateful renderer DOM behavior before splitting handlers with side effects.
