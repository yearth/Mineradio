# Mineradio macOS Preview Handoff

## Goal

Create a first-pass macOS preview build of Mineradio, then incrementally add tests before any larger architecture refactor.

## Current Status

- Branch: `feat/macos-preview`
- Status: macOS preview build is usable enough for manual product evaluation; tests now cover the update route family plus first-pass music route behavior for search, lyrics, Netease song URL/artist detail, QQ search/song URL/lyrics/login/status/logout/user playlists/playlist tracks/artist detail/song comments, podcast search/hot/detail/programs/my collections/my items plus partial/failure paths, weather ip-location/weather radio, audio/cover proxy behavior, login cookie/status/logout, QR login, user playlists, liked-song checks/toggles, playlist mutation, song comments, playlist tracks, selected playlist/podcast error branches, static favicon/root page/JSON/missing-file behavior, and beatmap cache disk/memory-only/key-boundary behavior. `update-utils.js` now has 100% line/function coverage with broader asset/digest/url/filename branch characterization. `dj-analyzer.js` now has first-pass pure beat-map, wrapper-path, empty full-stream, non-empty full-stream decode metadata, quality full-stream fallback, empty intro, empty range-sampling, and range-sampled success aggregation coverage.
- User manually opened the generated DMG/App and reported: "app 没有问题".
- macOS preview commit: `ba9fd97 feat: add macOS preview build`.
- Current uncommitted work extends `tests/music-routes.test.js` route coverage for `/api/app/version` metadata, QQ profile auth-unavailable fallback, QQ artist detail generated-avatar/name fallback, and `/api/audio` extension-based content-type inference. The music route test bootstrap now clears `MINERADIO_VERSION`, `MINERADIO_UPDATE_*`, and `GITHUB_REPOSITORY` before requiring `server.js` so version/update metadata assertions are not affected by the caller's shell environment.

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
  - Covers `v`/`V` prefix removal, prerelease/build metadata stripping, blank/null normalization, numeric segment comparison, missing segment zero-fill behavior, prerelease comparison, and non-numeric segment zero coercion.
- `lib/update-utils.js`
  - Extracted release asset, patch asset, release-note, digest, URL basename, and safe update filename helpers from `server.js`.
- `tests/update-utils.test.js`
  - Covers installer asset preference, archive fallback, missing-asset null responses, patch matching/fallback/null responses, digest normalization, safe filename fallback/sanitization, URL basename extraction/fallback, and release-note filtering.
  - Covers patch asset fallback when a current-version patch exists but no exact current-to-latest patch matches.
  - Covers first-asset release fallback with explicit sha256/sha512 fields, generic patch fallback metadata, long filename truncation, and malformed percent-encoded URL fallback.
- `tests/update-routes.test.js`
  - Covers `/api/update/latest`, `/api/update/download`, and `/api/update/patch` behavior on the macOS/non-Windows preview fallback path.
  - Covers Windows update path reading a local manifest file and normalizing latest-version release data without real network access.
  - Covers Windows update path reading a remote HTTP manifest with the Mineradio User-Agent and normalizing latest-version release data without real network access.
  - Covers Windows update path falling back to local update metadata when a remote manifest returns an HTTP error.
  - Covers Windows update path reading the GitHub latest release API, choosing installer/patch assets, normalizing digests, and extracting release notes without real network access.
  - Covers Windows update path falling back to `latest.yml` when the GitHub latest release API fails.
  - Covers Windows manifest `/api/update/download` creating a queued installer job without starting a real background download in tests.
  - Covers Windows manifest `/api/update/patch` creating a queued patch job without applying a real patch in tests.
  - Covers `/api/update/download` reusing a verified cached installer and moving an invalid cached installer aside before queuing a fresh job.
  - Covers `/api/update/download` successful fake download reaching `ready`, sha256 mismatch reaching `error`, and size mismatch reaching `error`.
  - Covers `/api/update/download` sha512 mismatch reaching `error` with a file verification failure reason.
  - Covers `/api/update/download` switching to the next candidate after HTTP or DNS failure and reporting `error` after all candidates fail.
  - Covers `/api/update/patch` rejecting an unsafe `../package.json` file path and applying an allowed `public/.mineradio-patch-test.txt` file patch.
- `tests/music-routes.test.js`
  - Covers `/api/search` mapping Netease `cloudsearch` results, backfilling missing covers via `song_detail`, and returning `{ songs: [] }` on search failure.
  - Covers `/api/lyric` missing-id validation, `lyric_new` success, fallback to `lyric` when `lyric_new` has no timed lyrics or throws, and 500 behavior when fallback lyric lookup fails.
  - Covers `/api/song/url` returning the first playable Netease URL and reporting `login_required` restrictions for logged-out users when no playable URL is returned.
  - Covers `/api/song/url` returning logged-in trial-only playback responses with `trial_only` restriction metadata.
  - Covers `/api/song/url` classifying logged-in Netease VIP, paid, and copyright playback restrictions.
  - Covers `/api/qq/search` smartbox result mapping, blank keyword short-circuiting without upstream requests, and provider error responses.
  - Covers `/api/qq/song/url` successful vkey URL selection, missing-mid validation without upstream requests, and provider error responses.
  - Covers `/api/qq/song/url` login-required responses for logged-out users and partial QQ web sessions that lack playback authorization.
  - Covers `/api/qq/song/url` classifying logged-in QQ copyright, paid, generic nonzero-code, and default URL-unavailable playback restrictions.
  - Covers `/api/qq/lyric` missing-mid/id validation, musicu lyric decoding for base64/plain lyric fields, and the empty-lyric fallback when QQ lyric lookups fail.
  - Covers `/api/qq/login/cookie` invalid cookie rejection, valid QQ cookie persistence with profile-fallback behavior, successful QQ profile mapping, and web-session cookies without playback authorization.
  - Covers `/api/qq/login/cookie` falling back to cookie profile data when QQ profile lookup reports an auth-unavailable response.
  - Covers `/api/qq/login/status` logged-out defaults and `/api/qq/logout` clearing the saved QQ cookie.
  - Covers `/api/qq/user/playlists` logged-out behavior plus logged-in created/collected playlist mapping, duplicate filtering, Qzone/background filtering, favorite-list ordering, and partial collected-list results when the created-list source fails.
  - Covers `/api/qq/playlist/tracks` logged-out behavior plus logged-in playlist detail/track mapping and provider error responses.
  - Covers `/api/qq/artist/detail` missing-mid validation, artist/song mapping from QQ musicu responses, and provider error responses.
  - Covers `/api/qq/artist/detail` fallback artist names from mapped songs and generated QQ singer avatars when profile metadata is sparse.
  - Covers `/api/artist/detail` missing-id validation, artist metadata mapping, hot song mapping from `artist_songs`, limit clamping, detail/hot-song warning fallbacks, fallback to `artist_top_song` when hot songs are empty, and 500 behavior when top-song fallback fails.
  - Covers `/api/qq/song/comments` missing-id behavior, first-page hot comment mapping, and provider error responses.
  - Covers `/api/podcast/search` blank keyword short-circuiting and podcast radio mapping from `cloudsearch`.
  - Covers `/api/podcast/hot` pagination and hot podcast radio mapping.
  - Covers `/api/podcast/detail` missing-id validation and detail mapping.
  - Covers `/api/podcast/programs` missing-id validation and program/radio mapping from `dj_program`.
  - Covers `/api/podcast/my` logged-out collection summaries and logged-in collect/created/liked summary mapping.
  - Covers `/api/podcast/my/items` logged-out defaults and collected podcast radio item mapping.
  - Covers `/api/podcast/my` preserving available collections when one source fails and liked voices fall back to recent voices.
  - Covers `/api/podcast/my/items` 500 behavior when the selected source fails.
  - Covers `/api/weather/ip-location` successful IP location mapping and provider failure handling.
  - Covers `/api/weather/radio` coordinate-based Open-Meteo forecast mapping, rainy mood/radio construction, city-name geocoding, storm/night/wind mood shaping, snow-night mood shaping, mood-keyword search expansion, seed query search behavior, and fallback radio behavior when the weather provider fails.
  - Covers `/api/podcast/dj-beatmap` invalid audio URL validation, backend analysis failure responses, and intro empty-stream map responses.
  - Covers `/api/audio` missing-url validation, upstream failure responses, and range proxy behavior, including upstream status/header/body forwarding, QQ referer selection, and audio content-type inference from URL extension.
  - Covers `/api/audio` extension-based content-type inference for `.mp3`, `.m4a`, `.mp4`, `.ogg`, `.wav`, and upstream content-type fallback behavior.
  - Covers `/api/cover` invalid URL rejection before fetch, upstream failure responses, and image proxy behavior, including upstream status/header/body forwarding plus CORS/CORP/cache headers used by canvas extraction.
  - Covers static route fallback behavior for `/favicon.ico`, `/`, static JSON assets, and missing public files.
  - Covers `/api/discover/home` logged-out starter response without upstream requests, and logged-in aggregation of public/private playlists, low-signal-filtered podcasts, daily songs, user metadata, and cookie propagation.
- `tests/beatmap-cache-routes.test.js`
  - Covers `/api/beatmap/cache/status` reporting an enabled disk cache under a test-only temp directory.
  - Covers `/api/beatmap/cache` miss, compact write, safe hashed filename, metadata truncation, ignored field exclusion, hit readback, invalid payload rejection, and unsupported method handling.
  - Covers `/api/beatmap/cache` empty-key GET misses and overlong-key POST rejection before writing cache files.
  - Covers `/api/beatmap/cache` read/write memory-only fallback responses when the configured cache directory path is blocked by a regular file.
- `tests/dj-analyzer.test.js`
  - Covers `buildBeatMapFromLowEnergy()` empty-map behavior for short inputs, long flat inputs without usable onsets, and very large flat inputs that exercise percentile sampling without false beats.
  - Covers repeated low-energy pulse input producing a visual beat grid, including tempo range, beat/camera counts, kick time mapping, section step metadata, debug metadata, and beat contract ranges.
- `tests/dj-analyzer.test.js`
  - Covers `analyzePodcastDjStream()` rejecting invalid non-http(s) URLs before fetch and reporting upstream fetch failures with expected request headers.
  - Covers `analyzePodcastDjStream()` returning an empty full-stream map for empty decoded audio, including request headers and decode metadata.
  - Covers `analyzePodcastDjStream()` decoding a non-empty inline MP3 full-stream fixture with no network dependency, including request headers, skipped empty chunks, nonzero decoded sample/frame metadata, sample-rate metadata, and effective-duration selection.
  - Covers `analyzePodcastDjStream()` falling back from the 3300-7200 second quality full-stream path to range sampling when the initial full-stream fetch fails, including warning capture, request ordering, HEAD/range headers, and empty range beatmap output.
  - Covers `analyzePodcastDjStream()` selecting the long-podcast range sampling path from a `HEAD` content length, issuing eight ranged audio requests with expected headers, and returning an empty range beatmap when all sampled responses decode to no frames.
  - Covers `analyzePodcastDjStream()` falling back to full-stream analysis when long-podcast range metadata is unavailable from the `HEAD` request.
  - Covers `analyzePodcastDjStream()` aggregating eight decoded long-podcast range maps into a sampled beat grid with expected HEAD request headers, generated range options, beat contracts, section steps, profiles, and combined decode metadata.
  - Covers `analyzePodcastDjIntro()` returning partial intro map metadata for an empty decoded audio stream.
  - Covers `analyzePodcastDjIntro()` decoding a non-empty ranged intro stream with the existing inline MP3 fixture and mapping it into partial intro metadata.
- `dj-analyzer.js`
  - Exposes a test-only `__test` decode override when running under `NODE_ENV=test` or `tests/*.test.js`; production exports remain the three public analyzer functions.
- `tests/music-routes.test.js`
  - Covers `/api/login/status`, `/api/login/cookie`, and `/api/logout` for logged-out defaults, invalid cookie rejection, valid Netease cookie persistence/profile mapping, login_status-to-user_account fallback, invalid-auth cookie clearing, unexpected account lookup failure behavior, pending-profile cookie saves, and logout cookie clearing.
  - Covers `/api/login/cookie` accepting form-encoded cookie submissions through the shared request-body fallback parser.
  - Covers `/api/login/cookie` structured cookie inputs, including array recursion, `{ name, value }` items, nested `{ value }` fields, and cookie attribute filtering.
  - Covers `/api/login/qr/key`, `/api/login/qr/create`, and `/api/login/qr/check` for key retrieval, QR image/url creation, waiting status, successful auth retry, retry-warning profile fallback, cookie persistence, pending-profile fallback, provider errors, and profile mapping.
  - Covers `/api/user/playlists` logged-out empty response, logged-in playlist mapping, and logged-in provider failure responses.
  - Covers `/api/song/like/check` login requirement, direct liked-song checks, and fallback to `likelist`.
  - Covers `/api/song/like` toggling liked state for logged-in users.
  - Covers `/api/playlist/create` and `/api/playlist/add-song` logged-in success paths, including fallback from `playlist_tracks` to `playlist_track_add`.
  - Covers `/api/song/like/check`, `/api/song/like`, and `/api/playlist/create` validation and provider-error branches.
  - Covers `/api/playlist/add-song` missing playlist/song id validation before provider calls, failed `playlist_tracks` plus failed `playlist_track_add` attempts, fallback exceptions, and primary provider exceptions.
  - Covers `/api/song/comments` missing-id validation, first-page hot comment mapping, regular comment mapping on later pages, empty-content filtering, and provider failure responses.
  - Covers `/api/playlist/tracks` missing-id validation, track mapping from `playlist_track_all` `songs` and `tracks` payloads, fallback to `playlist_detail` when `playlist_track_all` fails, and 500 behavior when the fallback detail call fails.
  - Covers `/api/podcast/search`, `/api/podcast/hot`, `/api/podcast/detail`, and `/api/podcast/programs` upstream failure responses.
- `server.js`
  - Uses `defaultBeatMapCacheDir()`.
  - Disables Windows update channel on non-Windows preview builds via local fallback.
  - Delegates pure version/update helper behavior to `lib/version-utils.js` and `lib/update-utils.js`.
  - Skips automatic `server.listen()` when `NODE_ENV=test`, so route tests can exercise the HTTP handler without binding a local port.
  - Exposes `server.__test` only when `NODE_ENV=test`; this test hook can override update platform/manifest/auto-download/auto-patch, override Netease API functions for route tests, and reset update/music route state.
  - Exposes a test-only `requestText` override so QQ route tests can exercise success/error branches without real network access.
  - Resets in-memory QQ cookie and the request-text override in `resetMusicRuntime()` to prevent route tests from leaking state.
  - Classifies `UPDATE_SHA256_MISMATCH` / SHA-like update errors as file verification failures.
  - `/api/app/version` route metadata is now characterized by package/update config tests.
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
- `node --test tests/dj-analyzer.test.js`: passed, 14 tests.
- `node --test tests/beatmap-cache-routes.test.js`: passed, 4 tests.
- `node --test tests/music-routes.test.js`: passed, 127 tests.
- `node --test tests/update-utils.test.js`: passed, 13 tests.
- `node --test tests/version-utils.test.js`: passed, 2 tests.
- `node --test tests/update-routes.test.js`: passed, 21 tests.
- `npm test`: passed, 184 tests.
- `node --test --experimental-test-coverage tests/*.test.js`: passed, 184 tests; all-files line coverage 96.24%, branch coverage 68.71%, function coverage 92.62%; `server.js` line coverage 91.70%, branch coverage 60.65%, function coverage 90.07%; `lib/update-utils.js` line coverage 100.00%, function coverage 100.00%, branch coverage 74.47%; `dj-analyzer.js` line coverage 98.76%.
- Do not run `npm test` and `node --test --experimental-test-coverage tests/*.test.js` concurrently: update patch route tests share `public/.mineradio-patch-test.txt`, and parallel runs can race on that file. A concurrent run failed once with `ENOENT` in `/api/update/patch applies an allowed public file patch`; the same `npm test` passed when rerun serially.
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
- Update flow behavior is covered at helper level, including installer/archive/first-asset selection, patch matching/fallback, digest/name/url/note normalization, on the non-Windows preview route fallback path, on the Windows local/remote-manifest latest route paths, GitHub latest release fetching, latest.yml fallback, installer/patch job creation, installer cache reuse/invalid-cache handling, installer fake-download ready/sha256/sha512/size branches, installer HTTP fallback/all-fail branches, and patch application success/error branches.
- Music route behavior now has first-pass coverage for app version metadata, search, lyrics, Netease song URL/artist detail, discover home, QQ search/song URL/lyrics/login/status/logout/user playlists/playlist tracks/artist detail/song comments plus selected QQ failure/partial paths, podcast search/hot/detail/programs/my collections/my items plus partial/failure paths, podcast DJ beatmap route validation/failure/intro-empty success paths, weather ip-location/weather radio including rainy/storm-night/snow-night/fallback paths, audio/cover proxy success/failure/content-type behavior, login cookie/status/logout, QR login, user playlists, liked-song checks/toggles, playlist mutation, song comments, playlist tracks, static favicon/root page/JSON/missing-file behavior, and selected playlist/podcast error branches.
- `dj-analyzer.js` pure beat-map generation is covered for empty, large-flat, and pulse-grid paths, and wrapper failure/full-stream-empty/full-stream-non-empty/quality-fallback/empty-intro/non-empty-intro/empty-range/range-metadata-fallback/range-sampled-success paths have first-pass coverage; remaining uncovered analyzer lines are small numeric candidate/half-step fallback branches plus range decoder cancellation branches.
- Beatmap cache routes are covered on the normal disk-cache path, empty/overlong key boundaries, and a cache-dir-blocked memory-only fallback path; disabled-drive and deeper filesystem error paths remain untested.
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
   - `tests/music-routes.test.js`
   - `tests/version-utils.test.js`
   - `tests/update-utils.test.js`
6. Next implementation step: continue `server.js` long-tail non-UI branches reachable through existing test hooks. Prioritize deterministic route branches such as podcast collection item variants (`paid`, `liked` fallbacks), Netease song URL fallback/error paths, and selected route catch blocks. Treat remaining weather mood variants (`humid`, `cloudy`, `dusk`) carefully because `buildWeatherMood()` currently depends on `new Date()` unless a small production seam is introduced. Defer UI-heavy `public/index.html`.
