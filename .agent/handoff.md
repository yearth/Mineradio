# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current behavior, macOS package usability, and the existing 100% production line-coverage gate.

## Current Status

- Branch: `feat/macos-preview`.
- Current local slice: published the macOS preview/refactor fork to the user's personal GitHub repository.
- Personal GitHub repository: `https://github.com/yearth/Mineradio`.
- Remotes:
  - `origin`: original upstream clone, `https://github.com/XxHuberrr/Mineradio.git`.
  - `personal`: user's personal repository, `https://github.com/yearth/Mineradio.git`.
- Remote branches pushed:
  - `personal/main`: current refactor state for repository homepage/default branch.
  - `personal/feat/macos-preview`: active development branch.
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
  - `6263717 refactor: extract renderer playlist detail helper`
- Relevant architecture state:
  - `public/index.html` loads renderer core classic scripts before `renderer/app.js`.
  - Renderer remains classic-script based, not ESM, because existing inline handlers depend on global function names.
  - `public/renderer/app.js` still owns DOM state/effects but delegates tested pure helpers for API, preferences, update state, lyrics, search logic, player queue, mini queue, search result markup, queue panel markup, podcast result markup, playlist panel markup/detail markup/click action recognition, and my-podcast collection/radio panel markup.

## Current Local Changes

- README has been rewritten for the personal fork to explain macOS preview status and the main differences from the original Mineradio project.
- `.agent/handoff.md` records the personal GitHub remote and pushed branches.

## Verification

- RED before implementation:
  - `npm test -- --test-name-pattern "playlist panel click resolver"` failed because `MineradioPlaylistPanel.resolvePlaylistPanelClickAction` did not exist.
- GREEN after implementation:
  - `node --test tests/renderer-playlist-panel.test.js --test-name-pattern "playlist panel click resolver"`: 8/8 pass.
  - `npm test`: 655/655 pass.
  - `npm run coverage`: 655/655 pass; all included production files line coverage `100.00%`, including `public/renderer/core/playlist-panel.js`.
  - `git diff --check`: pass.
- QA gate:
  - Read-only subagent result: `PASS`.
  - QA noted that direct `stopPropagation` observation would strengthen the tests; the DOM harness test now asserts outer listeners are not reached for blocking detail actions.
- Publishing:
  - `a96dc15 docs: describe macos refactor fork` committed the README update.
  - Created public repo `yearth/Mineradio`.
  - Pushed current refactor state to `personal/main` and `personal/feat/macos-preview`.
  - Pushed existing tags through `v1.1.1` to `personal`.

## Guardrails

- User wants renderer refactors in this order: add tests against current behavior, refactor/split, then rerun the original tests.
- Do not convert renderer scripts to ESM yet.
- Do not move UI styling or visible behavior inside this refactor slice.
- Do not run `npm test` and `npm run coverage` in parallel. Update patch route tests share `public/.mineradio-patch-test.txt`.
- Keep package/build verification separate unless the user asks for a build.

## Next Actions

1. Commit and push this handoff update to `personal/main` and `personal/feat/macos-preview`.
2. Next renderer candidates:
   - Continue renderer TDD before splitting handlers with side effects.
   - Candidate areas: playlist panel scroll/load-more state helpers, shelf/library markup, or podcast-list delegated click recognition.
