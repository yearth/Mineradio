# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current app behavior and macOS preview usability.

## Current Status

- Branch: `feat/macos-preview`
- Worktree: check `git status --short --branch`; latest committed slice is `cc07e38 refactor: extract update patch download helpers`; current uncommitted slice extracts update installer download helpers.
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
- Stage 3 third micro-slice is complete: `publicDownloadUrls` moved into `server/services/update-download-candidates.ts`; `server.js` imports it from compiled TS.
- Stage 3 fourth slice is complete: `server/services/update-manifest.ts` owns manifest update normalization; `server.js` delegates through an `APP_VERSION`/fallback-notes/download-candidate wrapper.
- Stage 3 fifth slice is complete: `server/services/update-errors.ts` owns update error creation and classification; `server.js` imports the compiled helpers directly.
- Stage 3 sixth slice is complete: `server/services/update-latest-yml.ts` owns latest.yml fallback parsing and GitHub release download URL construction; `server.js` delegates through an `APP_VERSION`/repository/download-candidate wrapper.
- Stage 3 seventh slice is complete: `server/services/update-patch-payload.ts` owns patch payload validation, patch file content decoding, and patch path safety checks; `server.js` delegates through `APP_VERSION`/root-dir wrappers.
- Stage 3 eighth slice is complete: `server/services/update-job-runtime.ts` owns update job public projection, active job lookup, job trimming, attempt reset, error state assignment, and mirror digest guard logic; `server.js` delegates through current job-map wrappers where needed.
- Stage 3 ninth slice is complete: `server/services/update-file-cache.ts` owns update hash helpers, downloaded buffer/file verification, invalid cache renaming, and verified cached installer job construction; `server.js` injects fs/path/job-map wrappers.
- Stage 3 tenth slice is complete: `server/services/update-job-factory.ts` owns installer/patch update job validation, active job reuse, cache reuse, job object construction, registration/trim, and auto-start runner hooks; `server.js` keeps thin dependency-injection wrappers.
- Stage 3 eleventh slice is complete: `server/services/update-patch-apply.ts` owns patch file backup and atomic write/verify behavior; `server.js` injects fs/path/root helpers through a thin `writePatchFile` wrapper.
- Stage 3 twelfth slice is complete: `server/services/update-progress.ts` owns installer/patch download speed, progress, and ETA math; `server.js` download loops now delegate pure math while preserving timing windows and state/message flow.
- Stage 3 thirteenth slice is complete: `server/services/update-fetch.ts` owns local update fallback response construction and latest.yml text candidate fetching; `server.js` injects version/config/fetch/error-classifier dependencies through thin wrappers.
- Stage 3 fourteenth slice is complete: `server/services/update-manifest-source.ts` owns external update manifest reading and manifest fetch normalization/fallback orchestration; `server.js` injects fs/path/fetch/User-Agent/normalizer/fallback wrappers.
- Stage 3 fifteenth slice is complete: `server/services/update-check.ts` owns latest update check orchestration across mac preview fallback, manifest override, GitHub API release metadata, latest.yml fallback, and local fallback.
- Stage 3 sixteenth slice is complete: `server/services/update-patch-download.ts` owns single-candidate patch package download, patch progress, max-size guard, and buffer verification.
- Stage 3 seventeenth slice is QA-passed and ready to commit: `server/services/update-installer-download.ts` owns complete installer download runner behavior across candidates, stream writes, verification, final ready state, and failure aggregation.
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

Stage 3 public download URL helper micro-slice:

- Initial RED: `npm run build:ts && node --test tests/update-download-candidates-service.test.js` failed because `publicDownloadUrls` was not exported from `server-dist/server/services/update-download-candidates`.
- Added `publicDownloadUrls` to `server/services/update-download-candidates.ts`.
- `server.js` now imports `publicDownloadUrls` from the compiled TS service and no longer keeps a local implementation.
- Added direct service coverage for filtering URL fields from candidate objects, preserving empty-array fallback for invalid input, and keeping legacy truthy-item `.url` behavior for callable objects.
- `npm run build:ts && node --test tests/update-download-candidates-service.test.js tests/update-routes.test.js tests/update-utils.test.js tests/project-structure.test.js`: passed, 49 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 253 tests.
- `npm run coverage`: passed, 253 tests; production-code line coverage `100.00%`, branch coverage `68.35%`, function coverage `95.35%`; `server-dist/server/services/update-download-candidates.js` line coverage `100.00%`.
- QA subagent first pass: `PASS` with a non-blocking note about callable objects with a `url` property.
- Follow-up RED added for callable candidate input; the service was adjusted to preserve the exact legacy `item && item.url` behavior.
- QA subagent final review: `PASS`. Read-only QA verified the callable-object compatibility fix, targeted update tests, `node --check server.js`, `npm run typecheck`, `npm test`, `npm run coverage`, `git diff --check`, and generated artifact tracking.

Stage 3 manifest normalization service slice:

- Initial RED: `npm run build:ts && node --test tests/update-manifest-service.test.js` failed because `server-dist/server/services/update-manifest` did not exist.
- Added `server/services/update-manifest.ts` for `normalizeManifestUpdateInfo`.
- `server.js` now imports `normalizeManifestUpdateInfoService` and keeps the legacy local `normalizeManifestUpdateInfo(data)` as a thin wrapper injecting `APP_VERSION`, `UPDATE_FALLBACK_NOTES`, and `uniqueDownloadCandidates`.
- Added `tests/update-manifest-service.test.js` for direct coverage of manifest release/asset/patch mapping, release notes cleanup, explicit `updateAvailable`, fallback notes/body extraction, digest normalization, and generated asset/patch names.
- Removed the now-unused `cleanReleaseLine` import from `server.js`.
- `npm run build:ts && node --test tests/update-manifest-service.test.js tests/update-routes.test.js tests/update-utils.test.js tests/update-download-candidates-service.test.js tests/project-structure.test.js`: passed, 51 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 255 tests.
- `npm run coverage`: passed, 255 tests; production-code line coverage `100.00%`, branch coverage `69.03%`, function coverage `95.37%`; `server-dist/server/services/update-manifest.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified behavior-equivalence coverage, compiled service dependency paths into root `lib`, targeted update tests, `node --check server.js`, `npm run typecheck`, `npm test`, `npm run coverage`, `git diff --check`, and generated artifact tracking.

Stage 3 update error service slice:

- Initial RED: `npm run build:ts && node --test tests/update-errors-service.test.js` failed because `server-dist/server/services/update-errors` did not exist.
- Added `server/services/update-errors.ts` for `updateError` and `classifyUpdateError`.
- `server.js` now imports `updateError` and `classifyUpdateError` from the compiled TS service; all legacy call sites keep the same names.
- Added `tests/update-errors-service.test.js` for direct coverage of error code/message/cause creation, checksum/size/timeout/DNS/network classification, HTTP 403/404/5xx/generic status handling, generic string errors, null fallback, and object `message || err` fallback semantics.
- QA first pass was `NEEDS WORK` because plain objects with `code` and an empty `message` did not exactly preserve legacy `String(err && err.message || err || '')` behavior.
- Added a RED test for `{ code: 'HTTP_403', message: '' }`, then changed `server/services/update-errors.ts` to preserve the legacy `||` fallback behavior.
- `npm run build:ts && node --test tests/update-errors-service.test.js tests/update-routes.test.js tests/update-manifest-service.test.js tests/project-structure.test.js`: passed, 38 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `npm test`: passed, 259 tests.
- `npm run coverage`: passed, 259 tests; production-code line coverage `100.00%`, branch coverage `69.46%`, function coverage `95.37%`; `server-dist/server/services/update-errors.js` line coverage `100.00%`.
- QA subagent final review: `PASS`. Read-only QA verified the object fallback compatibility fix, targeted update tests, `node --check server.js`, `npm run typecheck`, `npm test`, `npm run coverage`, `git diff --check`, and generated artifact tracking.

Stage 3 latest.yml update service slice:

- Initial RED: `npm run build:ts && node --test tests/update-latest-yml-service.test.js` failed because `server-dist/server/services/update-latest-yml` did not exist.
- Added `server/services/update-latest-yml.ts` for `yamlScalar`, `githubReleaseDownloadUrl`, and `parseLatestYmlUpdateInfo`.
- `server.js` now imports `parseLatestYmlUpdateInfo` from the compiled TS service and injects `APP_VERSION`, configured GitHub owner/repo, and `uniqueDownloadCandidates`.
- Added `tests/update-latest-yml-service.test.js` for quoted YAML scalar parsing, regex-special key escaping, repository/path URL encoding, latest.yml mapping, digest normalization, fallback asset naming, and sparse latest.yml fallbacks.
- First coverage run after extraction failed because an unused `server.js` wrapper around `githubReleaseDownloadUrl` left lines 393-398 uncovered; removed that wrapper instead of keeping dead adapter code.
- `npm run build:ts && node --test tests/update-latest-yml-service.test.js tests/update-routes.test.js tests/update-utils.test.js tests/project-structure.test.js`: passed, 49 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 263 tests.
- `npm run coverage`: passed, 263 tests; production-code line coverage `100.00%`, branch coverage `69.77%`, function coverage `95.38%`; `server-dist/server/services/update-latest-yml.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified service extraction, latest.yml fallback route behavior, targeted tests, `npm test`, `npm run coverage`, `git diff --check`, generated artifact tracking, and handoff consistency.

Stage 3 patch payload service slice:

- Initial RED: `npm run build:ts && node --test tests/update-patch-payload-service.test.js` failed because `server-dist/server/services/update-patch-payload` did not exist.
- Added `server/services/update-patch-payload.ts` for `safePatchRelativePath`, `patchTargetPath`, `decodePatchFile`, and `normalizePatchPayload`.
- `server.js` now imports patch payload helpers from compiled TS, removes local patch allowed-root/file constants, and injects `APP_VERSION` / `__dirname` through thin wrappers where needed.
- Added `tests/update-patch-payload-service.test.js` for allowed path normalization, traversal/NUL/disallowed-root/executable rejection, root-scoped target resolution, base64/utf8 content decoding, patch payload aliases, restart fallback, and legacy validation errors.
- `npm run build:ts && node --test tests/update-patch-payload-service.test.js tests/update-routes.test.js tests/project-structure.test.js`: passed, 38 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 269 tests.
- `npm run coverage`: passed, 269 tests; production-code line coverage `100.00%`, branch coverage `70.66%`, function coverage `95.41%`; `server-dist/server/services/update-patch-payload.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified service extraction, `server.js` injection wrappers, service tests, `/api/update/patch` route coverage, `node --check server.js`, `npm run typecheck`, `git diff --check`, `npm test`, `npm run coverage`, generated artifact tracking, and handoff consistency.

Stage 3 update job runtime service slice:

- Initial RED: `npm run build:ts && node --test tests/update-job-runtime-service.test.js` failed because `server-dist/server/services/update-job-runtime` did not exist.
- Added `server/services/update-job-runtime.ts` for `publicUpdateJob`, `activeUpdateJobFor`, `trimUpdateJobs`, `prepareUpdateJobAttempt`, `setUpdateJobError`, and `ensureMirrorCanBeVerified`.
- `server.js` now imports update job runtime helpers from compiled TS and keeps thin wrappers only where the module-level `updateDownloadJobs` map must be injected.
- Added `tests/update-job-runtime-service.test.js` for public job response projection, hidden in-progress file paths, failed-attempt truncation, newest active job selection, trim-to-eight behavior, attempt reset state, classified error assignment, and mirrored digest guard errors.
- First GREEN run exposed a wrong test expectation for `HTTP_404`; the legacy classifier reason is `更新文件不存在，可能 release 资源还没有同步完成。`, and the test was corrected to that current behavior.
- `npm run build:ts && node --test tests/update-job-runtime-service.test.js tests/update-routes.test.js tests/project-structure.test.js`: passed, 39 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 276 tests.
- `npm run coverage`: passed, 276 tests; production-code line coverage `100.00%`, branch coverage `70.91%`, function coverage `96.46%`; `server-dist/server/services/update-job-runtime.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified service extraction, map-injection wrappers, service tests, update download/patch route coverage, `node --check server.js`, `npm run typecheck`, `git diff --check`, `npm test`, `npm run coverage`, generated artifact tracking, and handoff consistency.

Stage 3 update file cache service slice:

- Initial RED: `npm run build:ts && node --test tests/update-file-cache-service.test.js` failed because `server-dist/server/services/update-file-cache` did not exist.
- Added `server/services/update-file-cache.ts` for `sha256Hex`, `sha512Base64`, `sha512Hex`, `verifyUpdateBuffer`, `verifyUpdateFile`, `moveInvalidUpdateFile`, and `reuseVerifiedInstallerJob`.
- `server.js` now imports update file/cache helpers from compiled TS and keeps thin wrappers to inject `fs`, `path`, `updateDownloadJobs`, and `trimUpdateJobs`.
- Added `tests/update-file-cache-service.test.js` for hash helper encodings, size/sha256/sha512 base64/sha512 hex verification, mismatch error codes, invalid-cache rename behavior, rename-failure fallback, cached ready job construction/registration, and invalid/unverifiable cache rejection.
- First GREEN build hit TypeScript `catch` unknown errors in the new service; fixed with typed `catch (e: any)` / `catch (err: any)` while preserving runtime behavior.
- `npm run build:ts && node --test tests/update-file-cache-service.test.js tests/update-routes.test.js tests/server-helpers.test.js tests/server-test-runtime.test.js tests/project-structure.test.js`: passed, 46 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 283 tests.
- `npm run coverage`: passed, 283 tests; production-code line coverage `100.00%`, branch coverage `71.40%`, function coverage `96.01%`; `server-dist/server/services/update-file-cache.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified service extraction, injected wrappers, legacy `__test.moveInvalidUpdateFile` compatibility export, service tests, old implementation parity, `node --check server.js`, `npm run typecheck`, `git diff --check`, `npm test`, `npm run coverage`, and generated artifact tracking.

Stage 3 update job factory service slice:

- Initial RED: `npm run build:ts && node --test tests/update-job-factory-service.test.js` failed because `server-dist/server/services/update-job-factory` did not exist.
- Added `server/services/update-job-factory.ts` for `startUpdateDownloadJob` and `startUpdatePatchJob` orchestration: legacy rejection responses, active job reuse, verified installer cache reuse, installer/patch job object construction, digest normalization, job registration/trim, and `autoDownload`/`autoPatch` runner triggers.
- `server.js` now imports the compiled job factory helpers and passes path/job map/download dir/name/candidate/public/trim/cache/runner dependencies through thin wrappers.
- Added `tests/update-job-factory-service.test.js` for installer rejection responses, active job reuse, cache reuse before queueing, queued installer fields and autoDownload false, patch rejection responses, active patch job reuse, queued patch fields and autoPatch runner invocation.
- `npm run build:ts && node --test tests/update-job-factory-service.test.js tests/update-routes.test.js tests/server-helpers.test.js tests/project-structure.test.js`: passed, 44 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 290 tests.
- `npm run coverage`: passed, 290 tests; production-code line coverage `100.00%`, branch coverage `71.84%`, function coverage `95.84%`; `server-dist/server/services/update-job-factory.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified legacy behavior parity, `server.js` dependency injection completeness, service test coverage, full validation evidence, and generated artifact tracking.

Stage 3 update patch apply service slice:

- Initial RED: `npm run build:ts && node --test tests/update-patch-apply-service.test.js` failed because `server-dist/server/services/update-patch-apply` did not exist.
- Added `server/services/update-patch-apply.ts` for `backupPatchTarget` and `writePatchFile`: existing-file backups under `UPDATE_PATCH_BACKUP_DIR/job.id/rel`, missing-target skip, safe relative path and target resolution, patch file decoding, max-size guard, sha256 guard, temp-file write/rename, and post-write sha256 verify.
- `server.js` now imports `writePatchFile` from the compiled service and injects `fs`, `path`, backup dir, `patchTargetPath`, `safePatchRelativePath`, `decodePatchFile`, `sha256Hex`, and `PATCH_MAX_BYTES`; the unused local `backupPatchTarget` wrapper was removed after coverage exposed it as dead code.
- Added `tests/update-patch-apply-service.test.js` for backup path construction, missing target skip, temp write/rename/verify, validation errors, too-large patch files, pre-write hash mismatch, and post-rename verify failure.
- `npm run build:ts && node --test tests/update-patch-apply-service.test.js tests/update-routes.test.js tests/server-helpers.test.js tests/project-structure.test.js`: passed, 42 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 295 tests.
- First `npm run coverage` failed because the now-unused local `backupPatchTarget` wrapper in `server.js` lowered server line coverage to `99.75%`; removed that dead wrapper.
- Final `npm run coverage`: passed, 295 tests; production-code line coverage `100.00%`, branch coverage `71.82%`, function coverage `95.86%`; `server-dist/server/services/update-patch-apply.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified legacy backup/write behavior parity, dependency injection completeness, safe deletion of the unused wrapper, service tests, `node --check server.js`, targeted service tests, `git diff --check`, and generated artifact tracking.

Stage 3 update progress service slice:

- Initial RED: `npm run build:ts && node --test tests/update-progress-service.test.js` failed because `server-dist/server/services/update-progress` did not exist.
- Added `server/services/update-progress.ts` for `speedBps`, `installerProgress`, and `patchProgress`.
- `server.js` now imports those pure helpers and uses them inside installer and patch download loops; speed-window thresholds remain `900ms` for installer and `700ms` for patch.
- Added `tests/update-progress-service.test.js` for speed rounding, installer known-size clamp/ETA, installer unknown-size legacy log fallback including 0 bytes -> progress `7`, patch known-size 84%-scale clamp/ETA, and patch unknown-size 76%-clamped log fallback.
- First GREEN run exposed a wrong test expectation for installer unknown-size 0 bytes; legacy code uses `Math.max(1, received / 1024)` before log progress, so the expected progress was corrected from `1` to `7`.
- `npm run build:ts && node --test tests/update-progress-service.test.js tests/update-routes.test.js tests/project-structure.test.js`: passed, 37 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 300 tests.
- `npm run coverage`: passed, 300 tests; production-code line coverage `100.00%`, branch coverage `71.95%`, function coverage `95.89%`; `server-dist/server/services/update-progress.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified formula parity, `server.js` timing/state/message preservation, service test boundaries, no generated artifact tracking, `node --test tests/update-progress-service.test.js`, and `node --check server.js`.

Stage 3 update fetch service slice:

- Initial RED: `npm run build:ts && node --test tests/update-fetch-service.test.js` failed because `server-dist/server/services/update-fetch` did not exist.
- Added `server/services/update-fetch.ts` for `localUpdateFallback` and `fetchTextFromCandidates`.
- `server.js` now imports the compiled fetch helpers and injects `UPDATE_CONFIG.preview`, `APP_VERSION`, `UPDATE_FALLBACK_NOTES`, `fetchWithTimeout`, and `classifyUpdateError` through wrappers.
- Added `tests/update-fetch-service.test.js` for fallback response shape/default `configured`, first successful candidate with User-Agent and timeout, all-lines-failed detail joining, and empty candidate fallback message.
- `npm run build:ts && node --test tests/update-fetch-service.test.js tests/update-routes.test.js tests/server-helpers.test.js tests/project-structure.test.js`: passed, 41 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 304 tests.
- `npm run coverage`: passed, 304 tests; production-code line coverage `100.00%`, branch coverage `72.18%`, function coverage `95.91%`; `server-dist/server/services/update-fetch.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified fallback shape, candidate fetch behavior, wrapper injection, service tests, generated artifact tracking, and `git diff --check`.

Stage 3 update manifest source service slice:

- Initial RED: `npm run build:ts && node --test tests/update-manifest-source-service.test.js` failed because `server-dist/server/services/update-manifest-source` did not exist.
- Added `server/services/update-manifest-source.ts` for `readUpdateManifest` and `fetchManifestUpdateInfo`.
- `server.js` now imports the compiled manifest source helpers and injects `fs`, `path`, `fetch`, `Mineradio/${APP_VERSION}`, `normalizeManifestUpdateInfo`, and `localUpdateFallback` through wrappers.
- Added `tests/update-manifest-source-service.test.js` for empty manifest refs, local JSON paths, `file:` URLs, remote JSON fetch with User-Agent, HTTP error messages, normalize success flow, and fallback `{ configured: true }` flow.
- `npm run build:ts && node --test tests/update-manifest-source-service.test.js tests/update-routes.test.js tests/server-helpers.test.js tests/project-structure.test.js`: passed, 42 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 309 tests.
- `npm run coverage`: passed, 309 tests; production-code line coverage `100.00%`, branch coverage `72.24%`, function coverage `95.70%`; `server-dist/server/services/update-manifest-source.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified manifest read behavior, wrapper injection, fallback reason/configured behavior, absence of stale `fileURLToPath` require, targeted tests, and generated artifact tracking.

Stage 3 update check service slice:

- Initial RED: `npm run build:ts && node --test tests/update-check-service.test.js` failed because `server-dist/server/services/update-check` did not exist.
- Added `server/services/update-check.ts` for `fetchLatestYmlUpdateInfo` and `fetchLatestUpdateInfo` orchestration.
- `server.js` now imports the compiled check helpers and injects platform override, manifest ref, update config, app version, fallback notes, fetch, manifest fetch, local fallback, latest.yml fallback, and download-candidate helpers through wrappers.
- Added `tests/update-check-service.test.js` for latest.yml URL/candidate fetch, unconfigured latest.yml rejection, mac preview fallback, manifest override priority, successful GitHub release mapping, HTTP non-ok latest.yml fallback, HTTP non-ok local fallback, and fetch-exception local fallback.
- `npm run build:ts && node --test tests/update-check-service.test.js tests/update-routes.test.js tests/server-helpers.test.js tests/project-structure.test.js`: passed, 42 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 314 tests.
- First `npm run coverage` failed at `99.97%` line coverage because `server-dist/server/services/update-check.js` lines 50-51 were uncovered; added a direct HTTP non-ok + latest.yml failure test.
- Final `npm run coverage`: passed, 314 tests; production-code line coverage `100.00%`, branch coverage `72.18%`, function coverage `95.72%`; `server-dist/server/services/update-check.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified legacy behavior parity, wrapper dependency injection, removed-import safety, test coverage, generated artifact tracking, `node --test tests/update-check-service.test.js`, `node --check server.js`, `npm run typecheck`, and `git diff --check`.

Stage 3 update patch download service slice:

- Initial RED: `npm run build:ts && node --test tests/update-patch-download-service.test.js` failed because `server-dist/server/services/update-patch-download` did not exist.
- Added `server/services/update-patch-download.ts` for `downloadPatchBufferFromCandidate`.
- `server.js` now imports the compiled patch download helper and injects patch max bytes, User-Agent, mirror digest guard, attempt preparation, fetch timeout helper, update error helper, speed/progress helpers, and buffer verification.
- Added `tests/update-patch-download-service.test.js` for guard/prepare ordering, patch job state setup, User-Agent and 12000ms timeout, content-length total fallback, received reset, progress update, verify call, speed windows, HTTP errors, and `PATCH_TOO_LARGE`.
- First GREEN build exposed the repo's no-Node-types TS constraint for `Buffer`; fixed with local `declare const Buffer: any` instead of adding `@types/node`.
- `npm run build:ts && node --test tests/update-patch-download-service.test.js tests/update-routes.test.js tests/project-structure.test.js`: passed, 35 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 317 tests.
- `npm run coverage`: passed, 317 tests; production-code line coverage `100.00%`, branch coverage `72.31%`, function coverage `95.73%`; `server-dist/server/services/update-patch-download.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified behavior parity, wrapper injection completeness, service tests, full tests, coverage, and generated artifact tracking.

Stage 3 update installer download service slice:

- Initial RED: `npm run build:ts && node --test tests/update-installer-download-service.test.js` failed because `server-dist/server/services/update-installer-download` did not exist.
- Added `server/services/update-installer-download.ts` for `downloadUpdateAssetWithMirrors`.
- `server.js` now imports the compiled installer download helper and injects `fs`, `once`, update download dir, User-Agent, candidate builder, mirror guard, attempt preparation, fetch timeout helper, update error helper, speed/progress helpers, file verifier, error classifier, and job error setter.
- Added `tests/update-installer-download-service.test.js` for first-candidate success, fallback candidate construction, User-Agent and 14000ms timeout, verify/rename, writer backpressure/drain/finish path, speed windows, candidate switching, HTTP classification, final failure, and failedAttempts projection.
- `npm run build:ts && node --test tests/update-installer-download-service.test.js tests/update-routes.test.js tests/project-structure.test.js`: passed, 35 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 320 tests.
- `npm run coverage`: passed, 320 tests; production-code line coverage `100.00%`, branch coverage `72.46%`, function coverage `95.74%`; `server-dist/server/services/update-installer-download.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified old runner behavior parity, wrapper injection completeness, service tests, generated artifact tracking, and validation commands. Non-blocking note: fake writer exercises drain/finish but does not strongly assert wait ordering.

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
