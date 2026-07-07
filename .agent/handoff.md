# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current behavior, macOS package usability, and the existing 100% production line-coverage gate.

## Current Status

- Branch: `feat/macos-preview`
- Latest committed renderer slices:
  - `7b34391 refactor: extract renderer stylesheet`
  - `a99b3f5 refactor: extract renderer script`
- Current local slice: renderer player-queue core wiring batch.
- Local changes:
  - `public/index.html` now loads `renderer/core/preferences.js`, `renderer/core/update-state.js`, `renderer/core/lyrics-parser.js`, `renderer/core/search-logic.js`, and `renderer/core/player-queue.js` before `renderer/app.js`.
  - `public/renderer/core/preferences.js` supports Node `module.exports` and browser classic-script global export as `window.MineradioPreferences`.
  - `public/renderer/core/update-state.js` supports Node/browser export as `window.MineradioUpdateState`; `formatUpdateBytes` was corrected to match the old `app.js` UI behavior (`1536 -> 2 KB`, GB support).
  - `public/renderer/core/lyrics-parser.js` supports Node/browser export as `window.MineradioLyricsParser`.
  - `public/renderer/core/search-logic.js` exports `window.MineradioSearchLogic` and now exposes `writeSearchHistory` for the renderer wrapper.
  - `public/renderer/core/player-queue.js` now supports Node `module.exports` and browser classic-script global export as `window.MineradioPlayerQueue`.
  - `public/renderer/core/player-queue.js` exposes `createPlayerQueueHelpers(deps)` so renderer code can inject `cloneSong` and preserve `hydrateCustomCover` semantics for queued song copies.
  - `public/renderer/app.js` keeps existing global wrapper function names for compatibility but delegates preferences, update formatting/state-start, lyrics parsing, search pure helpers, and the safe player-queue helpers to the core modules.
  - `public/renderer/app.js` creates `playerQueueHelpers` with injected `cloneSong` and `songProviderKey`; currently wired safe helpers are `queueItemKey`, `moveQueueIndexToTop`, `playbackProviderLabel`, `playbackLoginProvider`, and `playbackRestrictionMessage`.
  - `queueSong` and `playSearchResult` intentionally remain in `app.js` for now because they also coordinate UI refresh/search-panel side effects; moving them should be a later, explicitly tested slice.
  - `tests/renderer-contract.test.js` adds a lightweight classic-script smoke test that executes core scripts from `public/index.html` before `renderer/app.js` and verifies every `window.Mineradio*` namespace referenced by the renderer exists before boot.
  - `tests/renderer-contract.test.js` also adds player-queue load-order/browser-global/delegation contracts.
  - `tests/renderer-player-queue.test.js` adds injected `cloneSong` coverage to protect renderer custom-cover hydration.
  - `tests/renderer-update-state.test.js` was corrected to characterize current UI byte formatting instead of the earlier core-only behavior.
- No visible UI behavior is intended to change. Player queue wiring is deliberately partial: pure helpers are wired, while UI-timed queue mutations remain in `app.js`.

## Renderer State

- `public/index.html`: 853 lines.
- `public/styles/app.css`: 2172 lines.
- `public/renderer/app.js`: reduced further by delegating preferences/update/lyrics/search pure helpers.
- Renderer still uses classic scripts, not `type="module"`, because many inline handlers rely on global function names.
- Current renderer tests protect:
  - `public/index.html`, `public/styles/app.css`, and `public/renderer/app.js` existence.
  - Electron package inclusion through `build.files` containing `public/**/*`.
  - Script order: `vendor/three.r128.min.js` -> `vendor/music-tempo.min.js` -> `vendor/gsap.min.js` -> DIY preload inline script, with `renderer/app.js` loaded last.
  - Inline `on*` handlers from both `public/index.html` and renderer-generated HTML strings in `public/renderer/app.js`.
  - Renderer classic-JS syntax through `vm.Script`.
  - Pure renderer behavior for API calls, preferences, update panel state, search, player queue, and lyric parsing.
  - Browser wiring for API client, preferences, update-state, lyrics-parser, search-logic, and player-queue: each loaded before `renderer/app.js`, exposes its `window.Mineradio*` namespace, and is used by `app.js`.
  - Classic-script smoke: the core scripts listed in `public/index.html` can execute in order before `renderer/app.js`, and all `window.Mineradio*` namespaces referenced by `app.js` are available.

## Guardrails

- User explicitly wants renderer refactors to follow this order:
  1. Add tests that pass against current behavior.
  2. Refactor/split renderer code.
  3. Re-run the original tests and require them to keep passing.
- Do not split renderer files before the relevant contract/unit tests are already green.
- Do not convert renderer scripts to ESM yet; global inline handlers must remain compatible.
- Any renderer core module loaded by `index.html` must support browser classic-script execution. API client, preferences, update-state, lyrics-parser, search-logic, and player-queue now do.
- Do not run `npm test` and `npm run coverage` in parallel. Update patch route tests share `public/.mineradio-patch-test.txt`, so parallel full-suite commands can interfere with each other.
- Keep UI changes separate from test/refactor slices unless the user explicitly asks for visible UI work.

## Latest Verification

- RED checks for this slice:
  - `renderer core scripts expose required browser globals before app boot` failed because `MineradioPlayerQueue` did not exist before `renderer/app.js`.
  - `renderer app wires player queue through the core player queue module` failed because `renderer/core/player-queue.js` was not loaded.
  - `queue helpers can inject cloneSong to preserve renderer cover hydration` failed because `createPlayerQueueHelpers` did not exist.
- `npm run test:renderer`: 37/37 pass.
- `npm test`: 615/615 pass.
- `npm run coverage`: 615/615 pass; all included files line coverage `100.00%`, including all renderer core modules.
- `git diff --check`: pass.
- QA subagent verdict for this slice: `PASS`. It reran `npm run test:renderer`, `npm test`, and `git diff --check`; it noted no blocking issues and called out that the remaining risk is no real Electron UI launch in this slice.

## Next Actions

1. If QA returns PASS, commit the player-queue core wiring batch.
2. Next renderer refactor candidate: finish the remaining player queue extraction by characterizing `queueSong` and `playSearchResult` UI side effects first, then move only if the old tests still pass.
3. Optional next candidate after queue: extract a small renderer DOM adapter/test harness so more of `app.js` can be executed in tests instead of only syntax/static contracts.
4. Preserve classic script/global-handler compatibility and re-run `npm run test:renderer`, `npm test`, and `npm run coverage`.
