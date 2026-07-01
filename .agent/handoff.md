# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current app behavior and macOS preview usability.

## Current Status

- Branch: `feat/macos-preview`
- Worktree: expected clean after `refactor: extract server http shell helpers`.
- Current phase: Stage 2, "server 外壳拆分".
- Stage 1 is complete: TypeScript tooling, server skeleton, structure guard test, and roadmap are committed.
- Stage 2 first slice is committed: `server/router.ts` describes the legacy API surface by owner, and `tests/server-router.test.js` checks it against actual `server.js` path dispatch.
- Stage 2 second slice is complete: `server/http-utils.ts` provides request URL construction, listen gating, and startup banner lines; `server.js` now uses the compiled helper.
- User explicitly asked to keep handoff current to avoid context-compression drift.

## Latest Committed Work

- Commit: `2bbea8b chore: add ts refactor foundation`
- Added TypeScript dev dependency and scripts:
  - `npm run typecheck` -> `tsc --noEmit`
  - `npm run build:ts` -> `tsc`
  - `build:mac`, `build:mac:dir`, `build:win`, and `build:win:dir` now run `npm run build:ts` first.
- Added `tsconfig.json`, compiling only `server/**/*.ts` and `shared/**/*.ts` into ignored `server-dist/`.
- Added server skeleton:
  - `server/index.ts`
  - `server/router.ts`
  - `server/test-support/runtime.ts`
- Added structural guard test:
  - `tests/project-structure.test.js`
  - Guards TS scripts, TS skeleton files, `package.json main === "desktop/main.js"`, `server.js` packaging, `server-dist/**/*` packaging, and `.gitignore` keeping `server-dist/` untracked.
- Added roadmap:
  - `docs/superpowers/plans/2026-07-01-mineradio-refactor-roadmap.md`
- `package-lock.json` TypeScript tarball was manually corrected to public npm registry metadata after QA flagged the local/internal registry entry.

## Verification Snapshot

After Stage 1 and QA fixes:

- `node --test tests/project-structure.test.js`: passed, 2 tests.
- `npm run typecheck`: passed.
- `npm run build:ts`: passed.
- `npm test`: passed, 222 tests.
- `npm run build:mac`: passed.
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Mineradio.app`: passed.
- `hdiutil verify dist/Mineradio-1.1.1-arm64.dmg`: passed.
- QA subagent first pass: `NEEDS WORK` for lockfile registry plus missing guard assertions.
- QA subagent second pass: `PASS`.

Stage 2 route-descriptor slice:

- `npm run build:ts && node --test tests/server-router.test.js tests/project-structure.test.js`: passed, 4 tests.
- `npm run typecheck`: passed.
- `node --test tests/music-routes.test.js tests/update-routes.test.js`: passed, 172 tests.
- `npm test`: passed, 224 tests.
- `npm run build:mac`: passed.
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Mineradio.app`: passed.
- `hdiutil verify dist/Mineradio-1.1.1-arm64.dmg`: passed.
- QA subagent review for this slice: `PASS`.

Stage 2 HTTP utility slice:

- Initial RED: `npm run build:ts && node --test tests/server-http-utils.test.js` failed because `server-dist/server/http-utils` did not exist.
- `npm run build:ts && node --test tests/server-http-utils.test.js tests/project-structure.test.js`: passed, 6 tests.
- `npm run typecheck`: passed.
- `node --test tests/music-routes.test.js tests/update-routes.test.js`: passed, 172 tests.
- `node --check server.js`: passed.
- `npm test`: passed, 228 tests.
- `npm run build:mac`: passed.
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Mineradio.app`: passed.
- `hdiutil verify dist/Mineradio-1.1.1-arm64.dmg`: passed.
- QA subagent first pass: `PASS` with one non-blocking URL coercion note.
- URL coercion note was fixed: `createRequestUrl(undefined, port)` now preserves legacy `new URL(undefined, base)` behavior and yields `/undefined`.
- Final QA subagent review: `PASS`. Read-only verification by QA included `npm run typecheck`, `node --check server.js`, and `node --test tests/server-http-utils.test.js tests/project-structure.test.js`.

## Decisions

- Do not introduce Nest now. The project needs typed module boundaries, not a heavy backend framework.
- Use TypeScript incrementally. JS and TS may coexist during migration.
- Preserve legacy runtime entrypoints until explicitly migrated:
  - `package.json main` remains `desktop/main.js`.
  - root `server.js` remains packaged and required by current Electron flow.
- Keep `server-dist/` ignored in git but included in electron-builder files for future TS output.
- Do not refactor `public/index.html` yet; renderer is the highest-risk area.
- Do not alter API response shapes, IPC exposed object shapes, localStorage keys, or UI behavior during server shell extraction.
- Independent QA should be done by a read-only subagent before claiming non-trivial refactor work complete.

## Key Files

- Roadmap: `docs/superpowers/plans/2026-07-01-mineradio-refactor-roadmap.md`
- Legacy server: `server.js`
- TS skeleton: `server/index.ts`, `server/router.ts`, `server/test-support/runtime.ts`
- HTTP utility: `server/http-utils.ts`
- Structure guard: `tests/project-structure.test.js`
- Router guard: `tests/server-router.test.js`
- HTTP utility guard: `tests/server-http-utils.test.js`
- TS config: `tsconfig.json`
- Build config: `package.json`
- Test-heavy route suites: `tests/music-routes.test.js`, `tests/update-routes.test.js`, `tests/beatmap-cache-routes.test.js`

## Next Session Bootstrap

1. `cd /Users/yearthmain/agent-playground/repos/Mineradio`
2. `git status --short --branch`
3. Read:
   - `.agent/handoff.md`
   - `docs/superpowers/plans/2026-07-01-mineradio-refactor-roadmap.md`
   - `tests/project-structure.test.js`
   - the bottom of `server.js` around server creation/listen/test exports.
4. Next implementation step for Stage 2:
   - Choose the next small behavior-neutral extraction around test-support runtime or server creation.
   - Add/adjust a failing guard test first where possible.
   - Keep `server.js` as the public CommonJS export.
5. Validate after each slice:
   - targeted route tests first, especially `node --test tests/music-routes.test.js tests/update-routes.test.js`
   - `npm run typecheck`
   - `npm test`

## Guardrails

- Do not run `npm test` concurrently with coverage or another full test run; update patch tests share temporary public patch files and can race.
- `dist/` and `server-dist/` are generated and ignored.
- Mac DMG path when rebuilt: `dist/Mineradio-1.1.1-arm64.dmg`.
- App bundle path when rebuilt: `dist/mac-arm64/Mineradio.app`.
- User prefers Chinese reports and steady small steps.
