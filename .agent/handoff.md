# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current app behavior and macOS preview usability.

## Current Status

- Branch: `feat/macos-preview`
- Worktree: check `git status --short --branch`; latest local slice is Stage 3 update download candidate service after `6f1eae3 refactor: extract update config service`.
- Current phase: Stage 3, "server 领域拆分".
- Stage 1 is complete: TypeScript tooling, server skeleton, structure guard test, and roadmap are committed.
- Stage 2 first slice is committed: `server/router.ts` describes the legacy API surface by owner, and `tests/server-router.test.js` checks it against actual `server.js` path dispatch.
- Stage 2 second slice is complete: `server/http-utils.ts` provides request URL construction, listen gating, and startup banner lines; `server.js` now uses the compiled helper.
- Stage 2 third slice is committed: `server/test-support/runtime.ts` describes the legacy `module.exports.__test` surface by owner and legacy export order; `tests/server-test-runtime.test.js` compares it to the actual `server.js` test export block.
- Stage 2 fourth slice is committed: `server/static-utils.ts` extracts static content type and static file path resolution; `server.js` uses it from compiled TS.
- Stage 2 fifth slice is committed: `listenIfNeeded` in `server/http-utils.ts` centralizes listener gating and startup banner logging; `server.js` delegates startup listening to it.
- Coverage gate slice is committed: `npm run coverage` enforces 100% production-code line coverage with Node's built-in test coverage, excluding `tests/**` from the report.
- Stage 2 sixth slice is complete: `createHttpServer` in `server/http-utils.ts` centralizes HTTP server factory composition; `server.js` now creates the server through that helper.
- Stage 2 seventh slice is complete: `createRequestHandler` in `server/http-utils.ts` centralizes URL parsing and passes `{ req, res, url, pathname }` into the legacy route chain.
- Stage 2 eighth slice is complete: `sendJson` in `server/http-utils.ts` centralizes legacy JSON response headers/body serialization; `server.js` imports it as `sendJSON`.
- Stage 2 ninth slice is complete: `serveStatic` in `server/static-utils.ts` centralizes legacy static file reads, MIME headers, and 404 responses; `server.js` delegates through a thin fs-bound wrapper.
- Stage 2 tenth slice is complete: `readRequestBody` in `server/http-utils.ts` centralizes legacy JSON/form/empty/error/oversize body parsing; `server.js` imports it from compiled TS.
- Stage 3 first slice is complete: `server/services/update-config.ts` owns GitHub repository parsing, update config merging, and mirror normalization; `server.js` imports the service while preserving `__test` compatibility exports.
- Stage 3 second slice is complete: `server/services/update-download-candidates.ts` owns mirror URL expansion and unique download candidate ordering; `server.js` keeps a thin `UPDATE_CONFIG`-bound wrapper.
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

Stage 2 HTTP server factory slice:

- Initial RED: `npm run build:ts && node --test tests/server-http-utils.test.js` failed because `createHttpServer` was not exported.
- Added `createHttpServer` to `server/http-utils.ts`; it delegates to an injected HTTP factory with the request handler.
- `server.js` now calls `createHttpServer({ createServer: http.createServer.bind(http), requestHandler })` instead of calling `http.createServer` inline.
- `npm run build:ts && node --test tests/server-http-utils.test.js tests/project-structure.test.js`: passed, 9 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `node --test tests/music-routes.test.js tests/update-routes.test.js`: passed, 172 tests.
- `npm test`: passed, 237 tests.
- `npm run coverage`: passed, 237 tests; production-code line coverage `100.00%`, branch coverage `67.67%`, function coverage `95.03%`.
- QA subagent review: `PASS`. Read-only verification by QA included `node --check server.js`, `npm run typecheck`, route-focused tests, full test suite, coverage-equivalent 100% line coverage check, and generated file tracking checks.

Stage 2 request handler shell slice:

- Initial RED: `npm run build:ts && node --test tests/server-http-utils.test.js` failed because `createRequestHandler` was not exported.
- Added `createRequestHandler` to `server/http-utils.ts`; it resolves `req.url` with `createRequestUrl`, then delegates to a supplied `handleRequest` with `{ req, res, url, pathname }`.
- `server.js` now passes the legacy route chain as `handleRequest` instead of parsing `req.url` inline.
- `npm run build:ts && node --test tests/server-http-utils.test.js tests/project-structure.test.js`: passed, 10 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `node --test tests/music-routes.test.js tests/update-routes.test.js`: passed, 172 tests.
- `npm test`: passed, 238 tests.
- `npm run coverage`: passed, 238 tests; production-code line coverage `100.00%`, branch coverage `67.69%`, function coverage `95.05%`.
- QA subagent review: `PASS`. Read-only verification by QA included targeted helper/structure tests, `node --check server.js`, `npm run typecheck`, route-focused tests, `npm test`, `npm run coverage`, and generated file tracking checks.

Stage 2 JSON response helper slice:

- Initial RED: `npm run build:ts && node --test tests/server-http-utils.test.js` failed because `sendJson` was not exported.
- Added `sendJson` to `server/http-utils.ts`; it preserves the legacy JSON status default, `Content-Type`, CORS, no-cache headers, and `JSON.stringify` body.
- `server.js` now imports `sendJson` as `sendJSON`, removing the local `sendJSON` implementation without changing route call sites.
- `npm run build:ts && node --test tests/server-http-utils.test.js tests/project-structure.test.js`: passed, 11 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `node --test tests/music-routes.test.js tests/update-routes.test.js tests/beatmap-cache-routes.test.js`: passed, 176 tests.
- `npm test`: passed, 239 tests.
- `npm run coverage`: passed, 239 tests; production-code line coverage `100.00%`, branch coverage `67.68%`, function coverage `95.05%`.
- QA subagent review: `PASS`. Read-only verification by QA included targeted helper/structure tests, `node --check server.js`, `npm run typecheck`, route-focused tests, `npm test`, `npm run coverage`, default-status probing, and generated file tracking checks.

Stage 2 static response helper slice:

- Initial RED: `npm run build:ts && node --test tests/server-static-utils.test.js` failed because `serveStatic` was not exported.
- Added `serveStatic` to `server/static-utils.ts`; it preserves legacy `fs.readFile` behavior, MIME header selection via `contentTypeForPath`, 200 response body passthrough, and 404 `Not Found`.
- `server.js` now imports `serveStatic` as `serveStaticFile` and keeps the legacy local `serveStatic(res, filePath)` call sites as a thin wrapper around `fs`.
- `npm run build:ts && node --test tests/server-static-utils.test.js tests/project-structure.test.js`: passed, 8 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `node --test tests/music-routes.test.js tests/server-static-utils.test.js`: passed, 148 tests.
- `npm test`: passed, 241 tests.
- `npm run coverage`: passed, 241 tests; production-code line coverage `100.00%`, branch coverage `67.72%`, function coverage `95.08%`.
- QA subagent review: `PASS`. Read-only verification by QA included `node --test tests/server-static-utils.test.js`, behavior equivalence review for 200/404 static responses, handoff consistency, and generated artifact tracking checks.

Stage 2 request body helper slice:

- Initial RED: `npm run build:ts && node --test tests/server-http-utils.test.js` failed because `readRequestBody` was not exported.
- Added `readRequestBody` to `server/http-utils.ts`; it preserves legacy JSON parsing, URLSearchParams form fallback, empty-body `{}`, error `{}`, and oversized body `req.destroy()` behavior.
- `server.js` now imports `readRequestBody` from `server-dist/server/http-utils`, removing the local implementation without changing route call sites.
- `npm run build:ts && node --test tests/server-http-utils.test.js tests/project-structure.test.js`: passed, 15 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `node --test tests/music-routes.test.js tests/update-routes.test.js tests/server-http-utils.test.js`: passed, 185 tests.
- `npm test`: passed, 245 tests.
- `npm run coverage`: passed, 245 tests; production-code line coverage `100.00%`, branch coverage `67.81%`, function coverage `95.34%`.
- QA subagent review: `PASS`. Read-only verification by QA included direct helper tests, `node --check server.js`, `git diff --check`, behavior equivalence review, handoff consistency, and generated artifact tracking checks.

Stage 3 update config service slice:

- Initial RED: `npm run build:ts && node --test tests/update-config-service.test.js` failed because `server-dist/server/services/update-config` did not exist.
- Added `server/services/update-config.ts` for `parseGitHubRepository`, `parseUpdateMirrorList`, `readUpdateMirrors`, and `readUpdateConfig`.
- `server.js` now imports `parseGitHubRepository` and `readUpdateConfig` from the compiled TS service; route behavior and `server.__test` export names are unchanged.
- Added `tests/update-config-service.test.js` for direct service coverage of repo parsing, mirror normalization/dedupe/limit, config/env merging, and the legacy `readUpdateConfig(null)` fallback.
- QA first pass was `PASS` but noted a residual non-blocking compatibility drift for `readUpdateConfig(null)`; a RED test was added and fixed by normalizing null package data to `{}`.
- `npm run build:ts && node --test tests/update-config-service.test.js tests/server-helpers.test.js tests/project-structure.test.js`: passed, 10 tests before the null fallback fix.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `node --test tests/update-routes.test.js tests/update-config-service.test.js tests/server-helpers.test.js`: passed, 39 tests after the null fallback fix.
- `npm test`: passed, 249 tests.
- `npm run coverage`: passed, 249 tests; production-code line coverage `100.00%`, branch coverage `68.06%`, function coverage `95.34%`; `server-dist/server/services/update-config.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Final read-only QA verification included `npm run typecheck`, `node --check server.js`, `node --test tests/update-config-service.test.js tests/server-helpers.test.js tests/update-routes.test.js`, `git diff --check`, behavior equivalence review, handoff consistency, and generated artifact tracking checks.

Stage 3 update download candidate service slice:

- Initial RED: `npm run build:ts && node --test tests/update-download-candidates-service.test.js` failed because `server-dist/server/services/update-download-candidates` did not exist.
- Added `server/services/update-download-candidates.ts` for `buildMirrorUrl` and `uniqueDownloadCandidates`.
- `server.js` imports `buildMirrorUrl` and `uniqueDownloadCandidates` from the compiled TS service; existing call sites still use a local wrapper that injects `UPDATE_CONFIG.mirrors` and `UPDATE_CONFIG.preferMirrors`.
- Added `tests/update-download-candidates-service.test.js` for direct service coverage of mirror template expansion, invalid URL filtering, mirror-first/default ordering, direct-first mode, no-mirror mode, and final URL dedupe.
- `npm run build:ts && node --test tests/update-download-candidates-service.test.js tests/update-routes.test.js tests/update-utils.test.js tests/project-structure.test.js`: passed, 48 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 252 tests.
- `npm run coverage`: passed, 252 tests; production-code line coverage `100.00%`, branch coverage `68.28%`, function coverage `95.35%`; `server-dist/server/services/update-download-candidates.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA independently ran targeted service/update tests, `node --check server.js`, `npm run typecheck`, `npm test`, `npm run coverage`, `git diff --check`, and verified generated artifact tracking.

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
4. Next implementation step for Stage 3:
   - Continue small behavior-neutral extraction inside the update domain before moving to broader route handler splits.
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
