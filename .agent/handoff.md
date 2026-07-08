# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current behavior, macOS package usability, and the existing 100% production line-coverage gate.

## Current Status

- Branch: `feat/macos-preview`.
- Current local slice: extract queue panel row/list markup into a renderer core helper.
- Latest committed renderer slices:
  - `7b34391 refactor: extract renderer stylesheet`
  - `a99b3f5 refactor: extract renderer script`
  - `27c322d test: add renderer DOM harness`
  - `633d5f9 refactor: extract renderer mini queue helper`
  - `bdecaae refactor: extract renderer search result helper`
- Relevant architecture state:
  - `public/index.html` loads renderer core classic scripts before `renderer/app.js`.
  - Renderer remains classic-script based, not ESM, because existing inline handlers depend on global function names.
  - `public/renderer/app.js` still owns DOM state/effects but delegates tested pure helpers for API, preferences, update state, lyrics, search logic, player queue, mini queue, search result markup, and now queue panel markup.

## Current Local Changes

- `public/renderer/core/queue-panel.js`: new classic-script/Node-exported helper as `window.MineradioQueuePanel`; renders queue empty-state markup and queue item/list markup.
- `public/index.html`: loads `renderer/core/queue-panel.js` before `renderer/app.js`.
- `public/renderer/app.js`: keeps `renderQueuePanel` responsible for DOM assignment, empty-queue tab switching, animation, and mini queue sync, but delegates queue panel markup to `window.MineradioQueuePanel`.
- `tests/renderer-queue-panel.test.js`: protects empty copy, current item class, cover/fallback markup, artist link, like/next/collect/remove actions, escaping, default dependency behavior, and list joining.
- `tests/renderer-contract.test.js`: verifies the new core global loads before `renderer/app.js`, verifies app wiring, and includes extracted helper inline handlers in the existing handler-definition contract.

## Verification

- RED before implementation:
  - `npm run test:renderer -- --test-name-pattern "queue panel"` failed because `public/renderer/core/queue-panel.js` did not exist.
  - `npm run test:renderer -- --test-name-pattern "queue panel rendering"` failed because `renderer/core/queue-panel.js` was not loaded and `MineradioQueuePanel` did not exist before `renderer/app.js`.
- GREEN after implementation:
  - `npm run test:renderer -- --test-name-pattern "queue panel"`: 60/60 pass.
  - `npm run test:renderer`: 60/60 pass.
  - `npm test`: 638/638 pass.
  - `npm run coverage`: 638/638 pass; all included production files line coverage `100.00%`, including `public/renderer/core/queue-panel.js`.
  - `git diff --check`: pass.

## Guardrails

- User wants renderer refactors in this order: add tests against current behavior, refactor/split, then rerun the original tests.
- Do not convert renderer scripts to ESM yet.
- Do not move UI styling or visible behavior inside this refactor slice.
- Do not run `npm test` and `npm run coverage` in parallel. Update patch route tests share `public/.mineradio-patch-test.txt`.
- Keep package/build verification separate unless the user asks for a build.

## Next Actions

1. Run independent read-only QA gate for the queue-panel slice.
2. If QA passes, commit with message `refactor: extract renderer queue panel helper`.
3. Next renderer candidates:
   - Extract podcast result/program markup after queue panel if the contract remains stable.
   - Use the DOM harness for stateful renderer DOM behavior before splitting handlers with side effects.
