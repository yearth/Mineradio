// ====================================================================
//  粒子音乐可视化播放器 — Server v2
//  - 网易云搜索 / 歌曲URL / 封面/音频代理
//  - 扫码登录 (login_qr_*) + cookie 持久化 (./.cookie)
//  - 试听检测 (freeTrialInfo) + 全 quality 探测
//  - 所有受保护 API 都会带上已登录用户的 cookie
// ====================================================================
const neteaseApiDefaults = require('NeteaseCloudMusicApi');
const http = require('http');
const https = require('https');
const fs   = require('fs');
const path = require('path');
const tls = require('tls');
const { once } = require('events');
const { analyzePodcastDjStream, analyzePodcastDjIntro } = require('./dj-analyzer');
const { defaultBeatMapCacheDir } = require('./lib/platform-paths');
const {
  safeUpdateFileName,
} = require('./lib/update-utils');
const {
  createHttpServer,
  createRequestHandler,
  listenIfNeeded,
  readRequestBody,
  sendJson: sendJSON,
} = require('./server-dist/server/http-utils');
const {
  createCookieRuntime,
} = require('./server-dist/server/runtime/cookie-runtime');
const {
  createRequestRuntime,
} = require('./server-dist/server/runtime/request-runtime');
const {
  createUpdateRuntime,
} = require('./server-dist/server/runtime/update-runtime');
const {
  buildAppConfig,
} = require('./server-dist/server/runtime/app-config');
const {
  createNeteaseApiRuntime,
} = require('./server-dist/server/runtime/netease-api-runtime');
const {
  resolveStaticFilePath,
  serveStatic: serveStaticFile,
} = require('./server-dist/server/static-utils');
const {
  parseGitHubRepository,
  readUpdateConfig,
} = require('./server-dist/server/services/update-config');
const {
  buildMirrorUrl,
  uniqueDownloadCandidates: buildUniqueDownloadCandidates,
} = require('./server-dist/server/services/update-download-candidates');
const {
  normalizeManifestUpdateInfo: normalizeManifestUpdateInfoService,
} = require('./server-dist/server/services/update-manifest');
const {
  classifyUpdateError,
  updateError,
} = require('./server-dist/server/services/update-errors');
const {
  parseLatestYmlUpdateInfo: parseLatestYmlUpdateInfoService,
} = require('./server-dist/server/services/update-latest-yml');
const {
  decodePatchFile,
  normalizePatchPayload: normalizePatchPayloadService,
  patchTargetPath: patchTargetPathService,
  safePatchRelativePath,
} = require('./server-dist/server/services/update-patch-payload');
const {
  activeUpdateJobFor: activeUpdateJobForService,
  ensureMirrorCanBeVerified,
  prepareUpdateJobAttempt,
  publicUpdateJob,
  setUpdateJobError,
  trimUpdateJobs: trimUpdateJobsService,
} = require('./server-dist/server/services/update-job-runtime');
const {
  moveInvalidUpdateFile: moveInvalidUpdateFileService,
  reuseVerifiedInstallerJob: reuseVerifiedInstallerJobService,
  sha256Hex,
  verifyUpdateBuffer,
  verifyUpdateFile: verifyUpdateFileService,
} = require('./server-dist/server/services/update-file-cache');
const {
  startUpdateDownloadJob: startUpdateDownloadJobService,
  startUpdatePatchJob: startUpdatePatchJobService,
} = require('./server-dist/server/services/update-job-factory');
const {
  writePatchFile: writePatchFileService,
} = require('./server-dist/server/services/update-patch-apply');
const {
  installerProgress,
  patchProgress,
  speedBps: updateSpeedBps,
} = require('./server-dist/server/services/update-progress');
const {
  fetchTextFromCandidates: fetchTextFromCandidatesService,
  localUpdateFallback: localUpdateFallbackService,
} = require('./server-dist/server/services/update-fetch');
const {
  fetchManifestUpdateInfo: fetchManifestUpdateInfoService,
  readUpdateManifest: readUpdateManifestService,
} = require('./server-dist/server/services/update-manifest-source');
const {
  fetchLatestUpdateInfo: fetchLatestUpdateInfoService,
  fetchLatestYmlUpdateInfo: fetchLatestYmlUpdateInfoService,
} = require('./server-dist/server/services/update-check');
const {
  downloadPatchBufferFromCandidate: downloadPatchBufferFromCandidateService,
} = require('./server-dist/server/services/update-patch-download');
const {
  downloadUpdateAssetWithMirrors: downloadUpdateAssetWithMirrorsService,
} = require('./server-dist/server/services/update-installer-download');
const {
  downloadAndApplyPatchWithMirrors: downloadAndApplyPatchWithMirrorsService,
} = require('./server-dist/server/services/update-patch-runner');
const {
  normalizeApiCode,
  normalizeApiMessage,
} = require('./server-dist/server/services/provider-response');
const {
  getNeteaseLoginInfo,
  isNeteaseLoginReady,
  neteaseLoginRequiredPayload,
  normalizeLoginInfo,
  normalizeNeteaseVip,
  pendingNeteaseLoginInfo,
  readCookieFromResponse,
} = require('./server-dist/server/services/netease-session');
const {
  normalizeCookieHeader,
  normalizeQQCookieInput,
  normalizeQQProfile: normalizeQQProfileService,
  normalizeQQUin,
  parseCookieString,
  qqCookieMusicKey: qqCookieMusicKeyService,
  qqCookiePlaybackKey: qqCookiePlaybackKeyService,
  qqCookieUin: qqCookieUinService,
  rawCookieFallback,
} = require('./server-dist/server/services/cookie-session');
const {
  classifyNeteasePlaybackRestriction,
  playbackRestriction,
  qqPlaybackUnavailablePayload,
} = require('./server-dist/server/services/playback-restriction');
const {
  NETEASE_QUALITY_CANDIDATES,
  hasNeteaseSvip,
  normalizeQualityPreference,
  qualityCandidatesFrom,
  qqVkeyFileCandidates,
} = require('./server-dist/server/services/playback-quality');
const {
  firstArrayFrom,
  isLowSignalPodcastItem,
  buildNeteaseSongCommentsPayload,
  buildQQPlaylistTracksPayload,
  mapArtists,
  mapDiscoverPlaylist,
  mapPodcastCollectionRadios,
  mapPodcastProgram,
  mapPodcastRadio,
  mapPodcastVoiceItems,
  mapQQArtists,
  mapQQTrack,
  mapSongRecord,
  podcastCollectionMeta,
  qqAlbumCover,
  uniqueNamedQQSongs,
  uniqueQQPlaylists,
} = require('./server-dist/server/services/music-mapper');
const {
  buildDiscoverHome: buildDiscoverHomeService,
  fetchNeteaseSongUrl,
  fetchNeteasePodcastCollectionItems,
  searchNeteaseSongs,
} = require('./server-dist/server/services/netease-orchestration');
const {
  fetchQQArtistDetail,
  fetchQQPlaylistTracks: fetchQQPlaylistTracksService,
  fetchQQLyric,
  fetchQQSongComments,
  fetchQQUserPlaylists: fetchQQUserPlaylistsService,
  searchQQSongs,
} = require('./server-dist/server/services/qq-orchestration');
const {
  decodeHtmlEntities,
  decodeQQLyricText,
  normalizeQQSongId,
} = require('./server-dist/server/services/lyric-utils');
const {
  buildWeatherMood,
  fallbackWeatherForRadio,
  orderWeatherSongs,
  weatherRadioSeedQueries,
} = require('./server-dist/server/services/weather-utils');
const {
  fetchIpWeatherLocation: fetchIpWeatherLocationService,
  fetchOpenMeteoWeather: fetchOpenMeteoWeatherService,
} = require('./server-dist/server/services/weather-provider');
const {
  buildWeatherRadio: buildWeatherRadioService,
} = require('./server-dist/server/services/weather-orchestration');
const {
  audioContentTypeForUrl,
  audioProxyHeadersFor,
  buildQQProfileUrl,
  buildQQSongCommentsPayload,
  mapQQPlaylist,
  parseJSONText,
  requestQQGetJson,
  requestQQMusicJson,
  requestQQSmartboxSearch,
  qqSingerAvatar,
} = require('./server-dist/server/services/qq-utils');
const {
  beatCacheRootInfo: beatCacheRootInfoService,
  readBeatMapCache: readBeatMapCacheService,
  writeBeatMapCache: writeBeatMapCacheService,
} = require('./server-dist/server/services/beatmap-cache');
const {
  requestJson: requestJsonService,
  requestText: requestTextService,
} = require('./server-dist/server/services/request-client');
const {
  buildAppVersionPayload,
  readPackageInfo: readPackageInfoService,
} = require('./server-dist/server/services/app-info');
const {
  buildServerTestRuntime,
} = require('./server-dist/server/test-support/runtime');
const {
  createNeteaseMediaRouteContext,
} = require('./server-dist/server/composition/netease-media-context');
const {
  createNeteaseAuthRouteContext,
} = require('./server-dist/server/composition/netease-auth-context');
const {
  createNeteaseLibraryRouteContext,
} = require('./server-dist/server/composition/netease-library-context');
const {
  createPodcastRouteContext,
} = require('./server-dist/server/composition/podcast-context');
const {
  createQQRouteContext,
} = require('./server-dist/server/composition/qq-context');
const {
  createAppRouteContext,
  createDiscoverRouteContext,
  createWeatherRouteContext,
  createSearchRouteContext,
  createMediaRouteContext,
} = require('./server-dist/server/composition/simple-route-contexts');
const {
  createUpdateRouteContext,
  createBeatmapRouteContext,
} = require('./server-dist/server/composition/ops-route-contexts');
const {
  handleAppRoutes,
} = require('./server-dist/server/controllers/app-controller');
const {
  handleUpdateRoutes,
} = require('./server-dist/server/controllers/update-controller');
const {
  handleWeatherRoutes,
} = require('./server-dist/server/controllers/weather-controller');
const {
  handleDiscoverRoutes,
} = require('./server-dist/server/controllers/discover-controller');
const {
  handleBeatmapRoutes,
} = require('./server-dist/server/controllers/beatmap-controller');
const {
  handlePodcastAuthenticatedRoutes,
  handlePodcastBeatmapRoutes,
  handlePodcastPublicRoutes,
} = require('./server-dist/server/controllers/podcast-controller');
const {
  handleQQRoutes,
} = require('./server-dist/server/controllers/qq-controller');
const {
  handleSearchRoutes,
} = require('./server-dist/server/controllers/search-controller');
const {
  handleNeteaseAuthRoutes,
} = require('./server-dist/server/controllers/netease-auth-controller');
const {
  handleNeteaseLibraryRoutes,
} = require('./server-dist/server/controllers/netease-library-controller');
const {
  handleNeteaseMediaRoutes,
} = require('./server-dist/server/controllers/netease-media-controller');
const {
  handleMediaRoutes,
} = require('./server-dist/server/controllers/media-controller');

const APP_PACKAGE = readPackageInfo();
const APP_CONFIG = buildAppConfig({
  env: process.env,
  rootDir: __dirname,
  packageInfo: APP_PACKAGE,
  defaultBeatMapCacheDir,
});
const PORT = APP_CONFIG.port;
const HOST = APP_CONFIG.host;
const UA = APP_CONFIG.userAgent;
const COOKIE_FILE = APP_CONFIG.cookieFile;
const QQ_COOKIE_FILE = APP_CONFIG.qqCookieFile;
const UPDATE_WORK_DIR = APP_CONFIG.updateWorkDir;
const UPDATE_DOWNLOAD_DIR = APP_CONFIG.updateDownloadDir;
const UPDATE_PATCH_BACKUP_DIR = APP_CONFIG.updatePatchBackupDir;
const BEATMAP_CACHE_DIR = APP_CONFIG.beatmapCacheDir;
const NETEASE_SONG_URL_ROUTE = APP_CONFIG.neteaseSongUrlRoute;
const APP_VERSION = APP_CONFIG.appVersion;
const UPDATE_CONFIG = readUpdateConfig(APP_PACKAGE);
const PATCH_MAX_BYTES = APP_CONFIG.patchMaxBytes;
const UPDATE_FALLBACK_NOTES = APP_CONFIG.updateFallbackNotes;
const OPEN_METEO_FORECAST_URL = APP_CONFIG.openMeteoForecastUrl;
const OPEN_METEO_GEOCODE_URL = APP_CONFIG.openMeteoGeocodeUrl;
const WEATHER_IP_LOCATION_URL = APP_CONFIG.weatherIpLocationUrl;
const WEATHER_DEFAULT_LOCATION = APP_CONFIG.weatherDefaultLocation;

const neteaseApiRuntime = createNeteaseApiRuntime(neteaseApiDefaults);
function callNeteaseApi(name, args, displayName) {
  const fn = neteaseApiRuntime.current()[name];
  if (typeof fn !== 'function') throw new TypeError(`${displayName || name} is not a function`);
  return fn(...args);
}
const search = (...args) => callNeteaseApi('search', args);
const cloudsearch = (...args) => callNeteaseApi('cloudsearch', args);
const song_detail = (...args) => callNeteaseApi('song_detail', args);
const song_url = (...args) => callNeteaseApi('song_url', args);
const song_url_v1 = (...args) => callNeteaseApi('song_url_v1', args);
const login_qr_key = (...args) => callNeteaseApi('login_qr_key', args);
const login_qr_create = (...args) => callNeteaseApi('login_qr_create', args);
const login_qr_check = (...args) => callNeteaseApi('login_qr_check', args);
const login_status = (...args) => callNeteaseApi('login_status', args);
const logout = (...args) => callNeteaseApi('logout', args);
const user_account = (...args) => callNeteaseApi('user_account', args);
const user_playlist = (...args) => callNeteaseApi('user_playlist', args);
const comment_music = (...args) => callNeteaseApi('comment_music', args);
const artist_detail = (...args) => callNeteaseApi('artist_detail', args);
const artist_top_song = (...args) => callNeteaseApi('artist_top_song', args);
const artist_songs = (...args) => callNeteaseApi('artist_songs', args);
const like_song = (...args) => callNeteaseApi('like', args, 'like_song');
const likelist = (...args) => callNeteaseApi('likelist', args);
const song_like_check = (...args) => callNeteaseApi('song_like_check', args);
const playlist_tracks = (...args) => callNeteaseApi('playlist_tracks', args);
const playlist_track_add = (...args) => callNeteaseApi('playlist_track_add', args);
const playlist_create = (...args) => callNeteaseApi('playlist_create', args);
const playlist_detail = (...args) => callNeteaseApi('playlist_detail', args);
const playlist_track_all = (...args) => callNeteaseApi('playlist_track_all', args);
const personalized = (...args) => callNeteaseApi('personalized', args);
const recommend_resource = (...args) => callNeteaseApi('recommend_resource', args);
const recommend_songs = (...args) => callNeteaseApi('recommend_songs', args);
const dj_detail = (...args) => callNeteaseApi('dj_detail', args);
const dj_program = (...args) => callNeteaseApi('dj_program', args);
const dj_hot = (...args) => callNeteaseApi('dj_hot', args);
const dj_sublist = (...args) => callNeteaseApi('dj_sublist', args);
const user_audio = (...args) => callNeteaseApi('user_audio', args);
const dj_paygift = (...args) => callNeteaseApi('dj_paygift', args);
const record_recent_voice = (...args) => callNeteaseApi('record_recent_voice', args);
const sati_resource_sub_list = (...args) => callNeteaseApi('sati_resource_sub_list', args);
const lyric = (...args) => callNeteaseApi('lyric', args);
const lyric_new = (...args) => callNeteaseApi('lyric_new', args);

const updateRuntime = createUpdateRuntime();
const updateDownloadJobs = updateRuntime.jobs;

function applySystemCertificateAuthorities() {
  try {
    if (typeof tls.getCACertificates !== 'function' || typeof tls.setDefaultCACertificates !== 'function') return;
    const bundled = tls.getCACertificates('default') || [];
    const system = tls.getCACertificates('system') || [];
    if (!system.length) return;
    const seen = new Set();
    const merged = [];
    bundled.concat(system).forEach(cert => {
      if (!cert || seen.has(cert)) return;
      seen.add(cert);
      merged.push(cert);
    });
    if (merged.length > bundled.length) tls.setDefaultCACertificates(merged); /* node:coverage ignore next 3 */
  } catch (e) {
    console.warn('[TLS] system CA merge skipped:', e.message);
  }
}

applySystemCertificateAuthorities();

// ---------- Cookie 持久化 ----------
const cookieRuntime = createCookieRuntime({
  fs,
  userCookieFile: COOKIE_FILE,
  qqCookieFile: QQ_COOKIE_FILE,
  normalizeCookieHeader,
  rawCookieFallback,
});
function currentUserCookie() {
  return cookieRuntime.userCookie();
}
function currentQQCookie() {
  return cookieRuntime.qqCookie();
}
function saveCookie(c) {
  cookieRuntime.saveCookie(c);
}
function saveQQCookie(c) {
  cookieRuntime.saveQQCookie(c);
}

// ---------- 工具 ----------
function serveStatic(res, filePath) {
  return serveStaticFile(res, filePath, fs);
}
function readPackageInfo() {
  return readPackageInfoService(path.join(__dirname, 'package.json'), { fs });
}
function updateRuntimePlatform() {
  return updateRuntime.platform(process.platform);
}
function updateManifestRef() {
  return updateRuntime.manifest(UPDATE_CONFIG.manifest);
}
function uniqueDownloadCandidates(urls, opts) {
  opts = opts || {};
  return buildUniqueDownloadCandidates(urls, {
    ...opts,
    mirrors: UPDATE_CONFIG.mirrors || [],
    preferMirrors: UPDATE_CONFIG.preferMirrors,
  });
}
function normalizeManifestUpdateInfo(data) {
  return normalizeManifestUpdateInfoService(data, {
    currentVersion: APP_VERSION,
    fallbackNotes: UPDATE_FALLBACK_NOTES,
    uniqueDownloadCandidates,
  });
}
async function readUpdateManifest(ref) {
  return readUpdateManifestService(ref, {
    fs,
    path,
    fetch,
    userAgent: `Mineradio/${APP_VERSION}`,
  });
}
async function fetchManifestUpdateInfo(ref) {
  return fetchManifestUpdateInfoService(ref, {
    readManifest: readUpdateManifest,
    normalizeManifestUpdateInfo,
    localUpdateFallback,
  });
}
function beatCacheRootInfo() {
  return beatCacheRootInfoService(BEATMAP_CACHE_DIR);
}
function readBeatMapCache(key) {
  return readBeatMapCacheService(key, BEATMAP_CACHE_DIR);
}
function writeBeatMapCache(body) {
  return writeBeatMapCacheService(body, BEATMAP_CACHE_DIR);
}
function localUpdateFallback(reason, opts) {
  opts = opts || {};
  return localUpdateFallbackService(reason, {
    configured: opts.configured,
    preview: UPDATE_CONFIG.preview,
    currentVersion: APP_VERSION,
    fallbackNotes: UPDATE_FALLBACK_NOTES,
  });
}
async function fetchWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 12000);
  try {
    return await fetch(url, Object.assign({}, opts || {}, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}
async function fetchTextFromCandidates(candidates, timeoutMs) {
  return fetchTextFromCandidatesService(candidates, {
    timeoutMs,
    userAgent: `Mineradio/${APP_VERSION}`,
    fetchWithTimeout,
    classifyUpdateError,
  });
}
function parseLatestYmlUpdateInfo(text, reason) {
  return parseLatestYmlUpdateInfoService(text, reason, {
    currentVersion: APP_VERSION,
    owner: UPDATE_CONFIG.owner,
    repo: UPDATE_CONFIG.repo,
    uniqueDownloadCandidates,
  });
}
async function fetchLatestYmlUpdateInfo(reason) {
  return fetchLatestYmlUpdateInfoService(reason, {
    config: UPDATE_CONFIG,
    updateError,
    uniqueDownloadCandidates,
    fetchTextFromCandidates,
    parseLatestYmlUpdateInfo,
  });
}
async function fetchLatestUpdateInfo() {
  return fetchLatestUpdateInfoService({
    platform: updateRuntimePlatform,
    manifestRef: updateManifestRef,
    config: UPDATE_CONFIG,
    currentVersion: APP_VERSION,
    fallbackNotes: UPDATE_FALLBACK_NOTES,
    fetch,
    fetchManifestUpdateInfo,
    localUpdateFallback,
    fetchLatestYmlUpdateInfo,
    uniqueDownloadCandidates,
  });
}
function activeUpdateJobFor(version) {
  return activeUpdateJobForService(updateDownloadJobs, version);
}
function trimUpdateJobs() {
  trimUpdateJobsService(updateDownloadJobs);
}
function verifyUpdateFile(filePath, job) {
  return verifyUpdateFileService(filePath, job, { fs });
}
function moveInvalidUpdateFile(filePath, reason) {
  return moveInvalidUpdateFileService(filePath, reason, { fs, path, logger: console });
}
function reuseVerifiedInstallerJob(opts) {
  return reuseVerifiedInstallerJobService(opts, {
    fs,
    path,
    jobs: updateDownloadJobs,
    trimJobs: trimUpdateJobs,
    moveInvalid: moveInvalidUpdateFile,
  });
}
async function downloadUpdateAssetWithMirrors(job) {
  return downloadUpdateAssetWithMirrorsService(job, {
    fs,
    once,
    downloadDir: UPDATE_DOWNLOAD_DIR,
    userAgent: `Mineradio/${APP_VERSION}`,
    uniqueDownloadCandidates,
    ensureMirrorCanBeVerified,
    prepareUpdateJobAttempt,
    fetchWithTimeout,
    updateError,
    updateSpeedBps,
    installerProgress,
    verifyUpdateFile,
    classifyUpdateError,
    setUpdateJobError,
  });
}
function startUpdateDownloadJob(info) {
  return startUpdateDownloadJobService(info, {
    path,
    jobs: updateDownloadJobs,
    downloadDir: UPDATE_DOWNLOAD_DIR,
    safeUpdateFileName,
    uniqueDownloadCandidates,
    activeUpdateJobFor,
    publicUpdateJob,
    trimUpdateJobs,
    reuseVerifiedInstallerJob,
    runDownload: downloadUpdateAssetWithMirrors,
    autoDownload: updateRuntime.autoDownload(),
  });
}
function patchTargetPath(rel) {
  return patchTargetPathService(rel, __dirname);
}
function writePatchFile(job, file) {
  return writePatchFileService(job, file, {
    fs,
    path,
    backupDir: UPDATE_PATCH_BACKUP_DIR,
    patchTargetPath,
    safePatchRelativePath,
    decodePatchFile,
    sha256Hex,
    maxBytes: PATCH_MAX_BYTES,
  });
}
function normalizePatchPayload(payload) {
  return normalizePatchPayloadService(payload, { currentVersion: APP_VERSION });
}
async function downloadPatchBufferFromCandidate(job, candidate, index, total) {
  return downloadPatchBufferFromCandidateService(job, candidate, index, total, {
    patchMaxBytes: PATCH_MAX_BYTES,
    userAgent: `Mineradio/${APP_VERSION}`,
    ensureMirrorCanBeVerified,
    prepareUpdateJobAttempt,
    fetchWithTimeout,
    updateError,
    updateSpeedBps,
    patchProgress,
    verifyUpdateBuffer,
  });
}
async function downloadAndApplyPatchWithMirrors(job) {
  return downloadAndApplyPatchWithMirrorsService(job, {
    fs,
    downloadDir: UPDATE_DOWNLOAD_DIR,
    uniqueDownloadCandidates,
    downloadPatchBufferFromCandidate,
    normalizePatchPayload,
    writePatchFile,
    classifyUpdateError,
    setUpdateJobError,
  });
}
function startUpdatePatchJob(info) {
  return startUpdatePatchJobService(info, {
    path,
    jobs: updateDownloadJobs,
    downloadDir: UPDATE_DOWNLOAD_DIR,
    safeUpdateFileName,
    uniqueDownloadCandidates,
    publicUpdateJob,
    trimUpdateJobs,
    runPatch: downloadAndApplyPatchWithMirrors,
    autoPatch: updateRuntime.autoPatch(),
  });
}
function qqCookieObject() {
  return parseCookieString(currentQQCookie());
}
function qqCookieUin(obj) {
  return qqCookieUinService(obj || qqCookieObject());
}
function qqCookieMusicKey(obj) {
  return qqCookieMusicKeyService(obj || qqCookieObject());
}
function qqCookiePlaybackKey(obj) {
  return qqCookiePlaybackKeyService(obj || qqCookieObject());
}
async function requireLogin(res) {
  const info = await getLoginInfo();
  if (!isNeteaseLoginReady(info)) {
    sendJSON(res, neteaseLoginRequiredPayload(), 401);
    return null;
  }
  return info;
}

// ---------- 业务: 搜索 ----------
//   优先用 cloudsearch (新接口, 字段更全, picUrl 更稳定)
//   对于仍然缺失封面的歌曲, 用 song_detail 批量补齐
async function handleSearch(keywords, limit) {
  return searchNeteaseSongs(keywords, limit, {
    cloudsearch,
    songDetail: song_detail,
    getUserCookie: () => currentUserCookie(),
    mapSongRecord,
    logger: console,
  });
}

async function handleDiscoverHome() {
  return buildDiscoverHomeService({
    getLoginInfo,
    getUserCookie: () => currentUserCookie(),
    personalized,
    djHot: dj_hot,
    recommendResource: recommend_resource,
    recommendSongs: recommend_songs,
    mapDiscoverPlaylist,
    mapPodcastRadio,
    mapSongRecord,
    isLowSignalPodcastItem,
    now: Date.now,
  });
}

const QQ_MUSICU_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
const QQ_SMARTBOX_URL = 'https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg';
const QQ_HEADERS = {
  Referer: 'https://y.qq.com/',
  'User-Agent': UA,
};

function baseRequestText(targetUrl, opts, body) {
  return requestTextService(targetUrl, opts, body, { http, https });
}
const requestRuntime = createRequestRuntime({ requestText: baseRequestText });
function requestText(targetUrl, opts, body) {
  return requestRuntime.requestText(targetUrl, opts, body);
}

async function requestJson(targetUrl, opts, body) {
  return requestJsonService(targetUrl, opts, body, { requestText });
}

async function fetchOpenMeteoWeather(params) {
  return fetchOpenMeteoWeatherService(params, {
    defaultLocation: WEATHER_DEFAULT_LOCATION,
    forecastUrl: OPEN_METEO_FORECAST_URL,
    geocodeUrl: OPEN_METEO_GEOCODE_URL,
    requestJson,
    userAgent: UA,
  });
}

async function fetchIpWeatherLocation() {
  return fetchIpWeatherLocationService({
    defaultLocation: WEATHER_DEFAULT_LOCATION,
    ipLocationUrl: WEATHER_IP_LOCATION_URL,
    requestJson,
    userAgent: UA,
  });
}

async function buildWeatherRadio(params) {
  return buildWeatherRadioService(params, {
    fetchWeather: fetchOpenMeteoWeather,
    fallbackWeatherForRadio,
    weatherRadioSeedQueries,
    searchSongs: handleSearch,
    orderWeatherSongs,
    defaultLocation: WEATHER_DEFAULT_LOCATION,
    now: Date.now,
    logger: console,
  });
}

async function qqMusicRequest(payload, opts) {
  opts = opts || {};
  return requestQQMusicJson({
    payload,
    url: QQ_MUSICU_URL,
    baseHeaders: QQ_HEADERS,
    cookie: currentQQCookie(),
    includeCookie: !!opts.cookie,
    requestText,
  });
}

function normalizeQQProfile(body, cookieObj) {
  return normalizeQQProfileService(body, cookieObj || qqCookieObject(), !!currentQQCookie());
}

async function getQQLoginInfo() {
  const cookieObj = qqCookieObject();
  const uin = qqCookieUin(cookieObj);
  const musicKey = qqCookieMusicKey(cookieObj);
  if (!uin || !musicKey) return { provider: 'qq', loggedIn: false, hasCookie: !!currentQQCookie() };
  const fallback = normalizeQQProfile(null, cookieObj);
  try {
    const text = await requestText(buildQQProfileUrl(uin), {
      headers: { ...QQ_HEADERS, Cookie: currentQQCookie() },
    });
    const body = parseJSONText(text);
    const info = normalizeQQProfile(body, cookieObj);
    if (body && (body.code === 1000 || body.result === 301)) {
      return { ...fallback, profileUnavailable: true };
    }
    return info;
  } catch (e) {
    console.warn('[QQLogin] profile check failed:', e.message);
    return { ...fallback, profileUnavailable: true };
  }
}

async function qqGetJSON(targetUrl, params, opts) {
  opts = opts || {};
  return requestQQGetJson({
    url: targetUrl,
    params,
    baseHeaders: QQ_HEADERS,
    headers: opts.headers || {},
    cookie: currentQQCookie(),
    includeCookie: opts.cookie !== false,
    requestText,
  });
}

async function handleQQUserPlaylists() {
  return fetchQQUserPlaylistsService({
    getQQLoginInfo,
    qqGetJSON,
    mapQQPlaylist,
    uniqueQQPlaylists,
  });
}

async function handleQQPlaylistTracks(id) {
  return fetchQQPlaylistTracksService(id, {
    getQQLoginInfo,
    qqGetJSON,
    buildQQPlaylistTracksPayload,
  });
}

async function qqSmartboxSearch(keywords, limit) {
  return requestQQSmartboxSearch({
    keywords,
    limit,
    url: QQ_SMARTBOX_URL,
    headers: QQ_HEADERS,
    requestText,
  });
}

async function qqSongDetail(mid, fallback) {
  if (!mid) return fallback;
  const json = await qqMusicRequest({
    comm: { ct: 24, cv: 0 },
    songinfo: {
      module: 'music.pf_song_detail_svr',
      method: 'get_song_detail_yqq',
      param: { song_mid: mid },
    },
  });
  const data = json && json.songinfo && json.songinfo.data;
  return mapQQTrack(data && data.track_info, fallback);
}

async function handleQQArtistDetail(mid, limit) {
  return fetchQQArtistDetail(mid, limit, {
    qqMusicRequest,
    mapQQTrack,
    qqSingerAvatar,
  });
}

async function handleQQSearch(keywords, limit) {
  return searchQQSongs(keywords, limit, {
    qqSmartboxSearch,
    qqSongDetail,
    uniqueNamedQQSongs,
    logger: console,
  });
}

async function handleQQSongUrl(mid, mediaMid, qualityPreference) {
  const songmid = String(mid || '').trim();
  if (!songmid) return { provider: 'qq', url: '', error: 'MISSING_MID', message: 'Missing QQ song mid' };
  const guid = String(10000000 + Math.floor(Math.random() * 90000000));
  const cookieObj = qqCookieObject();
  const uin = qqCookieUin(cookieObj) || '0';
  const musicKey = qqCookieMusicKey(cookieObj);
  const playbackKey = qqCookiePlaybackKey(cookieObj);
  const { requestedQuality, fileCandidates, filenames } = qqVkeyFileCandidates(songmid, mediaMid, qualityPreference);
  const param = {
    guid,
    songmid: filenames.length ? filenames.map(() => songmid) : [songmid],
    songtype: filenames.length ? filenames.map(() => 0) : [0],
    uin,
    loginflag: 1,
    platform: '20',
  };
  if (filenames.length) param.filename = filenames;
  const comm = { uin, format: 'json', ct: musicKey ? 19 : 24, cv: 0 };
  if (musicKey) comm.authst = musicKey;
  const json = await qqMusicRequest({
    comm,
    req_0: {
      module: 'vkey.GetVkeyServer',
      method: 'CgiGetVkey',
      param,
    },
  }, { cookie: true });
  const data = json && json.req_0 && json.req_0.data;
  const infos = (data && Array.isArray(data.midurlinfo)) ? data.midurlinfo : [];
  const info = infos.find(item => item && item.purl) || infos[0];
  const purl = info && info.purl;
  if (purl) {
    const sip = (data.sip && data.sip[0]) || 'https://ws.stream.qqmusic.qq.com/';
    const fileMeta = fileCandidates.find(item => item.filename === info.filename) || {};
    return {
      provider: 'qq',
      url: sip + purl,
      trial: false,
      playable: true,
      level: fileMeta.level || info.filename || '',
      quality: fileMeta.label || info.filename || '',
      filename: info.filename || '',
      requestedQuality,
    };
  }
  return qqPlaybackUnavailablePayload({
    info,
    hasSession: !!(uin && musicKey),
    hasPlaybackKey: !!(uin && playbackKey),
    fileCandidates,
    requestedQuality,
  });
}

async function handleQQSongComments(id, mid, limit, offset) {
  return fetchQQSongComments(id, mid, limit, offset, {
    qqSongDetail,
    qqGetJSON,
    qqCookieUin,
    buildQQSongCommentsPayload,
    logger: console,
  });
}

async function handleQQLyric(mid, id) {
  return fetchQQLyric(mid, id, {
    qqMusicRequest,
    qqGetJSON,
    qqCookieUin,
    normalizeQQSongId,
    decodeQQLyricText,
    logger: console,
  });
}

async function fetchMyPodcastItems(key, info, limit, offset) {
  return fetchNeteasePodcastCollectionItems(key, info, limit, offset, {
    djSublist: dj_sublist,
    userAudio: user_audio,
    djPaygift: dj_paygift,
    satiResourceSubList: sati_resource_sub_list,
    recordRecentVoice: record_recent_voice,
    getUserCookie: () => currentUserCookie(),
    firstArrayFrom,
    mapPodcastCollectionRadios,
    mapPodcastVoiceItems,
    now: Date.now,
    logger: console,
  });
}

// ---------- 业务: 取歌曲URL (探测试听) ----------
//   返回 { url, trial, level, br }
//   trial=true 表示这是试听片段 (freeTrialInfo 非空)
async function handleSongUrl(id, loginInfo, qualityPreference) {
  return fetchNeteaseSongUrl(id, loginInfo, qualityPreference, {
    getUserCookie: () => currentUserCookie(),
    songUrlV1: song_url_v1,
    songUrl: song_url,
    normalizeQualityPreference,
    hasNeteaseSvip,
    qualityCandidatesFrom,
    qualityCandidates: NETEASE_QUALITY_CANDIDATES,
    classifyNeteasePlaybackRestriction,
    logger: console,
  });
}

// ---------- 业务: 登录态/用户信息 ----------
async function getLoginInfo() {
  return getNeteaseLoginInfo(currentUserCookie(), {
    loginStatus: login_status,
    saveCookie,
    userAccount: user_account,
    warn: console.warn,
  });
}

function createNeteaseMediaRouteDependencies() {
  return {
    sendJSON,
    getUserCookie: () => currentUserCookie(),
    getLoginInfo,
    handleSongUrl,
    lyricNew: lyric_new,
    lyric,
    commentMusic: comment_music,
    buildNeteaseSongCommentsPayload,
    artistDetail: artist_detail,
    artistSongs: artist_songs,
    artistTopSong: artist_top_song,
    playlistTrackAll: playlist_track_all,
    playlistDetail: playlist_detail,
    mapSongRecord,
    now: Date.now,
    logger: console,
  };
}

function createNeteaseAuthRouteDependencies() {
  return {
    sendJSON,
    readRequestBody,
    normalizeCookieHeader,
    parseCookieString,
    saveCookie,
    getUserCookie: () => currentUserCookie(),
    getLoginInfo,
    pendingNeteaseLoginInfo,
    loginQrKey: login_qr_key,
    loginQrCreate: login_qr_create,
    loginQrCheck: login_qr_check,
    readCookieFromResponse,
    normalizeLoginInfo,
    logout,
    now: Date.now,
    logger: console,
  };
}

function createNeteaseLibraryRouteDependencies() {
  return {
    sendJSON,
    readRequestBody,
    getLoginInfo,
    requireLogin,
    getUserCookie: () => currentUserCookie(),
    userPlaylist: user_playlist,
    songLikeCheck: song_like_check,
    likelist,
    likeSong: like_song,
    playlistCreate: playlist_create,
    playlistTracks: playlist_tracks,
    playlistTrackAdd: playlist_track_add,
    normalizeApiCode,
    normalizeApiMessage,
    now: Date.now,
    logger: console,
  };
}

function createPodcastRouteDependencies() {
  return {
    sendJSON,
    cloudsearch,
    djHot: dj_hot,
    djDetail: dj_detail,
    djProgram: dj_program,
    mapPodcastRadio,
    mapPodcastProgram,
    getLoginInfo,
    fetchMyPodcastItems,
    podcastCollectionMeta,
    analyzePodcastDjStream,
    analyzePodcastDjIntro,
    userAgent: UA,
    getUserCookie: () => currentUserCookie(),
    timestamp: Date.now,
    now: Date.now,
    logger: console,
  };
}

function createQQRouteDependencies() {
  return {
    sendJSON,
    readRequestBody,
    parseCookieString,
    normalizeQQCookieInput,
    qqCookieUin,
    qqCookieMusicKey,
    saveQQCookie,
    getQQLoginInfo,
    handleQQSearch,
    handleQQSongUrl,
    handleQQLyric,
    handleQQUserPlaylists,
    handleQQPlaylistTracks,
    handleQQArtistDetail,
    handleQQSongComments,
    logger: console,
  };
}

const appRouteDependencies = {
  sendJSON,
  packageInfo: APP_PACKAGE,
  appVersion: APP_VERSION,
  updateConfig: UPDATE_CONFIG,
  buildAppVersionPayload,
};

const updateRouteDependencies = {
  sendJSON,
  fetchLatestUpdateInfo,
  localUpdateFallback,
  updateConfig: UPDATE_CONFIG,
  startUpdateDownloadJob,
  startUpdatePatchJob,
  updateDownloadJobs,
  publicUpdateJob,
  logger: console,
};

const beatmapRouteDependencies = {
  sendJSON,
  readRequestBody,
  beatCacheRootInfo,
  readBeatMapCache,
  writeBeatMapCache,
};

function createDiscoverRouteDependencies() {
  return {
    sendJSON,
    handleDiscoverHome,
    logger: console,
  };
}

function createWeatherRouteDependencies() {
  return {
    sendJSON,
    buildWeatherRadio,
    fetchIpWeatherLocation,
    logger: console,
  };
}

function createSearchRouteDependencies() {
  return {
    sendJSON,
    handleSearch,
    logger: console,
  };
}

function createMediaRouteDependencies() {
  return {
    fetch,
    audioProxyHeadersFor,
    audioContentTypeForUrl,
    userAgent: UA,
    logger: console,
  };
}

// ====================================================================
//  HTTP Server
// ====================================================================
const server = createHttpServer({
  createServer: http.createServer.bind(http),
  requestHandler: createRequestHandler({
    port: PORT,
    handleRequest: async ({ req, res, url, pathname: pn }) => {

  if (await handleAppRoutes(createAppRouteContext(
    appRouteDependencies,
    { pathname: pn, res }
  ))) return;

  if (await handleUpdateRoutes(createUpdateRouteContext(
    updateRouteDependencies,
    { pathname: pn, url, res }
  ))) return;

  if (await handleBeatmapRoutes(createBeatmapRouteContext(
    beatmapRouteDependencies,
    { pathname: pn, url, req, res }
  ))) return;

  if (await handleDiscoverRoutes(createDiscoverRouteContext(
    createDiscoverRouteDependencies(),
    { pathname: pn, res }
  ))) return;

  if (await handleWeatherRoutes(createWeatherRouteContext(
    createWeatherRouteDependencies(),
    { pathname: pn, url, res }
  ))) return;

  if (await handleSearchRoutes(createSearchRouteContext(
    createSearchRouteDependencies(),
    { pathname: pn, url, res }
  ))) return;

  if (await handleQQRoutes(createQQRouteContext(
    createQQRouteDependencies(),
    { pathname: pn, url, req, res }
  ))) return;

  if (await handlePodcastPublicRoutes(createPodcastRouteContext(
    createPodcastRouteDependencies(),
    { pathname: pn, url, res }
  ))) return;

  if (await handlePodcastAuthenticatedRoutes(createPodcastRouteContext(
    createPodcastRouteDependencies(),
    { pathname: pn, url, res }
  ))) return;

  if (pn === NETEASE_SONG_URL_ROUTE && await handleNeteaseMediaRoutes(createNeteaseMediaRouteContext(
    createNeteaseMediaRouteDependencies(),
    { pathname: pn, url, res }
  ))) return;

  if (await handleNeteaseAuthRoutes(createNeteaseAuthRouteContext(
    createNeteaseAuthRouteDependencies(),
    { pathname: pn, url, req, res }
  ))) return;

  if (await handlePodcastBeatmapRoutes(createPodcastRouteContext(
    createPodcastRouteDependencies(),
    { pathname: pn, url, res }
  ))) return;

  if (await handleNeteaseLibraryRoutes(createNeteaseLibraryRouteContext(
    createNeteaseLibraryRouteDependencies(),
    { pathname: pn, url, req, res }
  ))) return;

  if (await handleNeteaseMediaRoutes(createNeteaseMediaRouteContext(
    createNeteaseMediaRouteDependencies(),
    { pathname: pn, url, res }
  ))) return;

  if (await handleMediaRoutes(createMediaRouteContext(
    createMediaRouteDependencies(),
    { pathname: pn, url, req, res }
  ))) return;

  // ---------- 静态资源 ----------
  serveStatic(res, resolveStaticFilePath(pn, __dirname));
    }
  })
});

listenIfNeeded({ /* node:coverage ignore next 7 */
  server,
  env: process.env,
  port: PORT,
  host: HOST,
  hasUserCookie: !!currentUserCookie(),
});

module.exports = server;
if (process.env.NODE_ENV === 'test') {
  const applyNeteaseApi = overrides => {
    neteaseApiRuntime.apply(overrides);
  };
  module.exports.__test = buildServerTestRuntime({
    setNeteaseApi: applyNeteaseApi,
    setRequestText: fn => requestRuntime.setRequestText(fn),
    helpers: {
      normalizeCookieHeader,
      rawCookieFallback,
      parseGitHubRepository,
      readUpdateConfig,
      requestText,
      moveInvalidUpdateFile,
      buildWeatherMood,
    },
    resetMusicRuntime() {
      applyNeteaseApi();
      cookieRuntime.reset();
      requestRuntime.reset();
    },
    setUpdatePlatform: value => updateRuntime.setPlatform(value),
    setUpdateManifest: value => updateRuntime.setManifest(value),
    setUpdateAutoDownload: value => updateRuntime.setAutoDownload(value),
    setUpdateAutoPatch: value => updateRuntime.setAutoPatch(value),
    resetUpdateRuntime: () => updateRuntime.reset(),
  });
}
