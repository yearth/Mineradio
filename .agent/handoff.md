# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current app behavior and macOS preview usability.

## Current Status

- Branch: `feat/macos-preview`
- Worktree: has uncommitted coverage gate slice after `2bd34d2 refactor: extract server listener startup`.
- Current phase: Stage 2, "server 外壳拆分".
- Stage 1 is complete: TypeScript tooling, server skeleton, structure guard test, and roadmap are committed.
- Stage 2 first slice is committed: `server/router.ts` describes the legacy API surface by owner, and `tests/server-router.test.js` checks it against actual `server.js` path dispatch.
- Stage 2 second slice is complete: `server/http-utils.ts` provides request URL construction, listen gating, and startup banner lines; `server.js` now uses the compiled helper.
- Stage 2 third slice is committed: `server/test-support/runtime.ts` describes the legacy `module.exports.__test` surface by owner and legacy export order; `tests/server-test-runtime.test.js` compares it to the actual `server.js` test export block.
- Stage 2 fourth slice is committed: `server/static-utils.ts` extracts static content type and static file path resolution; `server.js` uses it from compiled TS.
- Stage 2 fifth slice is committed: `listenIfNeeded` in `server/http-utils.ts` centralizes listener gating and startup banner logging; `server.js` delegates startup listening to it.
- Coverage gate slice is complete: `npm run coverage` enforces 100% production-code line coverage with Node's built-in test coverage, excluding `tests/**` from the report.
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

Stage 2 test runtime guard slice:

- Initial RED: `npm run build:ts && node --test tests/server-test-runtime.test.js` failed because `serverTestRuntimeGroups` and `serverTestRuntimeExportNames` were not exported.
- First GREEN exposed an ordering mismatch against the real `server.js` `module.exports.__test` block; fixed by keeping `serverTestRuntimeExportNames` in legacy order while preserving owner groups.
- `npm run build:ts && node --test tests/server-test-runtime.test.js tests/project-structure.test.js`: passed, 4 tests.
- `npm run typecheck`: passed.
- `node --test tests/music-routes.test.js tests/update-routes.test.js`: passed, 172 tests.
- `npm test`: passed, 230 tests.
- QA subagent review: `PASS`. Read-only verification by QA included `npm run typecheck` and `npm run build:ts && node --test tests/server-test-runtime.test.js tests/project-structure.test.js`.

Stage 2 static utility slice:

- Initial RED: `npm run build:ts && node --test tests/server-static-utils.test.js` failed because `server-dist/server/static-utils` did not exist.
- First GREEN attempt hit TS compile error for `node:path` because current TS setup has no Node type declarations; fixed without adding dependencies by using a local `require('path')` declaration inside `server/static-utils.ts`.
- `npm run build:ts && node --test tests/server-static-utils.test.js tests/project-structure.test.js tests/music-routes.test.js`: passed, 148 tests.
- `npm run typecheck`: passed.
- `node --check server.js`: passed.
- `npm test`: passed, 234 tests.
- QA subagent review: `PASS`. Read-only verification by QA included `npm run typecheck`, `node --check server.js`, `npm run build:ts && node --test tests/server-static-utils.test.js tests/project-structure.test.js tests/music-routes.test.js`, and `npm test`.

Stage 2 listener composition slice:

- Initial RED: `npm run build:ts && node --test tests/server-http-utils.test.js` failed because `listenIfNeeded` was not exported.
- `listenIfNeeded` was added to `server/http-utils.ts` and `server.js` now calls it instead of hand-writing the `shouldAutoListen`/`server.listen`/banner block.
- `npm run build:ts && node --test tests/server-http-utils.test.js tests/project-structure.test.js tests/music-routes.test.js tests/update-routes.test.js`: passed, 180 tests.
- `npm run typecheck`: passed.
- `node --check server.js`: passed.
- `npm test`: passed, 236 tests.
- QA subagent review: `PASS`. Read-only verification by QA included `npm run typecheck`, `node --check server.js`, `npm run build:ts && node --test tests/server-http-utils.test.js tests/project-structure.test.js tests/music-routes.test.js tests/update-routes.test.js`, and `npm test`.

Coverage gate slice:

- Initial RED: `npm run build:ts && node --test tests/project-structure.test.js` failed because `packageJson.scripts.coverage` was undefined.
- Added `coverage` script in `package.json`: builds TS, runs `node --test --experimental-test-coverage`, includes production files (`server.js`, `dj-analyzer.js`, `lib/**/*.js`, `server-dist/server/**/*.js`), excludes `tests/**`, and sets `--test-coverage-lines=100`.
- `tests/project-structure.test.js` now guards the coverage script shape, `--experimental-test-coverage`, `--test-coverage-lines=100`, and `--test-coverage-exclude='tests/**'`.
- `npm run build:ts && node --test tests/project-structure.test.js`: passed, 2 tests.
- First QA subagent review: `NEEDS WORK` because `/api/weather/radio uses a generic label for unknown weather codes` asserted the time-dependent `body.radio.title` while `buildWeatherMood` defaults to `new Date()`.
- Fixed the flaky route test minimally by removing only the time-dependent `body.radio.title` assertion; direct weather mood title behavior remains covered by `tests/weather-mood.test.js` with fixed dates.
- `npm run build:ts && node --test tests/music-routes.test.js tests/project-structure.test.js`: passed, 144 tests after the flaky assertion fix.
- `npm test`: passed, 236 tests after the flaky assertion fix.
- `npm run coverage`: passed, 236 tests after the flaky assertion fix; production-code line coverage `100.00%`, branch coverage `67.66%`, function coverage `95.01%`.
- Final QA subagent review: `PASS`. Read-only verification by QA included `npm run coverage` and `npm test`, both passing 236 tests; generated `dist/` and `server-dist/` were not tracked or staged.

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
- Static utility: `server/static-utils.ts`
- Structure guard: `tests/project-structure.test.js`
- Router guard: `tests/server-router.test.js`
- HTTP utility guard: `tests/server-http-utils.test.js`
- Test runtime guard: `tests/server-test-runtime.test.js`
- Static utility guard: `tests/server-static-utils.test.js`
- TS config: `tsconfig.json`
- Build config: `package.json`
- Coverage gate: `npm run coverage`
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
   - Continue small behavior-neutral extraction around server creation or request handler composition.
   - Add/adjust a failing guard test first where possible.
   - Keep `server.js` as the public CommonJS export.
5. Validate after each slice:
   - targeted route tests first, especially `node --test tests/music-routes.test.js tests/update-routes.test.js`
   - `npm run typecheck`
   - `npm test`

## Guardrails

- Do not run `npm test` concurrently with coverage or another full test run; update patch tests share temporary public patch files and can race.
- `dist/` and `server-dist/` are generated and ignored.
- On a clean checkout, run `npm start`, `npm test`, or a build script so `npm run build:ts` creates `server-dist/` before `server.js` is loaded; direct `electron .` or direct `require('./server.js')` can fail before compilation.
- Mac DMG path when rebuilt: `dist/Mineradio-1.1.1-arm64.dmg`.
- App bundle path when rebuilt: `dist/mac-arm64/Mineradio.app`.
- User prefers Chinese reports and steady small steps.
