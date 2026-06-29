# Mineradio macOS Preview Handoff

## Goal

Create a first-pass macOS preview build of Mineradio so the user can see the product on macOS before deeper testing and refactoring work.

## Current Status

- Branch: `feat/macos-preview`
- Status: macOS preview build is usable enough for manual product evaluation.
- User manually opened the generated DMG/App and reported: "app 没有问题".
- Commit pending at time of writing this handoff.

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
- `server.js`
  - Uses `defaultBeatMapCacheDir()`.
  - Disables Windows update channel on non-Windows preview builds via local fallback.
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
- `npm test`: passed, 3 tests.
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
- Do not implement full macOS auto-update, notarization, or real Developer ID signing in this phase.
- Disable or degrade Windows-only features rather than blocking app startup.
- Keep Windows behavior unchanged where possible.

## Risks / Follow-Ups

- Manual smoke testing should cover search, playback, lyrics, login windows, and visual performance.
- macOS app is ad-hoc signed and not notarized; Gatekeeper prompts are expected outside local/dev contexts.
- Wallpaper mode is intentionally unsupported on macOS preview.
- Update UI is intentionally disabled on non-Windows preview builds.
- `NeteaseCloudMusicApi` downgrade may need a compatibility check against playback/search/login behavior.
- The app still has no meaningful broad test suite; full test coverage remains a later phase before architecture refactoring.

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
5. Next implementation step: perform manual macOS product smoke testing and record which features fail before adding any deeper refactor.

