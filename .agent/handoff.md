# Mineradio Refactor Handoff

## Goal

Refactor Mineradio toward a typed, modular Electron music player while preserving current app behavior and macOS preview usability.

## Current Status

- Branch: `feat/macos-preview`
- Worktree: server shell finalization is in progress; latest verified slice extracts QQ request adapter wiring into `server/composition/qq-request-adapters.ts`.
- Current phase: root `server.js` compatibility shell slimming toward an extremely thin CommonJS shim.
- Active goal: make `server.js` an extremely thin CommonJS shim while preserving Electron/package entry, `module.exports`, `NODE_ENV=test` `__test`, API/update/login/playback/static behavior, and 100% production-code line coverage. Do not touch UI unless explicitly approved.
- Latest completed slice: Netease auth/library orchestration moved from controllers into `server/services/netease-auth-orchestration.ts` and `server/services/netease-library-orchestration.ts`; controllers now keep route matching, request parsing/validation, `sendJSON`, status mapping, and logging.
- Latest verification: `npm run build:ts && node --test tests/netease-auth-controller.test.js tests/netease-library-controller.test.js tests/netease-auth-orchestration-service.test.js tests/netease-library-orchestration-service.test.js` passed, 28 tests. `npm test && npm run coverage` passed, 542 tests; all files line coverage `100.00%`, including the two new Netease orchestration services.
- Latest completed slice: QQ session/auth orchestration moved into `server/services/qq-orchestration.ts` via `fetchQQLoginInfo(...)` and `loginWithQQCookie(...)`; `server.js` keeps `getQQLoginInfo()` as a lazy runtime DI wrapper and `server/controllers/qq-controller.ts` keeps `/api/qq/login/cookie` request parsing, invalid-cookie status mapping, and error fallback.
- Latest verification: `npm run build:ts && node --test tests/qq-orchestration-service.test.js tests/qq-controller.test.js tests/qq-composition.test.js tests/music-routes.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 173 tests. `npm test && npm run coverage` passed, 546 tests; all files line coverage `100.00%`, including `server-dist/server/services/qq-orchestration.js` and `server.js`.
- Latest completed slice: root HTTP route dispatch ordering moved from `server.js` into `server/root-dispatcher.ts`; `server.js` now injects the existing route handlers, context factories, dependency factories, static helpers, `NETEASE_SONG_URL_ROUTE`, and `rootDir`.
- Latest verification: `npm run build:ts && node --test tests/root-dispatcher.test.js tests/server-router.test.js tests/project-structure.test.js tests/music-routes.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 150 tests. `npm test && npm run coverage` passed, 555 tests; all files line coverage `100.00%`, including `server-dist/server/root-dispatcher.js` and `server.js`.
- Latest completed slice: root route dependency/context/handler assembly moved from `server.js` into `server/root-dependencies.ts`; `server.js` now keeps the runtime factory closures and passes them once into `createRootRouteDispatcherDependencies(...)`, while dispatcher route order remains in `server/root-dispatcher.ts`.
- Latest verification: initial RED `npm run build:ts && node --test tests/root-dependencies.test.js` failed with missing `../server-dist/server/root-dependencies`; focused/static `npm run build:ts && node --test tests/root-dependencies.test.js tests/root-dispatcher.test.js tests/server-router.test.js tests/project-structure.test.js tests/music-routes.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 152 tests. `npm test && npm run coverage` passed, 557 tests; all files line coverage `100.00%`, including `server-dist/server/root-dependencies.js`, `server-dist/server/root-dispatcher.js`, and `server.js`.
- Latest completed slice: route runtime dependency factory assembly moved from `server.js` into `server/root-runtime-factories.ts`; `server.js` now passes runtime getters/wrappers into `createRootRouteRuntimeFactories(...)`, preserving lazy `getNeteaseApi()` and `getFetch()` lookup semantics before wiring the result into `createRootRouteDispatcherDependencies(...)`.
- Latest verification: initial RED `npm run build:ts && node --test tests/root-runtime-factories.test.js` failed with missing `../server-dist/server/root-runtime-factories`; focused/static `npm run build:ts && node --test tests/root-runtime-factories.test.js tests/root-dependencies.test.js tests/root-dispatcher.test.js tests/music-routes.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 150 tests. `npm test && npm run coverage` passed, 559 tests; all files line coverage `100.00%`, including `server-dist/server/root-runtime-factories.js`, `server-dist/server/root-dependencies.js`, `server-dist/server/root-dispatcher.js`, and `server.js`.
- Latest completed slice: QQ request adapter wiring moved from `server.js` into `server/composition/qq-request-adapters.ts`; `server.js` now creates `qqRequestAdapters` and destructures the legacy low-level request/QQ helpers (`requestRuntime`, `requestText`, `requestJson`, `qqCookieObject`, `qqCookieUin`, `qqCookieMusicKey`, `qqCookiePlaybackKey`, `qqMusicRequest`, `getQQLoginInfo`, `qqGetJSON`, `qqSmartboxSearch`, `qqSongDetail`) instead of owning the QQ request-runtime and provider-request glue.
- Latest verification: initial RED `npm run build:ts && node --test tests/qq-request-adapters.test.js` failed with missing `../server-dist/server/composition/qq-request-adapters`; focused/static `npm run build:ts && node --test tests/qq-request-adapters.test.js tests/request-runtime.test.js tests/qq-controller.test.js tests/qq-composition.test.js tests/qq-orchestration-service.test.js tests/music-routes.test.js tests/simple-route-composition.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 180 tests. `npm test && npm run coverage` passed, 571 tests; all files line coverage `100.00%`, including `server-dist/server/composition/qq-request-adapters.js` and `server.js`.
- Server shell size after this slice: `server.js` is 693 lines, down from 780 before extracting QQ request adapter wiring.
- Next recommended slice: extract Netease/discover/weather/podcast root adapters or app/bootstrap/TLS composition, preserving lazy current cookies, Netease API overrides, `requestRuntime` test hooks, and `getFetch` behavior. Do not mark the extremely-thin-shim goal complete until `server.js` is only a compatibility entry that delegates to TS entry/composition.
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
- Stage 3 seventeenth slice is complete: `server/services/update-installer-download.ts` owns complete installer download runner behavior across candidates, stream writes, verification, final ready state, and failure aggregation.
- Stage 3 eighteenth slice is complete: `server/services/update-patch-runner.ts` owns patch candidate loop, BOM-safe JSON parsing, payload normalization, file writes, success state, and failure aggregation.
- Update domain extraction is complete at the service layer: `server.js` keeps thin update wrappers and route handlers, while update config/check/fetch/manifest/download/cache/job/patch/progress behavior lives under `server/services/update-*.ts`.
- Stage 3 nineteenth slice is complete: `server/services/cookie-session.ts` owns cookie normalization, raw cookie fallback, parse/serialize helpers, QQ UIN/key/profile helpers, and QQ cookie input normalization; `server.js` keeps thin wrappers for helpers that need the current in-memory `qqCookie`.
- Stage 3 twentieth slice is complete: `server/services/playback-restriction.ts` owns Netease/QQ playback restriction payload creation and classification; `server.js` imports the compiled service and route call sites keep the same function names.
- Stage 3 twenty-first slice is complete: `server/services/music-mapper.ts` owns pure Netease/QQ song mapping helpers (`mapArtists`, `mapSongRecord`, `qqAlbumCover`, `mapQQArtists`, `mapQQSmartSong`, `mapQQTrack`, `mapQQPlaylistTrack`); `server.js` keeps request flow, route handlers, and `qqSingerAvatar`.
- Stage 3 twenty-second slice is complete: `server/services/music-mapper.ts` also owns discover playlist, podcast radio, low-signal podcast filtering, and QQ playlist predicate helpers; `server.js` keeps request flow and route handlers.
- Stage 3 twenty-third slice is complete: `server/services/playback-quality.ts` owns Netease/QQ quality candidate tables, quality preference alias normalization, fallback candidate ordering, and Netease SVIP detection; `server.js` keeps playback URL orchestration.
- Stage 3 twenty-fourth slice is complete: `server/services/provider-response.ts` owns provider API code/message normalization helpers; `server.js` keeps login invalidation and playlist add-song orchestration.
- Stage 3 twenty-fifth slice is complete: `server/services/netease-session.ts` owns Netease VIP detection, login profile normalization, and auth-invalid payload detection; `server.js` keeps session fetch/orchestration.
- Stage 3 twenty-sixth slice is complete: `server/services/music-mapper.ts` now also owns pure podcast program, voice, collection-radio, collection-metadata, and response-array extraction helpers; `server.js` keeps API-backed podcast fetch orchestration.
- Stage 3 twenty-seventh slice is complete: `server/services/lyric-utils.ts` owns pure lyric text helpers (`decodeHtmlEntities`, `decodeQQLyricText`, `normalizeQQSongId`); `server.js` keeps QQ lyric API request/fallback orchestration.
- Stage 3 twenty-eighth slice is complete: `server/services/weather-utils.ts` owns pure weather helper logic (`clampNumber`, `openMeteoWeatherLabel`, `buildWeatherMood`); `server.js` keeps Open-Meteo/IP/weather-radio request and playlist orchestration.
- Stage 3 twenty-ninth slice is complete: `server/services/weather-utils.ts` now also owns pure weather-radio seed, fallback-weather payload, song low-signal filtering, scoring, dedupe, title/artist key, artist diversification, and final ordering helpers; `server.js` keeps weather provider and song-search orchestration.
- Stage 3 thirtieth slice is complete: `server/services/qq-utils.ts` owns pure QQ JSON/audio/playlist/comment helpers (`parseJSONText`, `audioProxyHeadersFor`, `audioContentTypeForUrl`, `mapQQPlaylist`, `mapQQComment`); `server.js` keeps QQ request/session/route orchestration, with `UA` explicitly injected into the audio proxy helper.
- Stage 3 thirty-first slice is complete: `server/services/beatmap-cache.ts` owns beatmap cache root checks, directory creation, safe cache filenames, compact payload serialization, cache reads, and atomic writes; `server.js` keeps the beatmap cache API routes and memory-only fallback response shapes.
- Stage 3 thirty-second slice is complete: `server/services/cookie-session.ts` now also owns QQ profile normalization; `server.js` keeps a thin wrapper that injects the current cookie object and `hasCookie` state for QQ login/session orchestration.
- Stage 3 thirty-third slice is complete: `server/services/request-client.ts` owns `requestText`/`requestJson` HTTP text/JSON helpers; `server.js` keeps the `requestTextOverride` hook and injects its wrapper into `requestJson` for unchanged test/runtime orchestration.
- Stage 3 thirty-fourth slice is complete: `server/services/weather-provider.ts` owns Open-Meteo geocoding/forecast and IP location provider mapping; `server.js` keeps thin URL/UA/default-location/requestJson wrappers while weather-radio song orchestration remains local.
- Stage 3 thirty-fifth slice is complete: `server/services/netease-session.ts` now also owns `readCookieFromResponse`; `server.js` imports the helper for QR login cookie extraction while keeping login/session orchestration local.
- Stage 3 thirty-sixth slice is complete: `server/services/netease-session.ts` now owns `getNeteaseLoginInfo` login-status/account fallback orchestration; `server.js` keeps a thin wrapper that injects current cookies, Netease API functions, cookie persistence, and logging.
- Stage 3 thirty-seventh slice is complete: `server/services/netease-session.ts` now owns pending Netease login profile fallback construction; `server.js` reuses it for cookie and QR login pending-profile responses.
- Stage 3 thirty-eighth slice is complete: `server/services/qq-utils.ts` now owns QQ singer avatar URL construction; `server.js` imports it for `/api/qq/artist/detail` fallback avatars.
- Stage 3 thirty-ninth slice is complete: `server/services/app-info.ts` owns package.json reading and empty fallback behavior; `server.js` keeps a thin path/fs wrapper for startup app metadata.
- Stage 3 fortieth slice is complete: `server/services/app-info.ts` now also owns `/api/app/version` response payload construction; `server.js` delegates the route response shape to `buildAppVersionPayload`.
- Stage 3 forty-first slice is complete: `server/services/qq-utils.ts` now owns QQ Musicu POST request construction and JSON parsing through `requestQQMusicJson`; `server.js` keeps a thin runtime-state wrapper that injects URL, headers, cookie, and `requestText`.
- Stage 3 forty-second slice is complete: `server/services/qq-utils.ts` now owns QQ GET JSON request URL/header/cookie construction and parsing through `requestQQGetJson`; `server.js` keeps a thin runtime-state wrapper around current QQ headers/cookie/requestText.
- Stage 3 forty-third slice is complete: `server/services/qq-utils.ts` now owns QQ profile homepage URL construction through `buildQQProfileUrl`; `server.js` uses it inside QQ login profile checking while keeping fallback/error orchestration local.
- Stage 3 forty-fourth slice is complete: `server/services/netease-session.ts` now owns Netease login readiness and `LOGIN_REQUIRED` payload helpers; `server.js` `requireLogin` delegates pure login requirement decisions while keeping HTTP response orchestration local.
- Stage 3 forty-fifth slice is complete: `server/services/qq-utils.ts` now owns QQ smartbox search URL construction, callback JSON parsing, limit clamping/defaulting, and smart-song mapping through `requestQQSmartboxSearch`; `server.js` keeps a thin runtime wrapper.
- Stage 3 forty-sixth slice is complete: `server/services/playback-quality.ts` now owns QQ vkey file candidate construction through `qqVkeyFileCandidates`; `server.js` keeps QQ vkey request/session/restriction response orchestration.
- Stage 3 forty-seventh slice is complete: `server/services/playback-restriction.ts` now owns QQ playback-unavailable response payload construction through `qqPlaybackUnavailablePayload`; `server.js` keeps QQ vkey request/session/success orchestration.
- Stage 3 forty-eighth slice is complete: `server/services/music-mapper.ts` now owns QQ search result dedupe/name filtering through `uniqueNamedQQSongs`; `server.js` keeps QQ smartbox/detail orchestration.
- Stage 3 forty-ninth slice is complete: `server/services/music-mapper.ts` now owns QQ user playlist merge/filter/dedupe/favorite ordering through `uniqueQQPlaylists`; `server.js` keeps QQ login and created/collected playlist request orchestration.
- Stage 3 fiftieth slice is complete: `server/services/qq-utils.ts` now owns QQ song comments page calculation, hot/normal comment selection, comment filtering, total fallback, and response payload construction through `buildQQSongCommentsPayload`; `server.js` keeps topid resolution and QQ comment request orchestration.
- Stage 3 fifty-first slice is complete: `server/services/music-mapper.ts` now owns podcast collection radio item filtering and liked voice item filtering through `mapPodcastCollectionRadios` and `mapPodcastVoiceItems`; `server.js` keeps podcast collection request/fallback orchestration.
- Stage 3 fifty-second slice is complete: `server/services/music-mapper.ts` now owns QQ playlist track filtering and playlist metadata payload construction through `buildQQPlaylistTracksPayload`; `server.js` keeps QQ playlist login, id validation, and detail request orchestration.
- Stage 3 fifty-third slice is complete: `server/services/music-mapper.ts` now owns Netease song comment hot/normal selection, comment mapping/filtering, total fallback, and response payload construction through `buildNeteaseSongCommentsPayload`; `server.js` keeps comment route validation and API request orchestration.
- Controller/router TS split first slice is complete: `server/controllers/app-controller.ts` now owns `/api/app/version` route handling through `handleAppRoutes`; `server.js` keeps the root compatibility entry and injects package/version/update dependencies.
- Controller/router TS split second slice is complete: `server/controllers/weather-controller.ts` now owns `/api/weather/radio` and `/api/weather/ip-location` route handling through `handleWeatherRoutes`; `server.js` keeps weather business helpers and injects them into the controller.
- Controller/router TS split third slice is complete: `server/controllers/podcast-controller.ts` now owns `/api/podcast/dj-beatmap` route handling through `handlePodcastRoutes`; the other podcast API routes remain in `server.js` for the next, larger podcast slice.
- Controller/router TS split fourth slice is complete: `server/controllers/podcast-controller.ts` now also owns public podcast routes (`/api/podcast/search`, `/api/podcast/hot`, `/api/podcast/detail`, `/api/podcast/programs`) through `handlePodcastPublicRoutes`; `/api/podcast/my` and `/api/podcast/my/items` remain in `server.js` for the authenticated podcast slice.
- Controller/router TS split fifth slice is complete: `server/controllers/podcast-controller.ts` now owns authenticated podcast routes (`/api/podcast/my`, `/api/podcast/my/items`) through `handlePodcastAuthenticatedRoutes`; all podcast routes now delegate through the TS podcast controller.
- Controller/router TS split sixth slice is complete: `server/controllers/media-controller.ts` now owns `/api/cover` and `/api/audio` streaming proxy route handling through `handleMediaRoutes`; `server.js` keeps the root compatibility entry and injects fetch, UA, audio header/content-type helpers, and logger.
- Controller/router TS split seventh slice is complete: `server/controllers/discover-controller.ts` now owns `/api/discover/home` route handling through `handleDiscoverRoutes`; `server.js` keeps the root compatibility entry and injects the existing discover orchestration helper, `sendJSON`, and logger.
- Controller/router TS split eighth slice is complete: `server/controllers/beatmap-controller.ts` now owns `/api/beatmap/cache/status` and `/api/beatmap/cache` route handling through `handleBeatmapRoutes`; `server.js` keeps the root compatibility entry and injects cache helpers, request-body reader, and `sendJSON`.
- Controller/router TS split ninth slice is complete: `server/controllers/update-controller.ts` now owns `/api/update/latest`, `/api/update/download`, `/api/update/download/status`, `/api/update/patch`, and `/api/update/patch/status` through `handleUpdateRoutes`; `server.js` keeps the root compatibility entry and injects update orchestration helpers, job map, `publicUpdateJob`, fallback builder, and logger.
- Controller/router TS split tenth slice is complete: `server/controllers/qq-controller.ts` now owns QQ routes (`/api/qq/search`, `/api/qq/song/url`, `/api/qq/lyric`, `/api/qq/login/status`, `/api/qq/login/cookie`, `/api/qq/logout`, `/api/qq/user/playlists`, `/api/qq/playlist/tracks`, `/api/qq/artist/detail`, `/api/qq/song/comments`) through `handleQQRoutes`; `server.js` keeps the root compatibility entry and injects QQ orchestration helpers, cookie/session helpers, request-body reader, `sendJSON`, and logger.
- Controller/router TS split eleventh slice is complete: `server/controllers/search-controller.ts` now owns `/api/search` through `handleSearchRoutes`; `server.js` keeps the root compatibility entry and injects `handleSearch`, `sendJSON`, and logger while preserving legacy query parsing and fallback response behavior.
- Controller/router TS split twelfth slice is complete: `server/controllers/netease-auth-controller.ts` now owns Netease auth/session routes (`/api/login/cookie`, `/api/login/qr/key`, `/api/login/qr/create`, `/api/login/qr/check`, `/api/login/status`, `/api/logout`) through `handleNeteaseAuthRoutes`; `server.js` keeps the root compatibility entry and injects cookie/session helpers, QR APIs, login normalization helpers, logout, clock, `sendJSON`, and logger.
- Controller/router TS split thirteenth slice is complete: `server/controllers/netease-library-controller.ts` now owns Netease library/write routes (`/api/user/playlists`, `/api/song/like/check`, `/api/song/like`, `/api/playlist/create`, `/api/playlist/add-song`) through `handleNeteaseLibraryRoutes`; `server.js` keeps the root compatibility entry and injects login helpers, current cookie getter, Netease write APIs, provider response normalizers, request-body reader, clock, `sendJSON`, and logger.
- Controller/router TS split fourteenth slice is complete: `server/controllers/netease-media-controller.ts` now owns Netease media/read routes (`/api/song/url`, `/api/lyric`, `/api/song/comments`, `/api/artist/detail`, `/api/playlist/tracks`) through `handleNeteaseMediaRoutes`; `server.js` keeps the root compatibility entry, preserves the early `/api/song/url` dispatch position, and injects current cookie getter, login helpers, Netease media APIs, mappers, comment payload builder, clock, `sendJSON`, and logger.
- Controller/router TS split is complete: API route business branches now live under `server/controllers/*.ts`; root `server.js` keeps controller ordering, dependency injection, runtime state, compatibility wrappers, and static fallback.
- Server composition/runtime cleanup first slice is complete: `server/runtime/update-runtime.ts` now owns update job Map state plus update platform/manifest/autoDownload/autoPatch test overrides; `server.js` keeps the original wrapper names and injects the runtime job Map into existing update services/controllers.
- Server composition/runtime cleanup second slice is complete: `server/runtime/cookie-runtime.ts` now owns Netease/QQ cookie initial file reads, save normalization/raw fallback, silent IO failure handling, and in-memory reset; `server.js` keeps compatibility `saveCookie`/`saveQQCookie` wrappers and reads current cookies through runtime getters.
- Server composition/runtime cleanup third slice is complete: `server/runtime/request-runtime.ts` now owns the test-only requestText override; `server.js` keeps `requestText` as the compatibility wrapper around the runtime and preserves `setRequestText`/`resetMusicRuntime` behavior.
- Server composition/runtime cleanup fourth slice is complete: `server/test-support/runtime.ts` now owns `buildServerTestRuntime(...)` for the legacy `module.exports.__test` compatibility object; `server.js` injects callbacks/helpers under the existing `NODE_ENV=test` guard and preserves the 15-key test surface/order.
- Server composition/runtime cleanup fifth slice is complete: `server/composition/netease-media-context.ts` now owns Netease media route context assembly; `server.js` keeps a single `createNeteaseMediaRouteDependencies()` factory so test-rebound Netease API functions are read lazily and both media controller call sites share the same dependency shape.
- Server composition/runtime cleanup sixth slice is complete: `server/composition/podcast-context.ts` now owns podcast route context assembly; `server.js` keeps a single `createPodcastRouteDependencies()` factory so test-rebound podcast APIs are read lazily while public/authenticated/beatmap podcast call sites share the same dependency shape.
- Server composition/runtime cleanup seventh slice is complete: `server/composition/qq-context.ts` now owns QQ route context assembly; `server.js` keeps `createQQRouteDependencies()` as a per-request pass-through dependency factory and the QQ route branch remains in the same position.
- Server composition/runtime cleanup eighth slice is complete: `server/composition/simple-route-contexts.ts` now owns app/discover/weather/search/media proxy route context assembly; `server.js` keeps per-request factories where runtime-overridable dependencies such as `fetch` must not be frozen.
- Server composition/runtime cleanup ninth slice is complete: `server/composition/ops-route-contexts.ts` now owns update/beatmap route context assembly; `server.js` injects the stable update job Map and beatmap cache dependencies through thin route context builders.
- Server composition/runtime cleanup tenth slice is complete: `server/composition/netease-auth-context.ts` and `server/composition/netease-library-context.ts` now own Netease auth/library route context assembly; `server.js` keeps per-request dependency factories so test-rebound Netease API functions are read lazily.
- Server runtime cleanup eleventh slice is complete: `server/runtime/app-config.ts` now owns app/server/path/update/weather/default-version configuration; `server.js` keeps the existing constant names by reading from `APP_CONFIG`.
- Server runtime cleanup twelfth slice is complete: `server/runtime/netease-api-runtime.ts` now owns the mutable NeteaseCloudMusicApi table used by `__test.setNeteaseApi`; `server.js` uses stable proxy functions so route/service dependencies read the latest overridden API without freezing references.
- Provider orchestration first slice is complete: `server/services/netease-orchestration.ts` now owns Netease search result mapping/cover-backfill orchestration and discover-home aggregation; `server.js` keeps thin `handleSearch`/`handleDiscoverHome` wrappers that inject current cookies, Netease API functions, mappers, clock, and logger.
- Provider orchestration second slice is complete: `server/services/netease-orchestration.ts` now owns authenticated podcast collection item orchestration for `collect`, `created`, `paid`, `liked`, and unknown keys; `server.js` keeps a thin `fetchMyPodcastItems` wrapper that injects current cookies, Netease API functions, mapper helpers, clock, and logger.
- Provider orchestration third slice is complete: `server/services/weather-orchestration.ts` now owns weather-radio provider fallback, seed search fan-out, mood-keyword top-up, ordering, and response assembly; `server.js` keeps a thin `buildWeatherRadio` wrapper that injects weather provider/search/order/default-location/clock/logger dependencies.
- Provider orchestration fourth slice is complete: `server/services/qq-orchestration.ts` now owns QQ search smartbox/detail enrichment, QQ user playlist created/collected fan-out and merge, and QQ playlist track detail payload orchestration; `server.js` keeps thin wrappers that inject current QQ login/request/mapping/dedupe helpers.
- Provider orchestration fifth slice is complete: `server/services/qq-orchestration.ts` now also owns QQ artist detail, QQ song comments, and QQ lyric read orchestration; `server.js` keeps thin wrappers that inject current QQ request/session/mapping/comment/lyric helpers.
- Provider orchestration sixth slice is complete: `server/services/netease-orchestration.ts` now owns Netease song URL, lyric, song comments, artist detail, and playlist track read orchestration; `server.js` keeps `handleSongUrl` as a thin wrapper and `server/controllers/netease-media-controller.ts` keeps route validation/HTTP response handling.
- User explicitly asked to keep handoff current to avoid context-compression drift.

## Latest Slice Verification

QQ request adapter extraction:

- Initial RED: `npm run build:ts && node --test tests/qq-request-adapters.test.js` failed with `Cannot find module '../server-dist/server/composition/qq-request-adapters'`.
- New composition module: `server/composition/qq-request-adapters.ts` exports `createQQRequestAdapters(...)`, which owns base `requestText` runtime creation, `requestJson`, lazy QQ cookie object/key helpers, QQ Musicu request, QQ GET JSON request, QQ smartbox search, QQ login-info dependency wiring, and QQ song-detail lookup.
- Root wiring: `server.js` now creates `qqRequestAdapters` with `http`, `https`, `userAgent`, `getQQCookie: () => currentQQCookie()`, and logger; it destructures the previous root helper names for existing QQ route/controller wiring and `__test.setRequestText`.
- Compatibility covered by tests: adapter key surface, lazy QQ cookie reads after cookie changes, `requestRuntime.setRequestText(...)` override semantics through `requestText`/`requestJson`, current-cookie provider request wiring, `includeCookie` behavior, QQ GET headers, smartbox request wiring, QQ login-info dependency wiring, and `qqSongDetail` missing-mid fallback plus map behavior.
- Focused/static verification: `npm run build:ts && node --test tests/qq-request-adapters.test.js tests/request-runtime.test.js tests/qq-controller.test.js tests/qq-composition.test.js tests/qq-orchestration-service.test.js tests/music-routes.test.js tests/simple-route-composition.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 180 tests.
- Final full verification: `npm test && npm run coverage` passed; 571 tests passed; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/composition/qq-request-adapters.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified `server.js` creates `qqRequestAdapters` and destructures the legacy request/QQ helper surface, the same `requestRuntime` still feeds `__test.setRequestText`/reset behavior, `requestText` remains override-aware for `requestJson` and QQ provider calls, QQ cookies are read lazily through `getQQCookie`, Musicu/GET/Smartbox/song-detail wiring preserves URL/header/cookie/includeCookie/map behavior, and focused validation passed independently.

Update runtime adapter extraction:

- Initial RED: `npm run build:ts && node --test tests/update-runtime-adapters.test.js` failed with `Cannot find module '../server-dist/server/composition/update-runtime-adapters'`.
- New composition module: `server/composition/update-runtime-adapters.ts` exports `createUpdateRuntimeAdapters(...)`, which owns the previous `server.js` update wrappers around latest-check, manifest, local fallback, download job, patch job, cache verification, invalid-file moves, timeout fetch, progress, and public job projection.
- Root wiring: `server.js` now creates `updateAdapters` with `fs`, `path`, `getFetch: () => fetch`, `rootDir`, update config/runtime, directories, patch max bytes, user agent, and logger; it destructures `updateDownloadJobs`, `publicUpdateJob`, `fetchLatestUpdateInfo`, `localUpdateFallback`, `startUpdateDownloadJob`, `startUpdatePatchJob`, and `moveInvalidUpdateFile` for the existing route/test wiring.
- Regression caught during focused integration: the first implementation captured `fetch` when the adapter was created, causing `tests/update-routes.test.js` to fail because test-time `global.fetch` replacement no longer affected update requests. The adapter now accepts `getFetch()` and reads it lazily for manifest/latest/download/patch paths.
- Compatibility covered by tests: `tests/update-runtime-adapters.test.js` asserts the adapter key surface, shared `updateRuntime.jobs` Map identity, platform/manifest lookup, mirror/preferMirrors injection, service wiring, and `autoDownload`/`autoPatch` delegation.
- Focused/static verification: `npm run build:ts && node --test tests/update-runtime-adapters.test.js tests/update-controller.test.js tests/update-routes.test.js tests/ops-route-composition.test.js tests/server-test-runtime.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 42 tests.
- Final full verification: `npm test && npm run coverage` passed; 567 tests passed; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/composition/update-runtime-adapters.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified `server.js` now creates `updateAdapters` and exposes the legacy update dependency names, `getFetch()` is used lazily so test-time `global.fetch` replacement is not frozen, `updateDownloadJobs` remains the same `updateRuntime.jobs` Map, download/patch/latest/fallback wiring retains real service dependencies, and focused/full validation passed independently.

Test runtime hook binding extraction:

- Initial RED: `npm run build:ts && node --test tests/server-test-runtime.test.js` failed with `createServerTestRuntimeBindings is not a function`.
- Extended support module: `server/test-support/runtime.ts` now exports `createServerTestRuntimeBindings(...)`, which wires `setNeteaseApi`, `setRequestText`, `resetMusicRuntime`, update override hooks, and helper passthroughs from injected runtime objects.
- Root wiring: `server.js` keeps the existing `NODE_ENV === 'test'` guard and `module.exports.__test = buildServerTestRuntime(...)`, but now obtains the dependency object from `createServerTestRuntimeBindings(...)` instead of hand-writing hook closures in the root shell.
- Compatibility covered by tests: legacy export order/name count remains unchanged; helpers pass through unchanged; `setNeteaseApi`, `setRequestText`, and update hooks delegate to their injected runtime objects; `resetMusicRuntime` preserves the order `neteaseApiRuntime.apply(undefined)`, `sessionRuntime.reset()`, `requestRuntime.reset()`.
- Focused/static verification: `npm run build:ts && node --test tests/server-test-runtime.test.js tests/netease-provider-runtime.test.js tests/session-runtime.test.js tests/request-runtime.test.js tests/update-runtime.test.js tests/music-routes.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 155 tests.
- Final full verification: `npm test && npm run coverage` passed; 565 tests passed; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/test-support/runtime.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified `module.exports.__test` remains under `NODE_ENV === 'test'`, `server.js` now only passes runtime objects/helper table into `createServerTestRuntimeBindings(...)`, reset order remains `neteaseApiRuntime.apply(undefined)`, `sessionRuntime.reset()`, `requestRuntime.reset()`, legacy export order is unchanged, and focused validation passed independently.

Cookie session facade runtime extraction:

- Initial RED: `npm run build:ts && node --test tests/session-runtime.test.js` failed with `Cannot find module '../server-dist/server/runtime/session-runtime'`.
- New runtime module: `server/runtime/session-runtime.ts` exports `createSessionRuntime(...)`, a typed facade over `CookieRuntime` that exposes the legacy root names `currentUserCookie`, `currentQQCookie`, `saveCookie`, `saveQQCookie`, and `reset`.
- Root wiring: `server.js` creates `sessionRuntime` from the existing `cookieRuntime`, destructures the same legacy function names used throughout root dependency wiring, and changes `__test.resetMusicRuntime` from `cookieRuntime.reset()` to `sessionRuntime.reset()`.
- Compatibility covered by tests: destructured session functions read the latest cookie state after saves, save calls delegate to the underlying cookie runtime without normalizing inside the facade, and reset delegates to the underlying cookie runtime.
- Focused/static verification: `npm run build:ts && node --test tests/session-runtime.test.js tests/cookie-runtime.test.js tests/root-runtime-factories.test.js tests/server-test-runtime.test.js tests/music-routes.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 152 tests.
- Final full verification: `npm test && npm run coverage` passed; 564 tests passed; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/runtime/session-runtime.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified `server.js` still creates one `cookieRuntime`, wraps it in `createSessionRuntime(cookieRuntime)`, destructured session functions remain dynamic function calls rather than frozen values, `resetMusicRuntime()` still resets Netease API, session/cookies, and request runtime, and normalization/read/write behavior remains in `cookie-runtime.ts`.

Netease provider runtime extraction:

- Initial RED: `npm run build:ts && node --test tests/netease-provider-runtime.test.js` failed with `Cannot find module '../server-dist/server/runtime/netease-provider-runtime'`.
- New runtime module: `server/runtime/netease-provider-runtime.ts` exports `createNeteaseProviderRuntime(...)`, returning the mutable `runtime` from `createNeteaseApiRuntime(...)` plus stable proxy functions under the legacy Netease API names.
- Root wiring: `server.js` imports `createNeteaseProviderRuntime(...)`, keeps `neteaseProvider.runtime` assigned to `neteaseApiRuntime` for the existing `__test.setNeteaseApi(...).apply(...)` path, and destructures all former proxy names from `neteaseProvider.api`.
- Compatibility covered by tests: stable proxy functions read the latest runtime API table after `runtime.apply(...)`; `like_song` calls provider key `like`; missing `like` throws `like_song is not a function`; proxy key order/name coverage matches the legacy `server.js` surface.
- Focused/static verification: `npm run build:ts && node --test tests/netease-provider-runtime.test.js tests/netease-api-runtime.test.js tests/root-runtime-factories.test.js tests/music-routes.test.js tests/netease-auth-controller.test.js tests/netease-library-controller.test.js tests/netease-media-controller.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 173 tests.
- Final full verification: `npm test && npm run coverage` passed; 562 tests passed; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/runtime/netease-provider-runtime.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified `server.js` keeps `neteaseProvider.runtime` as the `__test.setNeteaseApi` target, proxy functions read `runtime.current()` at call time so destructuring does not freeze default providers, `like_song` maps to provider `like` while preserving the legacy error display name, the 37 proxy keys match the old `server.js` list exactly, and full validation/coverage passed.

Netease read orchestration extraction:

- Initial REDs: `fetchNeteaseSongUrl` failed with `fetchNeteaseSongUrl is not a function`; `fetchNeteaseLyric` failed with `fetchNeteaseLyric is not a function`; `fetchNeteaseSongComments`, `fetchNeteaseArtistDetail`, and `fetchNeteasePlaylistTracks` each failed with the corresponding missing-function error.
- New service functions: `server/services/netease-orchestration.ts` exports `fetchNeteaseSongUrl(...)`, `fetchNeteaseLyric(...)`, `fetchNeteaseSongComments(...)`, `fetchNeteaseArtistDetail(...)`, and `fetchNeteasePlaylistTracks(...)`.
- Root/controller wrappers: `server.js` keeps `handleSongUrl(...)` as a dependency-injection wrapper around current cookie/API/quality/restriction helpers; `server/controllers/netease-media-controller.ts` now delegates lyric/comments/artist/playlist read orchestration to the service while preserving route matching, missing-id validation, `sendJSON`, and error handling.
- Service tests cover Netease song URL full playback, v1-to-legacy fallback, trial fallback, unavailable restriction metadata and last provider error; lyric_new success, legacy fallback, and lyric_new warning fallback; song comments payload; artist detail metadata, hot/top song fallback, detail/hot warnings; playlist_track_all success and playlist_detail fallback.
- Focused/static verification for song URL: `npm run build:ts && node --test tests/netease-orchestration-service.test.js tests/netease-media-controller.test.js tests/netease-media-composition.test.js tests/music-routes.test.js tests/playback-quality-service.test.js tests/playback-restriction-service.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 174 tests.
- Focused/static verification for all Netease read extraction: `npm run build:ts && node --test tests/netease-orchestration-service.test.js tests/netease-media-controller.test.js tests/netease-media-composition.test.js tests/music-routes.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 173 tests.
- Final full verification: `npm test && npm run coverage` passed; 532 tests passed; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/netease-orchestration.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified Netease song URL quality/SVIP/v1-to-legacy/trial/restriction/last-error behavior, thin `server.js` wrapper, unchanged HTTP validation/error handling in the controller, lyric/comments/artist/playlist response-shape parity, test coverage, and generated-file staging risk.

QQ artist-detail/song-comments/lyric read orchestration extraction:

- Initial REDs: artist service test failed with `fetchQQArtistDetail is not a function`; comments service test failed with `fetchQQSongComments is not a function`; lyric service test failed with `fetchQQLyric is not a function`.
- New service functions: `server/services/qq-orchestration.ts` exports `fetchQQArtistDetail(...)`, `fetchQQSongComments(...)`, and `fetchQQLyric(...)`; root `server.js` keeps `handleQQArtistDetail(...)`, `handleQQSongComments(...)`, and `handleQQLyric(...)` as dependency-injection wrappers around current QQ request/session/mapping/comment/lyric helpers.
- Service tests cover missing artist mid, artist limit clamp and song mapping, provider error and artist-name/avatar fallback, comment topid detail fallback failure, first-page hot comments, paged regular comments, lyric missing-id short circuit, decoded musicu lyric/trans/qrc/roma payloads, legacy lyric fallback, and double-failure `qq-empty` fallback.
- Focused/static verification: `npm run build:ts && node --test tests/qq-orchestration-service.test.js tests/qq-controller.test.js tests/music-routes.test.js tests/lyric-utils-service.test.js tests/qq-utils-service.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 181 tests.
- Wider focused/static verification: `npm run build:ts && node --test tests/qq-orchestration-service.test.js tests/qq-controller.test.js tests/qq-composition.test.js tests/music-routes.test.js tests/music-mapper-service.test.js tests/qq-utils-service.test.js tests/lyric-utils-service.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 195 tests.
- Sandbox `npm test` failed only for three request-client tests that need to bind `127.0.0.1` (`listen EPERM: operation not permitted 127.0.0.1`).
- Final full verification: `npm test && npm run coverage` passed in non-sandbox mode; 520 tests passed; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/qq-orchestration.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified the thin `server.js` wrappers, untouched QQ playback URL/payment path, service-level behavior parity for artist/comments/lyric, route/controller fallback coverage, focused validation, and noted that `server-dist/` is intentionally ignored but requires `npm run build:ts` before runtime/package use.

QQ search/user-playlist/playlist-track orchestration extraction:

- Initial RED: `npm run build:ts && node --test tests/qq-orchestration-service.test.js` failed with `Cannot find module '../server-dist/server/services/qq-orchestration'`.
- New service functions: `server/services/qq-orchestration.ts` exports `searchQQSongs(...)`, `fetchQQUserPlaylists(...)`, and `fetchQQPlaylistTracks(...)`; root `server.js` keeps `handleQQSearch(...)`, `handleQQUserPlaylists(...)`, and `handleQQPlaylistTracks(...)` as dependency-injection wrappers around current QQ login/request/mapping/dedupe helpers.
- Service tests cover blank search short-circuiting, QQ detail enrichment fallback, logged-out playlist defaults, created+collected playlist merge, created-list failure fallback, collected-list failure fallback, logged-out/missing playlist id defaults, and playlist track mapping.
- Focused/static verification: `npm run build:ts && node --test tests/qq-orchestration-service.test.js tests/qq-controller.test.js tests/qq-composition.test.js tests/music-routes.test.js tests/music-mapper-service.test.js tests/qq-utils-service.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 182 tests.
- Final full verification: `npm test && npm run coverage` passed in non-sandbox mode because request-client tests need to bind `127.0.0.1`; 510 tests passed; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/qq-orchestration.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified behavior parity for search, playlist login gates, `Promise.allSettled` playlist fan-out, missing playlist id, track mapping, test coverage, and generated-file staging risk. QA noted the opposite one-sided playlist failure case was optional; a collected-list failure test was added before final full verification.

Weather radio orchestration extraction:

- Initial RED: `npm run build:ts && node --test tests/weather-orchestration-service.test.js` failed with `Cannot find module '../server-dist/server/services/weather-orchestration'`.
- New service function: `server/services/weather-orchestration.ts` exports `buildWeatherRadio(...)`; root `server.js` keeps `buildWeatherRadio(...)` as a dependency-injection wrapper around weather provider, fallback helper, seed query helper, search, ordering, default location, clock, and logger.
- Service tests cover successful weather playlist construction from seed queries and mood keywords, `orderWeatherSongs(songs, mood)` invocation, provider failure fallback with warning and failed-search filtering, and song capping to 18 results.
- Focused/static verification: `npm run build:ts && node --test tests/weather-orchestration-service.test.js tests/weather-controller.test.js tests/weather-provider-service.test.js tests/weather-utils-service.test.js tests/music-routes.test.js tests/simple-route-composition.test.js && node --check server.js && npm run typecheck && git diff --check` passed, 161 tests.
- Final full verification: `npm run build:ts && node --test tests/weather-orchestration-service.test.js tests/weather-controller.test.js tests/music-routes.test.js && node --check server.js && npm run typecheck && git diff --check && npm test && npm run coverage` passed, 502 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/weather-orchestration.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified provider fallback/warn behavior, first-four seed queries, failed-search filtering via `Promise.allSettled`, mood-keyword top-up, ordering, 18-song cap, clock injection, root weather route wiring, and generated-file tracking. QA suggested an optional `orderWeatherSongs` spy assertion; that assertion was added before the final full verification.

Netease auth/library route dependency composition extraction:

- Initial RED: `npm run build:ts && node --test tests/netease-user-composition.test.js` failed with `Cannot find module '../server-dist/server/composition/netease-auth-context'`.
- `npm run build:ts && node --test tests/netease-user-composition.test.js tests/netease-auth-controller.test.js tests/netease-library-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 166 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test && npm run coverage`: passed, 482 tests; production-code line coverage `100.00%`, including `server.js`, `server-dist/server/composition/netease-auth-context.js`, and `server-dist/server/composition/netease-library-context.js` at `100.00%`.
- First QA subagent review: `NEEDS WORK`. Implementation behavior was accepted, but QA found the new composition test did not assert `ctx.url` binding and only sampled replaceable API function identity preservation.
- Follow-up test-only fix: `tests/netease-user-composition.test.js` now asserts `ctx.url` identity for both auth/library and all replaceable Netease API function references (`loginQrKey`, `loginQrCreate`, `loginQrCheck`, `logout`, `userPlaylist`, `songLikeCheck`, `likelist`, `likeSong`, `playlistCreate`, `playlistTracks`, `playlistTrackAdd`).
- QA subagent re-review: `PASS`. Read-only QA verified the test gaps were closed, route order stayed intact, dependency factories remain per-request, composition modules remain object-assembly-only with key order coverage, focused/static validation passed, and no generated-file staging risk.

Update/beatmap route dependency composition extraction:

- Initial RED: `npm run build:ts && node --test tests/ops-route-composition.test.js` failed with `Cannot find module '../server-dist/server/composition/ops-route-contexts'`.
- `npm run build:ts && node --test tests/ops-route-composition.test.js tests/update-controller.test.js tests/update-routes.test.js tests/beatmap-controller.test.js tests/beatmap-cache-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 50 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test && npm run coverage`: passed, 480 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/composition/ops-route-contexts.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified update and beatmap route order, stable `updateDownloadJobs` Map identity, dependency pass-through scope, composition-only behavior/key order in `ops-route-contexts.ts`, focused/static validation, and no generated-file staging risk.

Simple route dependency composition extraction:

- Initial RED: `npm run build:ts && node --test tests/simple-route-composition.test.js` failed with `Cannot find module '../server-dist/server/composition/simple-route-contexts'`.
- First focused run caught a real regression: a module-level media dependency object froze `fetch`, causing `/api/audio` and `/api/cover` integration tests to call real network instead of test stubs. Fixed by changing media assembly to `createMediaRouteDependencies()` and invoking it inside the request branch.
- `npm run build:ts && node --test tests/simple-route-composition.test.js tests/app-controller.test.js tests/discover-controller.test.js tests/weather-controller.test.js tests/search-controller.test.js tests/media-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 167 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test && npm run coverage`: passed, 479 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/composition/simple-route-contexts.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified app/discover/weather/search/media branch order, per-request `fetch` assembly through `createMediaRouteDependencies()`, composition-only behavior/key order in `simple-route-contexts.ts`, focused/static validation, and no generated-file staging risk.

QQ route dependency composition extraction:

- Initial RED: `npm run build:ts && node --test tests/qq-composition.test.js` failed with `Cannot find module '../server-dist/server/composition/qq-context'`.
- `npm run build:ts && node --test tests/qq-composition.test.js tests/qq-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 154 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test && npm run coverage`: passed, 478 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/composition/qq-context.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified QQ branch order/position, per-request dependency assembly through `createQQRouteDependencies()`, composition-only behavior in `createQQRouteContext()`, focused/static validation, and no generated-file staging risk.

Podcast route dependency composition extraction:

- Initial RED: `npm run build:ts && node --test tests/podcast-composition.test.js` failed with `Cannot find module '../server-dist/server/composition/podcast-context'`.
- `npm run build:ts && node --test tests/podcast-composition.test.js tests/podcast-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 163 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test && npm run coverage`: passed, 477 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/composition/podcast-context.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified public/authenticated/beatmap podcast route order and positions, lazy API rebinding through `createPodcastRouteDependencies()`, `userCookie` snapshot semantics in `createPodcastRouteContext()`, focused/static validation, and no generated-file staging risk.

Netease media route dependency composition extraction:

- Initial RED: `npm run build:ts && node --test tests/netease-media-composition.test.js` failed with `Cannot find module '../server-dist/server/composition/netease-media-context'`.
- First focused run caught a real regression: a module-level dependency object froze `lyric_new`/`artist_detail`/playlist function references before `__test.setNeteaseApi` could rebind them. Fixed by changing the root assembly to `createNeteaseMediaRouteDependencies()` and invoking it at each media controller dispatch.
- `npm run build:ts && node --test tests/netease-media-composition.test.js tests/netease-media-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 153 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test && npm run coverage`: passed, 476 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/composition/netease-media-context.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified `/api/song/url` early branch and later media/read branch kept their route positions, lazy API rebinding through `createNeteaseMediaRouteDependencies()`, composition-only behavior in `createNeteaseMediaRouteContext()`, focused/static validation, and no generated-file staging risk.

`__test` compatibility builder extraction:

- Initial RED: `npm run build:ts && node --test tests/server-test-runtime.test.js` failed because `buildServerTestRuntime` was not yet exported and `server.js` still assigned the literal `module.exports.__test` object.
- `npm run build:ts && node --test tests/server-test-runtime.test.js`: passed, 3 tests.
- `npm run build:ts && node --test tests/server-test-runtime.test.js tests/music-routes.test.js tests/update-routes.test.js tests/server-helpers.test.js`: passed, 180 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test && npm run coverage`: passed, 475 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/test-support/runtime.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified the legacy 15-key `__test` surface/order, hook delegation, helper exports, `server.js` thinning scope, and no generated-file staging risk.

Request runtime override extraction:

- Initial RED: `npm run build:ts && node --test tests/request-runtime.test.js` failed with `Cannot find module '../server-dist/server/runtime/request-runtime'`.
- `npm run build:ts && node --test tests/request-runtime.test.js tests/request-client-service.test.js tests/music-routes.test.js tests/qq-controller.test.js tests/weather-provider-service.test.js tests/server-test-runtime.test.js`: passed, 158 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test && npm run coverage`: passed, 474 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/runtime/request-runtime.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified override semantics (`opts || {}` with body), default delegation through `requestTextService(..., { http, https })`, `resetMusicRuntime()` resetting Netease API/cookie runtime/request override, requestJson/QQ/weather paths still flowing through the requestText wrapper, and no generated-file staging risk.

Cookie runtime state extraction:

- Initial RED: `npm run build:ts && node --test tests/cookie-runtime.test.js` failed with `Cannot find module '../server-dist/server/runtime/cookie-runtime'`.
- `npm run build:ts && node --test tests/cookie-runtime.test.js tests/music-routes.test.js tests/qq-controller.test.js tests/netease-auth-controller.test.js tests/server-test-runtime.test.js`: passed, 162 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test && npm run coverage`: passed, 472 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/runtime/cookie-runtime.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified startup trim reads, save normalization/raw fallback, silent IO failure behavior, no residual local mutable `let userCookie`/`let qqCookie` state in `server.js`, current-cookie reads across QQ/Netease/search/podcast/controller deps, `resetMusicRuntime()` clearing in-memory cookies without deleting files, and no generated-file staging risk.

Update runtime state extraction:

- Initial RED: `npm run build:ts && node --test tests/update-runtime.test.js` failed with `Cannot find module '../server-dist/server/runtime/update-runtime'`.
- `npm run build:ts && node --test tests/update-runtime.test.js tests/update-routes.test.js tests/update-controller.test.js tests/server-test-runtime.test.js`: passed, 39 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test && npm run coverage`: passed, 470 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/runtime/update-runtime.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified behavior-equivalent replacement of `updateRuntimeOverrides` and `updateDownloadJobs`, legacy `value !== false` semantics for auto flags, unchanged job Map injection into update services/controllers, reset clearing overrides plus jobs, and no generated-file staging risk.

Netease media/read controller route extraction:

- Initial RED: `npm run build:ts && node --test tests/netease-media-controller.test.js` failed with `Cannot find module '../server-dist/server/controllers/netease-media-controller'`.
- `npm run build:ts && node --test tests/netease-media-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 152 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test && npm run coverage`: passed, 468 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/controllers/netease-media-controller.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified behavior-equivalent migration of `/api/song/url`, `/api/lyric`, `/api/song/comments`, `/api/artist/detail`, and `/api/playlist/tracks`; confirmed `/api/song/url` remains at its original early dispatch point while the remaining read routes stay after Netease library and before media proxy; checked controller coverage for success, validation, fallback, provider-error, and unrelated-path behavior; and confirmed no generated files are staged.

Netease library controller route extraction:

- Initial RED: `npm run build:ts && node --test tests/netease-library-controller.test.js` failed with `Cannot find module '../server-dist/server/controllers/netease-library-controller'`.
- `npm run build:ts && node --test tests/netease-library-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 155 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test && npm run coverage`: passed, 462 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/controllers/netease-library-controller.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified route order, user-playlist mapping/fallback, like check direct/fallback/error behavior, like toggle and playlist-create parsing/validation/fallbacks, playlist add-song primary/fallback/status/attempt semantics, login-required early return, unrelated-path behavior, route descriptor coverage, and `node --check server.js`.

Netease auth controller route extraction:

- Initial RED: `npm run build:ts && node --test tests/netease-auth-controller.test.js` failed with `Cannot find module '../server-dist/server/controllers/netease-auth-controller'`.
- `npm run build:ts && node --test tests/netease-auth-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 155 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test && npm run coverage`: passed, 453 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/controllers/netease-auth-controller.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified route order, dependency injection, login cookie normalization/validation/save/pending fallback, QR key/create/check retry and pending-profile behavior, status/logout semantics, unrelated-path behavior, route descriptor coverage, and a read-only focused check with 11 passing tests.

Search controller route extraction:

- Initial RED: `npm run build:ts && node --test tests/search-controller.test.js` failed with `Cannot find module '../server-dist/server/controllers/search-controller'`.
- `npm run build:ts && node --test tests/search-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 151 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test && npm run coverage`: passed, 444 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/controllers/search-controller.js` at `100.00%`.
- QA subagent review: initial `FAIL` found a legacy `parseInt` radix behavior drift; fixed by restoring bare `parseInt` and adding a `limit=0x10` regression test. Re-review `PASS` verified route order, descriptor coverage, default/success/error/unrelated-path behavior, and the legacy parseInt regression.

QQ controller route extraction:

- Initial RED: `npm run build:ts && node --test tests/qq-controller.test.js` failed with `Cannot find module '../server-dist/server/controllers/qq-controller'`.
- `npm run build:ts && node --test tests/qq-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 153 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 439 tests.
- `npm run coverage`: passed, 439 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/controllers/qq-controller.js` at `100.00%`.
- Note: a parallel `npm test` + `npm run coverage` attempt caused transient update patch fixture interference; the same commands pass when run sequentially, so keep update patch tests serialized.
- QA subagent review: `PASS`. Read-only QA verified route order, root compatibility dependency injection, QQ search/song-url/lyric/login/logout/user-playlists/playlist-tracks/artist-detail/song-comments aliases, clamps, fallback semantics, unrelated-path behavior, and route descriptor coverage.

Update controller route extraction:

- Initial RED: `npm run build:ts && node --test tests/update-controller.test.js` failed with `Cannot find module '../server-dist/server/controllers/update-controller'`.
- `npm run build:ts && node --test tests/update-controller.test.js tests/update-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 39 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 432 tests.
- `npm run coverage`: passed, 432 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/controllers/update-controller.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified route order, latest fallback behavior, download/patch start semantics, installer and patch status lookup semantics, missing-job 404 behavior, ignored-path behavior, route descriptor coverage, and independently reran targeted/static validation with 39 passing tests.

Beatmap cache controller route extraction:

- Initial RED: `npm run build:ts && node --test tests/beatmap-controller.test.js` failed with `Cannot find module '../server-dist/server/controllers/beatmap-controller'`.
- `npm run build:ts && node --test tests/beatmap-controller.test.js tests/beatmap-cache-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 14 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 427 tests.
- `npm run coverage`: passed, 427 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/controllers/beatmap-controller.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified route order, status payload reason precedence, GET miss/hit/read-error payloads, POST body/write error payloads, unsupported-method 405 behavior, ignored-path behavior, route descriptor coverage, and noted the new controller/test files must be included in the commit.

Discover controller route extraction:

- Initial RED: `npm run build:ts && node --test tests/discover-controller.test.js` failed with `Cannot find module '../server-dist/server/controllers/discover-controller'`.
- `npm run build:ts && node --test tests/discover-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 149 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 421 tests.
- `npm run coverage`: passed, 421 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/controllers/discover-controller.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified route order, success/error fallback behavior, ignored-path behavior, controller tests, route descriptor coverage, and independently reran targeted/static validation with 149 passing tests.

Media controller route extraction:

- Initial RED: `npm run build:ts && node --test tests/media-controller.test.js` failed with `Cannot find module '../server-dist/server/controllers/media-controller'`.
- `npm run build:ts && node --test tests/media-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 151 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 418 tests.
- `npm run coverage`: passed, 418 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/controllers/media-controller.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified route order, cover/audio legacy URL/header/body/error semantics, ignored-path behavior, tests, route descriptor coverage, full tests, and coverage evidence.

Authenticated podcast controller route extraction:

- Initial RED: `npm run build:ts && node --test tests/podcast-controller.test.js` failed on the authenticated route tests with `false !== true`.
- `npm run build:ts && node --test tests/podcast-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 162 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 413 tests.
- `npm run coverage`: passed, 413 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/controllers/podcast-controller.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified route order, public and DJ beatmap delegates staying intact, `/api/podcast/my` and `/api/podcast/my/items` legacy login/default/summary/item/error semantics, all-wrapper order, controller tests, route descriptor coverage, full tests, and coverage evidence.

Public podcast controller route extraction:

- Initial RED: `npm run build:ts && node --test tests/podcast-controller.test.js` failed on the new public route tests with `false !== true`.
- `npm run build:ts && node --test tests/podcast-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 156 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 407 tests.
- `npm run coverage`: passed, 407 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/controllers/podcast-controller.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified public podcast route order, `/api/podcast/my` and `/api/podcast/my/items` staying in `server.js`, DJ beatmap still delegated at its original position, search/hot/detail/programs legacy params and fallback/error semantics, controller tests, route descriptor coverage, full tests, and coverage evidence.

Podcast DJ beatmap controller route extraction:

- Initial RED: `npm run build:ts && node --test tests/podcast-controller.test.js` failed with `Cannot find module '../server-dist/server/controllers/podcast-controller'`.
- `npm run build:ts && node --test tests/podcast-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 151 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 402 tests.
- `npm run coverage`: passed, 402 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/controllers/podcast-controller.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified route order, `/api/podcast/dj-beatmap`-only delegation, other podcast routes remaining in `server.js`, invalid URL short-circuit, duration/intro parsing, stream vs intro analyzer calls, logging, success/error payloads, ignored-path `false` behavior, route descriptor coverage, full tests, and coverage evidence.

Weather controller route extraction:

- Initial RED: `npm run build:ts && node --test tests/weather-controller.test.js` failed with `Cannot find module '../server-dist/server/controllers/weather-controller'`.
- `npm run build:ts && node --test tests/weather-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 151 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 397 tests.
- `npm run coverage`: passed, 397 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/controllers/weather-controller.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified route order, weather-only delegation, `city || q` query mapping, `lat`/`lon`/`timezone` preservation, success and error payload/status semantics, ignored-path `false` behavior, route descriptor coverage, targeted checks, full tests, and coverage evidence.

App controller route extraction:

- Initial RED: `npm run build:ts && node --test tests/app-controller.test.js` failed with `Cannot find module '../server-dist/server/controllers/app-controller'`.
- `npm run build:ts && node --test tests/app-controller.test.js tests/music-routes.test.js tests/project-structure.test.js tests/server-router.test.js`: passed, 148 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 392 tests.
- `npm run coverage`: passed, 392 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/controllers/app-controller.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified route order, `/api/app/version`-only delegation, ignored-path `false` behavior, direct payload forwarding, undefined status semantics, tests, route descriptor surface count, targeted checks, full tests, and coverage evidence.

Netease song comments payload helper extraction:

- Initial RED: `npm run build:ts && node --test tests/music-mapper-service.test.js` failed with `buildNeteaseSongCommentsPayload is not a function`.
- `npm run build:ts && node --test tests/music-mapper-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 157 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 390 tests.
- `npm run coverage`: passed, 390 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/music-mapper.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified route validation/request orchestration stayed in `server.js`, hot/normal selection, comment field mapping, content filtering, total/hot/body/id response shape, tests, and validation evidence.

QQ playlist tracks payload helper extraction:

- Initial RED: `npm run build:ts && node --test tests/music-mapper-service.test.js` failed with `buildQQPlaylistTracksPayload is not a function`.
- First GREEN attempt hit TypeScript `noImplicitAny` on the new helper's `filter` callback; root cause was the new callback parameter lacked an explicit type. Fixed by annotating the mapped track record.
- `npm run build:ts && node --test tests/music-mapper-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 156 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 389 tests.
- `npm run coverage`: passed, 389 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/music-mapper.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified QQ login/id/request orchestration stayed in `server.js`, `detail` fallback, track map/filter, playlist metadata fallbacks, response wrapper, tests, and validation evidence.

Podcast collection item mapper extraction:

- Initial RED: `npm run build:ts && node --test tests/music-mapper-service.test.js` failed with `mapPodcastCollectionRadios is not a function`.
- `npm run build:ts && node --test tests/music-mapper-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 155 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 388 tests.
- `npm run coverage`: passed, 388 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/music-mapper.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified `fetchMyPodcastItems` kept limit/offset clamping, collect/created/paid API requests, `firstArrayFrom` keys, liked sati/recent fallback, logs, unknown-key fallback, itemType values, and exact radio/voice map-filter behavior.

QQ song comments payload helper extraction:

- Initial RED: `npm run build:ts && node --test tests/qq-utils-service.test.js` failed with `buildQQSongCommentsPayload is not a function`.
- First GREEN attempt hit TypeScript `noImplicitAny` on the new helper's `filter` callback; root cause was the new callback parameter lacked an explicit type. Fixed by annotating the mapped comment record and removing the now-unused `mapQQComment` direct import from `server.js`.
- `npm run build:ts && node --test tests/qq-utils-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 154 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 388 tests.
- `npm run coverage`: passed, 388 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/qq-utils.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified topid resolution, detail fallback, missing-id response, QQ comment request params/Referer, page calculation, hot-comment selection, normal fallback, `mapQQComment` filtering, total fallback, and response shape remained behavior-preserving.

QQ playlist merge helper extraction:

- Initial RED: `npm run build:ts && node --test tests/music-mapper-service.test.js` failed with `uniqueQQPlaylists is not a function`.
- `npm run build:ts && node --test tests/music-mapper-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 155 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 387 tests.
- `npm run coverage`: passed, 387 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/music-mapper.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified created/collected requests, `Promise.allSettled`, `mapQQPlaylist`, and response shape remained unchanged; `uniqueQQPlaylists` preserves missing id/name filtering, duplicate-id first occurrence, Qzone background filtering, favorite playlist ordering, and non-favorite relative order.

QQ search dedupe helper extraction:

- Initial RED: `npm run build:ts && node --test tests/music-mapper-service.test.js` failed with `uniqueNamedQQSongs is not a function`.
- `npm run build:ts && node --test tests/music-mapper-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 154 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 386 tests.
- `npm run coverage`: passed, 386 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/music-mapper.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified the helper preserves the legacy `mid || id || name + '|' + artist` key, filters falsy/duplicate keys and empty names, keeps first occurrence, leaves QQ smartbox/detail/fallback orchestration unchanged, and has tests for `mid`/`id`/`name|artist` dedupe plus empty-name/null filtering.

QQ unavailable payload helper extraction:

- Initial RED: `npm run build:ts && node --test tests/playback-restriction-service.test.js` failed with `qqPlaybackUnavailablePayload is not a function`.
- `npm run build:ts && node --test tests/playback-restriction-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 149 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 385 tests.
- `npm run coverage`: passed, 385 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/playback-restriction.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified old payload shape, session semantics, scoped `server.js` replacement, partial-session test coverage, targeted checks, and full validation evidence. Non-blocking note: payload key order/exact key set is not asserted directly, but route tests and field assertions cover behavior.

QQ vkey file candidate helper extraction:

- Initial RED: `npm run build:ts && node --test tests/playback-quality-service.test.js` failed with `qqVkeyFileCandidates is not a function`.
- `npm run build:ts && node --test tests/playback-quality-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 148 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 384 tests.
- `npm run coverage`: passed, 384 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/playback-quality.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified normalized quality, mediaMid-first ordering, songmid dedupe, QQ template fallback, filename expansion, scoped `server.js` replacement, unused import removal, and validation evidence.

QQ smartbox search helper extraction:

- Initial RED: `npm run build:ts && node --test tests/qq-utils-service.test.js` failed with `requestQQSmartboxSearch is not a function`.
- First targeted run exposed a test fixture mismatch: the new test used `songname`/`singername`, but existing `mapQQSmartSong` only preserves `name`/`title` and `singer`; fixed the fixture without changing production logic.
- `npm run build:ts && node --test tests/qq-utils-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 153 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 383 tests.
- `npm run coverage`: passed, 383 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/qq-utils.js` at `100.00%`.
- QA subagent first review: `NEEDS WORK`. Production behavior was accepted, but QA correctly noted the test did not actually prove max/min limit clamping because the fixture had too few items.
- Follow-up test-only fix: expanded smartbox fixture to 12 items and asserted `limit: 99 -> 10`, `limit: 0 -> legacy default 6`, `limit: -1 -> 1`, and empty list fallback.
- QA subagent second review: `PASS`. Read-only QA verified the test gap was closed, diff stayed scoped to `server.js`, `server/services/qq-utils.ts`, and `tests/qq-utils-service.test.js`, targeted tests/static checks/full tests/coverage all passed.

Netease login requirement helper extraction:

- Initial RED: `npm run build:ts && node --test tests/netease-session-service.test.js` failed with `isNeteaseLoginReady is not a function`.
- `npm run build:ts && node --test tests/netease-session-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 152 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 382 tests.
- `npm run coverage`: passed, 382 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/netease-session.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified old `requireLogin` semantics, 401 payload shape, scoped diff, direct service tests, targeted checks, and no UI/unrelated changes. Residual note: QA did not rerun full coverage to avoid generated-file churn; main agent ran it serially and it passed.

QQ profile URL helper extraction:

- Initial RED: `npm run build:ts && node --test tests/qq-utils-service.test.js` failed with `buildQQProfileUrl is not a function`.
- `npm run build:ts && node --test tests/qq-utils-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 152 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 381 tests.
- `npm run coverage`: passed, 381 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/qq-utils.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified base URL and parameter insertion order, route call-site replacement only, unchanged `requestText` headers, unchanged `profileUnavailable`/catch fallback branches, exact URL test coverage, targeted test pass (`152/152`), and full `npm test` pass (`381/381`). Residual note: helper uses `String(uin || '')`, but current call site still guards falsy `uin` before calling it, so behavior is unchanged.

QQ GET JSON helper extraction:

- Initial RED: `npm run build:ts && node --test tests/qq-utils-service.test.js` failed with `requestQQGetJson is not a function`.
- `npm run build:ts && node --test tests/qq-utils-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 151 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 380 tests.
- `npm run coverage`: passed, 380 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/qq-utils.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified URL construction, query param null/undefined skipping, value stringification, header merge, cookie gating, `requestText` delegation, callback JSON parsing, compiled export availability, targeted test pass (`151/151`), full `npm test` pass (`380/380`), and scoped `git diff --check` pass. Residual note: runtime `server-dist` dependency remains an existing project build requirement covered by `npm run build:ts` and structure tests.

QQ Musicu request helper extraction:

- Initial RED: `npm run build:ts && node --test tests/qq-utils-service.test.js` failed with `requestQQMusicJson is not a function`.
- First GREEN verification found a TypeScript compile error: `Cannot find name 'Buffer'` in `server/services/qq-utils.ts`. Root cause: repo TS config intentionally avoids Node types; fixed using the existing service pattern `declare const Buffer: any`.
- `npm run build:ts && node --test tests/qq-utils-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 150 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 379 tests.
- `npm run coverage`: passed, 379 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/qq-utils.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified `requestQQMusicJson` preserves body serialization, header merging, byte-length content length, cookie gating, POST `requestText` delegation, callback JSON parsing, compiled export availability, targeted test pass (`150/150`), full `npm test` pass (`379/379`), and `git diff --check` pass. Residual note: QA observed `declare const Buffer: any`; this matches the repo's existing TS-without-Node-types pattern.

App version payload helper extraction:

- Initial RED: `npm run build:ts && node --test tests/app-info-service.test.js` failed with `buildAppVersionPayload is not a function`.
- `npm run build:ts && node --test tests/app-info-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 146 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 378 tests.
- `npm run coverage`: passed, 378 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/app-info.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified app version payload shape preservation, name/productName defaults, version injection, update metadata passthrough, `manifestOverride` truthiness, route delegation, helper tests, targeted test pass (`146/146`), `git diff --check`, `node --check server.js`, and optional full `npm test` pass (`378/378`). Residual note: QA observed `.agent/handoff.md` modified outside code/test diff; that documentation update is intentional for handoff continuity.

App package info helper extraction:

- Initial RED: `npm run build:ts && node --test tests/app-info-service.test.js` failed with `Cannot find module '../server-dist/server/services/app-info'`.
- `npm run build:ts && node --test tests/app-info-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 145 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 377 tests.
- `npm run coverage`: passed, 377 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/app-info.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified `readPackageInfoService` import, thin `server.js` path/fs wrapper, UTF-8 package read, `JSON.parse`, read/parse failure empty fallback, `/api/app/version` metadata continuity, and targeted test pass (`145/145`). Residual note: QA did not rerun optional full `npm test`; main agent ran full test and coverage serially and both passed.

QQ singer avatar helper extraction:

- Initial RED: `npm run build:ts && node --test tests/qq-utils-service.test.js` failed with `qqSingerAvatar is not a function`.
- `npm run build:ts && node --test tests/qq-utils-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 149 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 376 tests.
- `npm run coverage`: passed, 376 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/qq-utils.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified old helper body parity, import/call-site preservation, empty/default/explicit-size URL tests, targeted test pass (`149/149`), full `npm test` pass (`376/376`), and scoped static/diff checks. Residual note: QA observed `.agent/handoff.md` was modified outside the code/test diff; that documentation update is intentional for handoff continuity.

Netease pending login helper extraction:

- Initial RED: `npm run build:ts && node --test tests/netease-session-service.test.js` failed with `pendingNeteaseLoginInfo is not a function`.
- `npm run build:ts && node --test tests/netease-session-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 151 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 375 tests.
- `npm run coverage`: passed, 375 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/netease-session.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified response shape preservation, nickname/avatar fallback priority, `/api/login/cookie` no-body usage, `/api/login/qr/check` body usage, compiled export availability, targeted test pass (`151/151`), full `npm test` pass (`375/375`), and `git diff --check` pass. Residual note: QA observed `.agent/handoff.md` was modified outside the code/test diff; that documentation update is intentional for handoff continuity.

Netease login info flow extraction:

- Initial RED: `npm run build:ts && node --test tests/netease-session-service.test.js` failed with `getNeteaseLoginInfo is not a function`.
- `npm run build:ts && node --test tests/netease-session-service.test.js tests/music-routes.test.js tests/server-helpers.test.js tests/project-structure.test.js`: passed, 155 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 374 tests.
- `npm run coverage`: passed, 374 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/netease-session.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified no-cookie defaults/no deps calls, `login_status` before `user_account`, success short-circuit, warning arguments, account fallback options, auth-invalid `saveCookie('')`, fallback shapes, wrapper dependency injection, `setNeteaseApi` hook compatibility, and direct service branch coverage. Residual note: QA did not rerun coverage itself; main agent ran it serially and it passed.

Netease cookie response helper extraction:

- Initial RED: `npm run build:ts && node --test tests/netease-session-service.test.js` failed with `readCookieFromResponse is not a function`.
- `npm run build:ts && node --test tests/netease-session-service.test.js tests/music-routes.test.js tests/server-helpers.test.js tests/project-structure.test.js`: passed, 153 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 372 tests.
- `npm run coverage`: passed, 372 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/netease-session.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified candidate precedence (`resp.cookie`, `resp.body.cookie`, `resp.body.data.cookie`, `resp.body.data.cookies`), `normalizeCookieHeader` usage for each candidate, unchanged QR login success/retry call sites, direct/nested/object/empty service test coverage, compiled export, and no TS/circular-import risk. Residual note: QA did not rerun full `npm test`; main agent ran it serially and it passed.

Weather provider service extraction:

- Initial RED: `npm run build:ts && node --test tests/weather-provider-service.test.js` failed because `../server-dist/server/services/weather-provider` did not exist.
- `npm run build:ts && node --test tests/weather-provider-service.test.js tests/weather-utils-service.test.js tests/weather-mood.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 156 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 371 tests.
- First coverage run failed at `99.87%` because the migrated `resolveOpenMeteoLocation` wrapper in `server.js` was no longer called; verified no call sites remained and removed the dead wrapper/import instead of testing dead code.
- `npm run coverage`: passed, 371 tests; production-code line coverage `100.00%`, including `server.js` and `server-dist/server/services/weather-provider.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified blank/geocode/fallback location behavior, forecast coordinate/geocode branches, exact URL parameters and User-Agent headers, weather field mapping, precipitation fallback, deterministic `updatedAt`, mood construction, IP success/error metadata, `requestTextOverride` propagation through `requestJson`, and removal of only the unused `resolveOpenMeteoLocation` wrapper. Residual note: QA did not rerun coverage itself; main agent reran coverage serially and it passed.

Request client service extraction:

- Initial RED: `npm run build:ts && node --test tests/request-client-service.test.js` failed because `../server-dist/server/services/request-client` did not exist.
- `npm run build:ts && node --test tests/request-client-service.test.js tests/server-helpers.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 151 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 368 tests.
- `npm run coverage`: passed, 368 tests; production-code line coverage `100.00%`, including `server-dist/server/services/request-client.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified HTTP/HTTPS selection parity, method/header/body/chunk/error metadata/timeout/error-event/truthy-body behavior, JSON parse and invalid-JSON wrapping, `requestTextOverride` propagation through `requestJson`, and real local HTTP-server service tests. Residual note: focused tests do not explicitly exercise HTTPS, timeout, request error event, or falsy body non-write paths; QA confirmed these are direct behavioral extractions and full tests pass.

QQ profile normalization extraction:

- Initial RED: `npm run build:ts && node --test tests/cookie-session-service.test.js` failed with `normalizeQQProfile is not a function`.
- During GREEN, first coverage run failed at `99.90%` because the migrated logic left unused `qqCookieNickname`/`qqCookieAvatar` wrappers in `server.js`; verified no server call sites remained and removed the dead wrappers/imports.
- `npm run build:ts && node --test tests/cookie-session-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 150 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 366 tests.
- `npm run coverage`: passed, 366 tests; production-code line coverage `100.00%`, including `server-dist/server/services/cookie-session.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified parity for body/data/profile/creator/result extraction, creator/vipInfo fallback, profile vs cookie nickname/avatar priority, VIP source order and flag upgrade, logged-in/music-key rules, `hasCookie` injection, `playbackKeyReady`, `profileSource`, and unchanged `getQQLoginInfo`/QQ route flow.

Beatmap cache service extraction:

- Initial RED: `npm run build:ts && node --test tests/beatmap-cache-service.test.js` failed because `server-dist/server/services/beatmap-cache` did not exist.
- During GREEN, first `tsc` failed because the new service used ES Node imports and `NodeJS.ErrnoException` while the repo TS config intentionally avoids Node types; fixed by matching existing service style with `declare function require` and `any` error annotations.
- Coverage first failed at `99.90%` because unused `server.js` wrappers for `ensureBeatMapCacheDir` and `safeBeatMapCacheFile` remained; verified they were unreferenced and removed them rather than testing dead code.
- `npm run build:ts && node --test tests/beatmap-cache-service.test.js tests/beatmap-cache-routes.test.js tests/project-structure.test.js`: passed, 9 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 365 tests.
- `npm run coverage`: passed, 365 tests; production-code line coverage `100.00%`, including `server-dist/server/services/beatmap-cache.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified parity for root/drive availability, C-drive guard, directory creation, key length, SHA1 filename, label sanitize/truncate, payload metadata truncation/default mode, read malformed-map behavior, write temp/rename result and invalid errors, plus unchanged beatmap cache route response shapes and memory-only fallback.

QQ utility extraction:

- Initial RED: `npm run build:ts && node --test tests/qq-utils-service.test.js` failed because `server-dist/server/services/qq-utils` did not exist.
- `npm run build:ts && node --test tests/qq-utils-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 148 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 362 tests.
- `npm run coverage`: passed, 362 tests; production-code line coverage `100.00%`, including `server-dist/server/services/qq-utils.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified helper parity for callback JSON parsing, QQ/Netease audio referer/range/content-type behavior, playlist field priority, comment timestamp/user/likes mapping, unchanged `normalizeQQProfile` placement, no residual old helper definitions, and the `audioProxyHeadersFor(audioUrl, range, UA)` call site.

Weather radio helper extension:

- Initial RED: `npm run build:ts && node --test tests/weather-utils-service.test.js` failed because new exports such as `weatherRadioSeedQueries`, `isLowSignalWeatherSong`, and `orderWeatherSongs` were not functions.
- During GREEN, the new `orderWeatherSongs` test first expected `[1, 4, 5]`; failure showed actual `[1, 5, 4]`. Root cause: legacy `scoreWeatherSong` gives rain-mood bonus to `孙燕姿`, so the test expectation was corrected to `[1, 5, 4]` without changing production logic.
- `npm run build:ts && node --test tests/weather-utils-service.test.js tests/weather-mood.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 153 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 358 tests.
- `npm run coverage`: passed, 358 tests; production-code line coverage `100.00%`, including `server-dist/server/services/weather-utils.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified helper parity for seed buckets, fallback payload/default-location injection, low-signal regexes, score rules, title/artist keys, title dedupe, artist diversification, final ordering, unchanged `buildWeatherRadio` orchestration, direct service tests, and generated artifact tracking. Residual note: tests do not assert every full seed array or all fallback name-priority branches, but QA code comparison found equivalent copies.

Weather utility extraction:

- Initial RED: `npm run build:ts && node --test tests/weather-utils-service.test.js` failed because `server-dist/server/services/weather-utils` did not exist.
- `npm run build:ts && node --test tests/weather-utils-service.test.js tests/weather-mood.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 150 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 355 tests.
- `npm run coverage`: passed, 355 tests; production-code line coverage `100.00%`, including `server-dist/server/services/weather-utils.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified helper parity for `isNight` operator precedence, weather-code buckets, rain/snow/cloud/storm classification, feels fallback, morning/dusk/night/wind keyword adjustments, Set dedupe and `slice(0, 7)`, unchanged `server.js` weather API/radio orchestration, direct service tests, existing mood tests, and generated artifact tracking. Residual note: QA stayed read-only and did not rerun build/coverage; main agent ran those serially.

Lyric utility extraction:

- Initial RED: `npm run build:ts && node --test tests/lyric-utils-service.test.js` failed because `server-dist/server/services/lyric-utils` did not exist.
- `npm run build:ts && node --test tests/lyric-utils-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 147 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 352 tests.
- `npm run coverage`: passed, 352 tests; production-code line coverage `100.00%`, including `server-dist/server/services/lyric-utils.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified helper parity for entity decode order, `String(text || '')`, base64 detection, BOM stripping, Chinese/bracket acceptance, CRLF normalization, trimming, `normalizeQQSongId` legacy behavior, unchanged `server.js` QQ lyric orchestration, direct helper tests, and generated artifact tracking. Residual note: QA did not rerun full build/test/coverage because it stayed read-only; main agent ran those serially.

Podcast mapper helper extraction:

- Initial RED: `npm run build:ts && node --test tests/music-mapper-service.test.js` failed because `mapPodcastProgram` and `firstArrayFrom` were not exported.
- `npm run build:ts && node --test tests/music-mapper-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 153 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 349 tests.
- `npm run coverage`: passed, 349 tests; production-code line coverage `100.00%`, including `server-dist/server/services/music-mapper.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified helper parity, the subtle `mapPodcastVoice` fallback where `voiceListName` affects `artist` but not `album`/`radioName`, unchanged `server.js` podcast API orchestration, route coverage for podcast endpoints, and generated artifact tracking. Residual note: `mapPodcastProgram` explicit `fallbackRadio` path is mostly protected by exact-copy behavior rather than a dedicated new assertion.

Netease session helper extraction:

- Initial RED: `npm run build:ts && node --test tests/netease-session-service.test.js` failed because `server-dist/server/services/netease-session` did not exist.
- During GREEN, the new service test caught a mistaken expectation about zero ids; the test was corrected to preserve legacy `userId || ...` behavior: numeric `0` is swallowed by the chain, while string `"0"` remains a logged-in id.
- `npm run build:ts && node --test tests/netease-session-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 147 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 347 tests.
- `npm run coverage`: passed, 347 tests; production-code line coverage `100.00%`, including `server-dist/server/services/netease-session.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified VIP source/key/text/flag parity, login info `userId ||` legacy behavior, auth invalid rules, unchanged server.js call sites, direct service tests, route coverage, and generated artifact tracking. Note: QA briefly ran test/coverage concurrently and saw the known update temp-file false failure; serial reruns passed.

Provider response helper extraction:

- Initial RED: `npm run build:ts && node --test tests/provider-response-service.test.js` failed because `server-dist/server/services/provider-response` did not exist.
- `npm run build:ts && node --test tests/provider-response-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 146 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 344 tests.
- `npm run coverage`: passed, 344 tests; production-code line coverage `100.00%`, including `server-dist/server/services/provider-response.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified code/message precedence parity, unchanged login and playlist add-song call sites, direct service tests, route coverage, and generated artifact tracking.

Playback quality helper extraction:

- Initial RED: `npm run build:ts && node --test tests/playback-quality-service.test.js` failed because `server-dist/server/services/playback-quality` did not exist.
- `npm run build:ts && node --test tests/playback-quality-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 147 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 342 tests.
- `npm run coverage`: passed, 342 tests; production-code line coverage `100.00%`, including `server-dist/server/services/playback-quality.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified candidate table parity, alias/default behavior, fallback slicing, SVIP rules, unchanged server.js call sites, service tests, route coverage, and generated artifact tracking.

Music mapper list/filter helper extension:

- Initial RED: `npm run build:ts && node --test tests/music-mapper-service.test.js` failed because `mapDiscoverPlaylist` and `lowSignalText` were not exported.
- `npm run build:ts && node --test tests/music-mapper-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 151 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 339 tests.
- `npm run coverage`: passed, 339 tests; production-code line coverage `100.00%`, including `server-dist/server/services/music-mapper.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified playlist/radio fallback parity, low-signal and QQ/Qzone predicate parity, unchanged server.js call sites, direct service tests, route behavior coverage, and generated artifact tracking.

Music mapper helper extraction:

- Initial RED: `npm run build:ts && node --test tests/music-mapper-service.test.js` failed because `server-dist/server/services/music-mapper` did not exist.
- `npm run build:ts && node --test tests/music-mapper-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 149 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 337 tests.
- `npm run coverage`: passed, 337 tests; production-code line coverage `100.00%`, including `server-dist/server/services/music-mapper.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified Netease/QQ mapper parity, server.js call sites, `qqSingerAvatar` staying local, direct service tests, route-level coverage, TS build import path, and generated artifact tracking.

Previous playback restriction helper extraction:

- Initial RED: `npm run build:ts && node --test tests/playback-restriction-service.test.js` failed because `server-dist/server/services/playback-restriction` did not exist.
- `npm run build:ts && node --test tests/playback-restriction-service.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 148 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 332 tests.
- `npm run coverage`: passed, 332 tests; production-code line coverage `100.00%`, including `server-dist/server/services/playback-restriction.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified payload shape, Netease and QQ classification parity, server.js call sites, direct service tests, and TS build import path.

Previous cookie/session helper extraction:

- Initial RED: `npm run build:ts && node --test tests/cookie-session-service.test.js` failed because `server-dist/server/services/cookie-session` did not exist.
- `npm run build:ts && node --test tests/cookie-session-service.test.js tests/server-helpers.test.js tests/music-routes.test.js tests/project-structure.test.js`: passed, 154 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 328 tests.
- `npm run coverage`: passed, 328 tests; production-code line coverage `100.00%`, including `server-dist/server/services/cookie-session.js` at `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified cookie normalization parity, QQ helper parity, live `qqCookie` wrapper behavior, direct service tests, TS build output path, and generated artifact tracking.

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

Stage 3 update patch runner service slice:

- Initial RED: `npm run build:ts && node --test tests/update-patch-runner-service.test.js` failed because `server-dist/server/services/update-patch-runner` did not exist.
- Added `server/services/update-patch-runner.ts` for `downloadAndApplyPatchWithMirrors`.
- `server.js` now imports the compiled patch runner and injects `fs`, update download dir, candidate builder, single-candidate patch downloader, payload normalizer, patch file writer, error classifier, and job error setter.
- Added `tests/update-patch-runner-service.test.js` for candidate fallback, download dir creation, UTF-8 BOM removal before `JSON.parse`, payload normalization, file write aggregation, restart/non-restart success messages, candidate switching, final failure, and avoiding brittle V8 `JSON.parse` wording.
- First target run exposed an overly specific JSON parse message assertion; fixed the test to assert the legacy failure prefix and a JSON parse style reason without binding exact runtime text.
- `npm run build:ts && node --test tests/update-patch-runner-service.test.js tests/update-routes.test.js tests/project-structure.test.js`: passed, 35 tests.
- `node --check server.js`: passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- `npm test`: passed, 323 tests.
- `npm run coverage`: passed, 323 tests; production-code line coverage `100.00%`, branch coverage `72.57%`, function coverage `95.75%`; `server-dist/server/services/update-patch-runner.js` line coverage `100.00%`.
- QA subagent review: `PASS`. Read-only QA verified behavior parity, wrapper injection completeness, tests, generated artifact tracking, target validation, and full coverage.

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
   - Update domain service extraction is complete; move to the next non-update server domain or broader route handler splits.
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
