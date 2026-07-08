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
- Latest committed player queue slice:
  - `613c8dd refactor: delegate renderer queue mutations`
- Latest committed test harness slice:
  - `27c322d test: add renderer DOM harness`
- Current local slice: extract mini queue rendering helper into renderer core.
- Relevant committed context:
  - `public/index.html` now loads `renderer/core/preferences.js`, `renderer/core/update-state.js`, `renderer/core/lyrics-parser.js`, `renderer/core/search-logic.js`, and `renderer/core/player-queue.js` before `renderer/app.js`.
  - `public/renderer/core/preferences.js` supports Node `module.exports` and browser classic-script global export as `window.MineradioPreferences`.
  - `public/renderer/core/update-state.js` supports Node/browser export as `window.MineradioUpdateState`; `formatUpdateBytes` was corrected to match the old `app.js` UI behavior (`1536 -> 2 KB`, GB support).
  - `public/renderer/core/lyrics-parser.js` supports Node/browser export as `window.MineradioLyricsParser`.
  - `public/renderer/core/search-logic.js` exports `window.MineradioSearchLogic` and now exposes `writeSearchHistory` for the renderer wrapper.
  - `public/renderer/core/player-queue.js` now supports Node `module.exports` and browser classic-script global export as `window.MineradioPlayerQueue`.
  - `public/renderer/core/player-queue.js` exposes `createPlayerQueueHelpers(deps)` so renderer code can inject `cloneSong` and preserve `hydrateCustomCover` semantics for queued song copies.
  - `public/renderer/app.js` keeps existing global wrapper function names for compatibility but delegates preferences, update formatting/state-start, lyrics parsing, search pure helpers, and the safe player-queue helpers to the core modules.
- Local changes:
  - `public/renderer/core/mini-queue.js` is a new classic-script/Node-exported renderer core helper for mini queue count text, empty-state markup, and item markup.
  - `public/index.html` now loads `renderer/core/mini-queue.js` before `renderer/app.js`.
  - `public/renderer/app.js` keeps `renderMiniQueuePanel` responsible for DOM updates, animation, and scrolling, but delegates count/list/empty markup to `window.MineradioMiniQueue`.
  - `tests/renderer-mini-queue.test.js` protects mini queue count text, empty copy, current item class, cover fallback, inline handler markup, and HTML escaping including default dependencies.
  - `tests/renderer-contract.test.js` now verifies `MineradioMiniQueue` is loaded before app boot and referenced by `app.js`.
- No visible UI behavior is intended to change. Current slice only moves mini queue markup/count generation out of `app.js` into a tested core helper.

## Renderer State

- `public/index.html`: 854 lines.
- `public/styles/app.css`: 2172 lines.
- `public/renderer/app.js`: reduced further by delegating preferences/update/lyrics/search pure helpers, player queue helpers, and mini queue markup/count rendering.
- Renderer still uses classic scripts, not `type="module"`, because many inline handlers rely on global function names.
- Current renderer tests protect:
  - `public/index.html`, `public/styles/app.css`, and `public/renderer/app.js` existence.
  - Electron package inclusion through `build.files` containing `public/**/*`.
  - Script order: `vendor/three.r128.min.js` -> `vendor/music-tempo.min.js` -> `vendor/gsap.min.js` -> DIY preload inline script, with `renderer/app.js` loaded last.
  - Inline `on*` handlers from both `public/index.html` and renderer-generated HTML strings in `public/renderer/app.js`.
  - Renderer classic-JS syntax through `vm.Script`.
  - Pure renderer behavior for API calls, preferences, update panel state, search, player queue, and lyric parsing.
  - Browser wiring for API client, preferences, update-state, lyrics-parser, search-logic, player-queue, and mini-queue: each loaded before `renderer/app.js`, exposes its `window.Mineradio*` namespace, and is used by `app.js`.
  - Player-queue result metadata: `queueSongWithResult`/`queueSongNextWithResult` distinguish mutation vs no-op; `playSearchResultInQueueWithResult` records selection index, `changed`, and `matchedExisting`.
  - Mini queue markup/count helper behavior: empty/count labels, current item class, image/fallback markup, inline queue handlers, and escaping.
  - Test-only DOM harness behavior: id/class lookup, compound/descendant/comma selectors, nested text parsing/aggregation, DOM event defaults and propagation controls, `closest`/`contains`, localStorage, and deterministic animation-frame flushing.
  - Classic-script smoke: the core scripts listed in `public/index.html` can execute in order before `renderer/app.js`, and all `window.Mineradio*` namespaces referenced by `app.js` are available.

## Guardrails

- User explicitly wants renderer refactors to follow this order:
  1. Add tests that pass against current behavior.
  2. Refactor/split renderer code.
  3. Re-run the original tests and require them to keep passing.
- Do not split renderer files before the relevant contract/unit tests are already green.
- Do not convert renderer scripts to ESM yet; global inline handlers must remain compatible.
- Any renderer core module loaded by `index.html` must support browser classic-script execution. API client, preferences, update-state, lyrics-parser, search-logic, player-queue, and mini-queue now do.
- Do not run `npm test` and `npm run coverage` in parallel. Update patch route tests share `public/.mineradio-patch-test.txt`, so parallel full-suite commands can interfere with each other.
- Keep UI changes separate from test/refactor slices unless the user explicitly asks for visible UI work.

## Latest Verification

- RED checks for previous renderer player-queue slices:
  - `renderer core scripts expose required browser globals before app boot` failed because `MineradioPlayerQueue` did not exist before `renderer/app.js`.
  - `renderer app wires player queue through the core player queue module` failed because `renderer/core/player-queue.js` was not loaded.
  - `queue helpers can inject cloneSong to preserve renderer cover hydration` failed because `createPlayerQueueHelpers` did not exist.
  - `queueSong result metadata distinguishes queue mutations from current-song noops` first failed because `queueSongWithResult` did not exist.
  - `playSearchResultInQueue result metadata preserves selection and mutation details` first failed because `playSearchResultInQueueWithResult` did not exist.
  - The first implementation exposed a mismatch in existing-match current index; it was corrected to preserve legacy `index: 0` behavior.
- RED checks for previous DOM harness slice:
  - `renderer-dom-harness.test.js` first failed because `tests/helpers/renderer-dom-harness` did not exist.
  - `renderer DOM harness events follow browser defaults for bubbling and canceling` failed until `Event` defaults were corrected to browser-like `bubbles: false` and `cancelable: false`.
  - First final QA returned `NEEDS WORK` because closing tags leaked into parent `textContent`; a new nested-text regression test reproduced it, then `parseHtmlInto` and aggregated `textContent` were fixed.
- RED checks for current local slice:
  - `renderer-mini-queue.test.js` first failed because `public/renderer/core/mini-queue.js` did not exist.
  - `renderer app wires mini queue rendering through the core mini queue module` and the global smoke test failed until `index.html` loaded `renderer/core/mini-queue.js` and `app.js` delegated to `window.MineradioMiniQueue`.
  - First coverage run failed at `99.92%` because fallback HTML escaping in `mini-queue.js` was uncovered; `mini queue item markup escapes text with default dependencies` fixed it.
- `npm run test:renderer`: 51/51 pass.
- `npm test`: 629/629 pass.
- `npm run coverage`: 629/629 pass; all included production files line coverage `100.00%`, including `public/renderer/core/mini-queue.js`.
- `git diff --check`: pass.
- QA subagent verdict for current local slice: `PASS`. It reran `git diff --check`, `npm run test:renderer`, `npm test`, and `npm run coverage`; it noted no blocking issues.

## Next Actions

1. If QA returns PASS, commit the mini queue core extraction batch.
2. Next renderer refactor candidate: characterize and extract search-result row markup or queue panel row markup in similarly small tested slices.
3. Consider using the DOM harness for stateful renderer DOM behavior once more markup helpers are isolated.
4. Preserve classic script/global-handler compatibility and re-run `npm run test:renderer`, `npm test`, and `npm run coverage`.
