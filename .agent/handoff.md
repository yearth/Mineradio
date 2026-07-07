# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current behavior, macOS package usability, and the existing 100% production line-coverage gate.

## Current Status

- Branch: `feat/macos-preview`
- Latest committed renderer slices:
  - `7b34391 refactor: extract renderer stylesheet`
  - `a99b3f5 refactor: extract renderer script`
- Latest committed renderer core slice:
  - `2e5e3a4 refactor: wire renderer player queue helpers`
- Current local slice: finish safe player-queue mutation wiring.
- Local changes:
  - `public/index.html` now loads `renderer/core/preferences.js`, `renderer/core/update-state.js`, `renderer/core/lyrics-parser.js`, `renderer/core/search-logic.js`, and `renderer/core/player-queue.js` before `renderer/app.js`.
  - `public/renderer/core/preferences.js` supports Node `module.exports` and browser classic-script global export as `window.MineradioPreferences`.
  - `public/renderer/core/update-state.js` supports Node/browser export as `window.MineradioUpdateState`; `formatUpdateBytes` was corrected to match the old `app.js` UI behavior (`1536 -> 2 KB`, GB support).
  - `public/renderer/core/lyrics-parser.js` supports Node/browser export as `window.MineradioLyricsParser`.
  - `public/renderer/core/search-logic.js` exports `window.MineradioSearchLogic` and now exposes `writeSearchHistory` for the renderer wrapper.
  - `public/renderer/core/player-queue.js` now supports Node `module.exports` and browser classic-script global export as `window.MineradioPlayerQueue`.
  - `public/renderer/core/player-queue.js` exposes `createPlayerQueueHelpers(deps)` so renderer code can inject `cloneSong` and preserve `hydrateCustomCover` semantics for queued song copies.
  - `public/renderer/app.js` keeps existing global wrapper function names for compatibility but delegates preferences, update formatting/state-start, lyrics parsing, search pure helpers, and the safe player-queue helpers to the core modules.
  - `public/renderer/core/player-queue.js` now exposes result metadata APIs: `queueSongWithResult`, `queueSongNextWithResult`, and `playSearchResultInQueueWithResult`.
  - `public/renderer/app.js` creates `playerQueueHelpers` with injected `cloneSong` and `songProviderKey`; wired player-queue helpers now include `queueItemKey`, `queueSong`, `queueSongNext`, `moveQueueIndexToTop`, `playSearchResult`, `playbackProviderLabel`, `playbackLoginProvider`, and `playbackRestrictionMessage`.
  - UI side effects still remain in `app.js`: `safeRenderQueuePanel`, `safeShelfRebuild`, search result hiding/input clearing, and `playQueueAt`.
  - `queueSong` preserves old no-op behavior: if the requested next song is already current, core returns `changed: false`, so app does not re-render/rebuild.
  - `playSearchResult` preserves the old existing-match behavior: matching an existing queue item moves it to the top and ultimately plays index `0`.
  - `tests/renderer-contract.test.js` adds a lightweight classic-script smoke test that executes core scripts from `public/index.html` before `renderer/app.js` and verifies every `window.Mineradio*` namespace referenced by the renderer exists before boot.
  - `tests/renderer-contract.test.js` also adds player-queue load-order/browser-global/delegation contracts.
  - `tests/renderer-player-queue.test.js` adds injected `cloneSong` coverage to protect renderer custom-cover hydration.
  - `tests/renderer-update-state.test.js` was corrected to characterize current UI byte formatting instead of the earlier core-only behavior.
- No visible UI behavior is intended to change. Player queue array/index mutations are now delegated to core; DOM/render/playback side effects stay in `app.js`.

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
  - Player-queue result metadata: `queueSongWithResult`/`queueSongNextWithResult` distinguish mutation vs no-op; `playSearchResultInQueueWithResult` records selection index, `changed`, and `matchedExisting`.
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

- RED checks for previous committed slice:
  - `renderer core scripts expose required browser globals before app boot` failed because `MineradioPlayerQueue` did not exist before `renderer/app.js`.
  - `renderer app wires player queue through the core player queue module` failed because `renderer/core/player-queue.js` was not loaded.
  - `queue helpers can inject cloneSong to preserve renderer cover hydration` failed because `createPlayerQueueHelpers` did not exist.
- RED checks for current local slice:
  - `queueSong result metadata distinguishes queue mutations from current-song noops` first failed because `queueSongWithResult` did not exist.
  - `playSearchResultInQueue result metadata preserves selection and mutation details` first failed because `playSearchResultInQueueWithResult` did not exist.
  - The first implementation exposed a mismatch in existing-match current index; it was corrected to preserve legacy `index: 0` behavior.
- `npm run test:renderer`: 39/39 pass.
- `npm test`: 617/617 pass.
- `npm run coverage`: 617/617 pass; all included files line coverage `100.00%`, including all renderer core modules.
- `git diff --check`: pass.
- QA subagent verdict for current local slice: `PASS`. It reran `npm run test:renderer`, `npm test`, `npm run coverage`, and `git diff --check`; it noted no blocking issues and the residual risk that no real Electron UI launch was run for this slice.

## Next Actions

1. If QA returns PASS, commit the safe player-queue mutation wiring batch.
2. Next renderer refactor candidate: extract a small renderer DOM adapter/test harness so more of `app.js` can be executed in tests instead of only syntax/static contracts.
3. After a DOM harness exists, consider moving search UI coordination or mini queue panel rendering in small tested slices.
4. Preserve classic script/global-handler compatibility and re-run `npm run test:renderer`, `npm test`, and `npm run coverage`.
