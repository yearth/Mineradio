# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current behavior, macOS package usability, and the existing 100% production line-coverage gate.

## Current Status

- Branch: `feat/macos-preview`
- Latest committed renderer slices:
  - `7b34391 refactor: extract renderer stylesheet`
  - `a99b3f5 refactor: extract renderer script`
- Current local slice: renderer test protection before splitting `public/renderer/app.js`.
- Local changes:
  - `package.json` adds `npm run test:renderer`.
  - `tests/renderer-contract.test.js` adds renderer static contract tests.
- No production/UI behavior files are modified in this slice.

## Renderer State

- `public/index.html`: 849 lines.
- `public/styles/app.css`: 2172 lines.
- `public/renderer/app.js`: 24205 lines.
- Renderer still uses classic scripts, not `type="module"`, because many inline handlers rely on global function names.
- Current contract tests protect:
  - `public/index.html`, `public/styles/app.css`, and `public/renderer/app.js` existence.
  - Electron package inclusion through `build.files` containing `public/**/*`.
  - Script order: `vendor/three.r128.min.js` -> `vendor/music-tempo.min.js` -> `vendor/gsap.min.js` -> DIY preload inline script, with `renderer/app.js` loaded last.
  - Inline `on*` handlers from both `public/index.html` and renderer-generated HTML strings in `public/renderer/app.js`.
  - Renderer classic-JS syntax through `vm.Script`.

## Guardrails

- User explicitly wants renderer refactors to follow this order:
  1. Add tests that pass against current behavior.
  2. Refactor/split renderer code.
  3. Re-run the original tests and require them to keep passing.
- Do not split renderer files before the relevant contract/unit tests are already green.
- Do not convert renderer scripts to ESM yet; global inline handlers must remain compatible.
- Do not run `npm test` and `npm run coverage` in parallel. Update patch route tests share `public/.mineradio-patch-test.txt`, so parallel full-suite commands can interfere with each other.
- Keep UI changes separate from test/refactor slices unless the user explicitly asks for visible UI work.

## Latest Verification

- Initial RED for this slice: `npm run test:renderer` failed because the script did not exist.
- `npm run test:renderer`: 4/4 pass.
- `node --test tests/renderer-contract.test.js`: 4/4 pass.
- `npm test`: 582/582 pass.
- `npm run coverage`: 582/582 pass; all files line coverage `100.00%`.
- QA subagent review: initial `NEEDS WORK` because only `index.html` inline handlers were scanned. Fixed by also scanning renderer-generated handlers; repeat QA verdict `PASS`.

## Next Actions

1. Commit the renderer contract test slice.
2. Next renderer refactor should be a small split with tests already in place, preferably extracting low-risk runtime helpers before player/search/visualizer behavior.
3. First candidate split: preference/localStorage helpers or API client helpers from `public/renderer/app.js`, while preserving classic script order and re-running `npm run test:renderer`, `npm test`, and `npm run coverage`.
