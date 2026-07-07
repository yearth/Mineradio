# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current behavior, macOS package usability, and the existing 100% production line-coverage gate.

## Current Status

- Branch: `feat/macos-preview`
- Latest committed renderer slices:
  - `7b34391 refactor: extract renderer stylesheet`
  - `a99b3f5 refactor: extract renderer script`
- Current local slice: renderer core wiring batch after API client.
- Local changes:
  - `public/index.html` now loads `renderer/core/preferences.js`, `renderer/core/update-state.js`, `renderer/core/lyrics-parser.js`, and `renderer/core/search-logic.js` before `renderer/app.js`.
  - `public/renderer/core/preferences.js` supports Node `module.exports` and browser classic-script global export as `window.MineradioPreferences`.
  - `public/renderer/core/update-state.js` supports Node/browser export as `window.MineradioUpdateState`; `formatUpdateBytes` was corrected to match the old `app.js` UI behavior (`1536 -> 2 KB`, GB support).
  - `public/renderer/core/lyrics-parser.js` supports Node/browser export as `window.MineradioLyricsParser`.
  - `public/renderer/core/search-logic.js` exports `window.MineradioSearchLogic` and now exposes `writeSearchHistory` for the renderer wrapper.
  - `public/renderer/app.js` keeps existing global wrapper function names for compatibility but delegates preferences, update formatting/state-start, lyrics parsing, and search pure helpers to the core modules.
  - `tests/renderer-contract.test.js` adds wiring contracts for preferences, update-state, lyrics-parser, and search-logic load order/global exposure/delegation.
  - `tests/renderer-update-state.test.js` was corrected to characterize current UI byte formatting instead of the earlier core-only behavior.
- No visible UI behavior is intended to change. Player queue wiring is intentionally not done in this slice because `app.js` `cloneSong` applies `hydrateCustomCover`, while `public/renderer/core/player-queue.js` is still dependency-free; direct wiring would risk custom-cover regressions.

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
  - Browser wiring for API client, preferences, update-state, lyrics-parser, and search-logic: each loaded before `renderer/app.js`, exposes its `window.Mineradio*` namespace, and is used by `app.js`.

## Guardrails

- User explicitly wants renderer refactors to follow this order:
  1. Add tests that pass against current behavior.
  2. Refactor/split renderer code.
  3. Re-run the original tests and require them to keep passing.
- Do not split renderer files before the relevant contract/unit tests are already green.
- Do not convert renderer scripts to ESM yet; global inline handlers must remain compatible.
- Any renderer core module loaded by `index.html` must support browser classic-script execution. API client, preferences, update-state, lyrics-parser, and search-logic now do. `player-queue.js` is not loaded yet and must not be wired until custom-cover hydration semantics are preserved.
- Do not run `npm test` and `npm run coverage` in parallel. Update patch route tests share `public/.mineradio-patch-test.txt`, so parallel full-suite commands can interfere with each other.
- Keep UI changes separate from test/refactor slices unless the user explicitly asks for visible UI work.

## Latest Verification

- RED checks for this slice: each new contract first failed at the corresponding `renderer/core/*.js must be loaded` assertion for preferences, update-state, lyrics-parser, and search-logic.
- `npm run test:renderer`: 34/34 pass.
- `npm test`: 612/612 pass.
- `npm run coverage`: 612/612 pass; all included files line coverage `100.00%`, including all renderer core modules.
- `git diff --check`: pass.
- QA subagent verdict for this slice: `PASS`. It reran `npm run test:renderer` and `npm test && npm run coverage && git diff --check`; noted player queue deferral is reasonable because custom-cover hydration is not yet modeled by the core queue helper.

## Next Actions

1. If QA returns PASS, commit the renderer core wiring batch.
2. Next renderer refactor candidate: player queue, but first update `public/renderer/core/player-queue.js` to preserve `cloneSong` custom-cover hydration, likely via dependency injection or a renderer wrapper that calls `hydrateCustomCover`.
3. Optional small cleanup before/with player work: remove or relocate now-unused search scoring helper definitions that remain in `app.js` after delegation, but only with tests green.
4. Preserve classic script/global-handler compatibility and re-run `npm run test:renderer`, `npm test`, and `npm run coverage`.
