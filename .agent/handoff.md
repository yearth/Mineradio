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
- Current local slice: add lightweight renderer DOM test harness.
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
  - `tests/helpers/renderer-dom-harness.js` is a lightweight test-only DOM harness, not a production renderer module and not a new dependency.
  - Harness capabilities currently covered: `document.getElementById`, `querySelector`, `querySelectorAll`, renderer-style compound/descendant/comma selectors, aggregated `textContent`, `classList`, `value`, basic attributes/dataset, `closest`, `contains`, browser-default `Event` plus explicit bubbling/canceling/propagation controls, `localStorage`, and deterministic `requestAnimationFrame` flushing.
  - `tests/renderer-dom-harness.test.js` protects those harness capabilities so future renderer DOM slices can use it safely.
  - `tests/renderer-contract.test.js` adds a lightweight classic-script smoke test that executes core scripts from `public/index.html` before `renderer/app.js` and verifies every `window.Mineradio*` namespace referenced by the renderer exists before boot.
  - `tests/renderer-contract.test.js` also adds player-queue load-order/browser-global/delegation contracts.
  - `tests/renderer-player-queue.test.js` adds injected `cloneSong` coverage to protect renderer custom-cover hydration.
  - `tests/renderer-update-state.test.js` was corrected to characterize current UI byte formatting instead of the earlier core-only behavior.
- No visible UI behavior is intended to change. Current slice only adds test infrastructure and removes the previous temporary A/B worktree.

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
  - Test-only DOM harness behavior: id/class lookup, compound/descendant/comma selectors, nested text parsing/aggregation, DOM event defaults and propagation controls, `closest`/`contains`, localStorage, and deterministic animation-frame flushing.
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

- RED checks for previous renderer player-queue slices:
  - `renderer core scripts expose required browser globals before app boot` failed because `MineradioPlayerQueue` did not exist before `renderer/app.js`.
  - `renderer app wires player queue through the core player queue module` failed because `renderer/core/player-queue.js` was not loaded.
  - `queue helpers can inject cloneSong to preserve renderer cover hydration` failed because `createPlayerQueueHelpers` did not exist.
  - `queueSong result metadata distinguishes queue mutations from current-song noops` first failed because `queueSongWithResult` did not exist.
  - `playSearchResultInQueue result metadata preserves selection and mutation details` first failed because `playSearchResultInQueueWithResult` did not exist.
  - The first implementation exposed a mismatch in existing-match current index; it was corrected to preserve legacy `index: 0` behavior.
- RED checks for current local slice:
  - `renderer-dom-harness.test.js` first failed because `tests/helpers/renderer-dom-harness` did not exist.
  - `renderer DOM harness events follow browser defaults for bubbling and canceling` failed until `Event` defaults were corrected to browser-like `bubbles: false` and `cancelable: false`.
  - First final QA returned `NEEDS WORK` because closing tags leaked into parent `textContent`; a new nested-text regression test reproduced it, then `parseHtmlInto` and aggregated `textContent` were fixed.
- First QA subagent verdict for current local slice: `NEEDS WORK`; it asked for renderer-style selector coverage and event cancellation/propagation controls. Those gaps were fixed before final verification.
- `npm run test:renderer`: 46/46 pass.
- `npm test`: 624/624 pass.
- `npm run coverage`: 624/624 pass; all included production files line coverage `100.00%`, including all renderer core modules.
- `git diff --check`: pass.
- Final QA subagent verdict for current local slice: `PASS`. It reran `git diff --check`, `npm run test:renderer`, `npm test`, and `npm run coverage`; it also confirmed nested closing tags no longer pollute parent `textContent`.

## Next Actions

1. If QA returns PASS, commit the renderer DOM harness batch.
2. Next renderer refactor candidate: use the DOM harness to characterize a very small mini queue/search panel DOM behavior before extracting renderer UI coordination.
3. Consider moving search UI coordination or mini queue panel rendering in small tested slices.
4. Preserve classic script/global-handler compatibility and re-run `npm run test:renderer`, `npm test`, and `npm run coverage`.
