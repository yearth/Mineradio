# Mineradio macOS Preview Handoff

## Goal

Create a first-pass macOS preview build of Mineradio, then incrementally add tests before any larger architecture refactor.

## Current Status

- Branch: `feat/macos-preview`
- Status: macOS preview build is usable enough for manual product evaluation; update route tests now cover non-Windows fallback, Windows manifest latest checks, GitHub latest release fetching, latest.yml fallback, installer/patch job creation, installer cache handling, installer download ready/error branches, HTTP candidate fallback/all-fail branches, and patch application success/error branches.
- User manually opened the generated DMG/App and reported: "app 没有问题".
- macOS preview commit: `ba9fd97 feat: add macOS preview build`.
- Current uncommitted work adds GitHub release fetching tests: successful GitHub latest release parsing and `latest.yml` fallback after GitHub API failure.

## Changes Made

- `package.json`
  - Added `test`, `build:mac`, and `build:mac:dir` scripts.
  - Added `build.mac` config for arm64 DMG output.
  - Uses ad-hoc signing with `identity: "-"` and `hardenedRuntime: false` for local preview builds.
  - Includes `lib/**/*` in packaged files.
  - Changed `NeteaseCloudMusicApi` from `^4.32.0` to `^4.31.0` because the configured npm registry does not have `4.32.0`.
- `package-lock.json`
  - Updated `NeteaseCloudMusicApi` to `4.31.0` with registry tarball metadata.
- `build/icon.icns`
  - Generated from existing `build/icon.png` using Pillow because `iconutil` rejected the generated iconset.
- `lib/platform-paths.js`
  - Added `defaultBeatMapCacheDir()`.
  - Windows keeps existing `D:\MineradioCache\beatmaps` behavior.
  - macOS uses `~/Library/Application Support/Mineradio/beatmaps`.
  - Linux-like platforms use `~/.mineradio/beatmaps`.
- `tests/platform-paths.test.js`
  - Added Node built-in tests for platform default cache paths.
- `lib/version-utils.js`
  - Extracted version normalization and numeric version comparison from `server.js`.
- `tests/version-utils.test.js`
  - Covers `v` prefix removal, prerelease/build metadata stripping, numeric segment comparison, and missing segment zero-fill behavior.
- `lib/update-utils.js`
  - Extracted release asset, patch asset, release-note, digest, URL basename, and safe update filename helpers from `server.js`.
- `tests/update-utils.test.js`
  - Covers installer asset preference, patch matching, digest normalization, safe filename fallback/sanitization, URL basename extraction, and release-note filtering.
- `tests/update-routes.test.js`
  - Covers `/api/update/latest`, `/api/update/download`, and `/api/update/patch` behavior on the macOS/non-Windows preview fallback path.
  - Covers Windows update path reading a local manifest file and normalizing latest-version release data without real network access.
  - Covers Windows update path reading the GitHub latest release API, choosing installer/patch assets, normalizing digests, and extracting release notes without real network access.
  - Covers Windows update path falling back to `latest.yml` when the GitHub latest release API fails.
  - Covers Windows manifest `/api/update/download` creating a queued installer job without starting a real background download in tests.
  - Covers Windows manifest `/api/update/patch` creating a queued patch job without applying a real patch in tests.
  - Covers `/api/update/download` reusing a verified cached installer and moving an invalid cached installer aside before queuing a fresh job.
  - Covers `/api/update/download` successful fake download reaching `ready`, sha256 mismatch reaching `error`, and size mismatch reaching `error`.
  - Covers `/api/update/download` switching to the next candidate after HTTP failure and reporting `error` after all candidates fail.
  - Covers `/api/update/patch` rejecting an unsafe `../package.json` file path and applying an allowed `public/.mineradio-patch-test.txt` file patch.
- `server.js`
  - Uses `defaultBeatMapCacheDir()`.
  - Disables Windows update channel on non-Windows preview builds via local fallback.
  - Delegates pure version/update helper behavior to `lib/version-utils.js` and `lib/update-utils.js`.
  - Skips automatic `server.listen()` when `NODE_ENV=test`, so route tests can exercise the HTTP handler without binding a local port.
  - Exposes `server.__test` only when `NODE_ENV=test`; this test hook can override update platform/manifest/auto-download/auto-patch and reset update job state.
  - Classifies `UPDATE_SHA256_MISMATCH` / SHA-like update errors as file verification failures.
- `desktop/main.js`
  - Uses PNG app icon on non-Windows runtime windows.
  - Skips Chromium `use-angle=d3d11` outside Windows.
  - Disables Windows WorkerW wallpaper mode on non-Windows.
  - Keeps desktop lyrics window path available; only the Windows middle-click poller remains Windows-only.

## Build Artifacts

- DMG: `dist/Mineradio-1.1.1-arm64.dmg`
- App bundle: `dist/mac-arm64/Mineradio.app`
- These are ignored by `.gitignore` through `dist/`.

## Verification Run

- `npm install`: passed after downgrading `NeteaseCloudMusicApi` to `4.31.0`.
- `npm test`: passed, 27 tests.
- `node --check server.js`: passed.
- `node --check desktop/main.js`: passed.
- `git diff --check`: passed.
- `npm run build:mac:dir`: passed.
- `npm run build:mac`: passed.
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Mineradio.app`: passed.
- `hdiutil verify dist/Mineradio-1.1.1-arm64.dmg`: passed.
- Direct launch from the Codex subprocess failed with macOS LaunchServices/AppKit errors, but user manual launch from DMG succeeded.

## Decisions

- Do not refactor the large `public/index.html` yet.
- Do not introduce React/Vue/RN.
- Add tests around pure, extractable business logic before touching UI-heavy or Electron-specific paths.
- Independent QA must be done by a read-only subagent; do not count self-review as acceptance.
- Do not implement full macOS auto-update, notarization, or real Developer ID signing in this phase.
- Disable or degrade Windows-only features rather than blocking app startup.
- Keep Windows behavior unchanged where possible.

## Risks / Follow-Ups

- Manual smoke testing should cover search, playback, lyrics, login windows, and visual performance.
- macOS app is ad-hoc signed and not notarized; Gatekeeper prompts are expected outside local/dev contexts.
- Wallpaper mode is intentionally unsupported on macOS preview.
- Update UI is intentionally disabled on non-Windows preview builds.
- `NeteaseCloudMusicApi` downgrade may need a compatibility check against playback/search/login behavior.
- The app now has a small focused test suite, but broad coverage remains a later phase before architecture refactoring.
- Update flow behavior is covered at helper level, on the non-Windows preview route fallback path, on the Windows local-manifest latest route path, GitHub latest release fetching, latest.yml fallback, installer/patch job creation, installer cache reuse/invalid-cache handling, installer fake-download ready/hash/size branches, installer HTTP fallback/all-fail branches, and patch application success/error branches.
- UI behavior in `public/index.html` remains largely untested.

## Next Session Bootstrap

1. `cd /Users/yearthmain/agent-playground/repos/Mineradio`
2. `git status --short --branch`
3. Read this file and inspect:
   - `package.json`
   - `desktop/main.js`
   - `server.js`
   - `lib/platform-paths.js`
   - `tests/platform-paths.test.js`
4. Run:
   - `npm test`
   - `node --check server.js`
   - `node --check desktop/main.js`
   - `git diff --check`
5. If resuming the current test phase, first inspect:
   - `lib/version-utils.js`
   - `lib/update-utils.js`
   - `tests/update-routes.test.js`
   - `tests/version-utils.test.js`
   - `tests/update-utils.test.js`
6. Next implementation step: continue into playback/search/login API flows, then UI-heavy `public/index.html` behavior once safer seams exist.
