# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current behavior, macOS package usability, and the existing 100% production line-coverage gate.

## Current Status

- Branch: `feat/macos-preview`
- Latest committed renderer slices:
  - `7b34391 refactor: extract renderer stylesheet`
  - `a99b3f5 refactor: extract renderer script`
- Current local slice: renderer first-stage unit protection before splitting `public/renderer/app.js`.
- Local changes:
  - `package.json` expands `npm run test:renderer` to `tests/renderer-*.test.js` and includes `public/renderer/core/**/*.js` in the 100% line-coverage gate.
  - `public/renderer/core/api-client.js` characterizes the renderer `apiJson` wrapper and timeout/signal behavior.
  - `public/renderer/core/preferences.js` characterizes localStorage-backed preferences, playback quality labels, ranks, and fallbacks.
  - `public/renderer/core/update-state.js` characterizes update preview/download/patch state transitions and progress formatting.
  - `public/renderer/core/search-logic.js` characterizes search history, metadata text, provider intent, derivative detection, scoring, and merge behavior.
  - `public/renderer/core/player-queue.js` characterizes queue identity, insertion, current-index handling, provider labels, and restriction copy.
  - `public/renderer/core/lyrics-parser.js` characterizes LRC/YRC lyric parsing and duration finalization.
  - `tests/renderer-*.test.js` now covers the renderer contract plus the six pure-logic domains above.
- No visible UI behavior files are modified in this slice. The new `public/renderer/core/*.js` modules are not yet loaded by `public/index.html` or wired into `public/renderer/app.js`; they are a characterization/protection layer for the next split.

## Renderer State

- `public/index.html`: 849 lines.
- `public/styles/app.css`: 2172 lines.
- `public/renderer/app.js`: 24205 lines.
- Renderer still uses classic scripts, not `type="module"`, because many inline handlers rely on global function names.
- Current renderer tests protect:
  - `public/index.html`, `public/styles/app.css`, and `public/renderer/app.js` existence.
  - Electron package inclusion through `build.files` containing `public/**/*`.
  - Script order: `vendor/three.r128.min.js` -> `vendor/music-tempo.min.js` -> `vendor/gsap.min.js` -> DIY preload inline script, with `renderer/app.js` loaded last.
  - Inline `on*` handlers from both `public/index.html` and renderer-generated HTML strings in `public/renderer/app.js`.
  - Renderer classic-JS syntax through `vm.Script`.
  - Pure renderer behavior for API calls, preferences, update panel state, search, player queue, and lyric parsing.

## Guardrails

- User explicitly wants renderer refactors to follow this order:
  1. Add tests that pass against current behavior.
  2. Refactor/split renderer code.
  3. Re-run the original tests and require them to keep passing.
- Do not split renderer files before the relevant contract/unit tests are already green.
- Do not convert renderer scripts to ESM yet; global inline handlers must remain compatible.
- The new renderer core modules are CommonJS for Node tests. If they are loaded in the browser later, add a browser-compatible wrapper or bundling step before adding script tags.
- Do not run `npm test` and `npm run coverage` in parallel. Update patch route tests share `public/.mineradio-patch-test.txt`, so parallel full-suite commands can interfere with each other.
- Keep UI changes separate from test/refactor slices unless the user explicitly asks for visible UI work.

## Latest Verification

- Initial RED for this slice: `npm run test:renderer` failed with module-not-found errors for the planned `public/renderer/core/*` modules.
- `npm run test:renderer`: 29/29 pass.
- `npm test`: 607/607 pass.
- `npm run coverage`: 607/607 pass; all included files line coverage `100.00%`, including `public/renderer/core/**/*.js`.
- `git diff --check`: pass.
- QA subagent verdict: `PASS`. It noted one weak player-queue assertion; fixed by comparing the queued clone against the source search-result object.

## Next Actions

1. Commit the renderer first-stage unit protection slice after QA gate returns PASS.
2. Next renderer refactor should wire one low-risk core domain into `public/renderer/app.js` while keeping the existing tests green.
3. First candidate split: API client or preference/localStorage helpers. Preserve classic script/global-handler compatibility and re-run `npm run test:renderer`, `npm test`, and `npm run coverage`.
