// ====================================================================
//  粒子音乐可视化播放器 — Server v2
//  - 网易云搜索 / 歌曲URL / 封面/音频代理
//  - 扫码登录 (login_qr_*) + cookie 持久化 (./.cookie)
//  - 试听检测 (freeTrialInfo) + 全 quality 探测
//  - 所有受保护 API 都会带上已登录用户的 cookie
// ====================================================================
const neteaseApiDefaults = require('NeteaseCloudMusicApi');
let {
  search,
  cloudsearch,
  song_detail,
  song_url,
  song_url_v1,
  login_qr_key,
  login_qr_create,
  login_qr_check,
  login_status,
  logout,
  user_account,
  user_playlist,
  comment_music,
  artist_detail,
  artist_top_song,
  artist_songs,
  like: like_song,
  likelist,
  song_like_check,
  playlist_tracks,
  playlist_track_add,
  playlist_create,
  playlist_detail,
  playlist_track_all,
  personalized,
  recommend_resource,
  recommend_songs,
  dj_detail,
  dj_program,
  dj_hot,
  dj_sublist,
  user_audio,
  dj_paygift,
  record_recent_voice,
  sati_resource_sub_list,
  lyric,
  lyric_new,
} = neteaseApiDefaults;
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

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const COOKIE_FILE = process.env.COOKIE_FILE || path.join(__dirname, '.cookie');
const QQ_COOKIE_FILE = process.env.QQ_COOKIE_FILE || path.join(__dirname, '.qq-cookie');
const UPDATE_WORK_DIR = process.env.MINERADIO_UPDATE_DIR || path.join(__dirname, 'updates');
const UPDATE_DOWNLOAD_DIR = process.env.MINERADIO_UPDATE_DOWNLOAD_DIR || path.join(UPDATE_WORK_DIR, 'downloads');
const UPDATE_PATCH_BACKUP_DIR = process.env.MINERADIO_PATCH_BACKUP_DIR || path.join(UPDATE_WORK_DIR, 'backups', 'patches');
const BEATMAP_CACHE_DIR = process.env.MINERADIO_BEAT_CACHE_DIR || defaultBeatMapCacheDir();
const NETEASE_SONG_URL_ROUTE = '/api/song/url';
const APP_PACKAGE = readPackageInfo();
const APP_VERSION = process.env.MINERADIO_VERSION || APP_PACKAGE.version || '0.9.11';
const UPDATE_CONFIG = readUpdateConfig(APP_PACKAGE);
const PATCH_MAX_BYTES = 12 * 1024 * 1024;
const UPDATE_FALLBACK_NOTES = [
  '电影镜头节奏更松',
  '音源失败自动换源',
  '右上角更新提示',
];
const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_IP_LOCATION_URL = 'http://ip-api.com/json/';
const WEATHER_DEFAULT_LOCATION = {
  name: '上海',
  country: 'China',
  latitude: 31.2304,
  longitude: 121.4737,
  timezone: 'Asia/Shanghai',
};

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
  console.log('[Search]', keywords, 'limit:', limit);
  const result = await cloudsearch({ keywords, limit, cookie: currentUserCookie() });
  const songs = result.body && result.body.result && result.body.result.songs ? result.body.result.songs : [];

  let mapped = songs.map(s => {
    return mapSongRecord(s);
  });

  // 兜底: 补齐缺失的封面
  const missing = mapped.filter(s => !s.cover).map(s => s.id);
  if (missing.length) {
    try {
      console.log('[Search] backfilling covers for', missing.length, 'songs');
      const dd = await song_detail({ ids: missing.join(','), cookie: currentUserCookie() });
      const songsArr = (dd.body && dd.body.songs) || [];
      const idToPic = {};
      songsArr.forEach(s => {
        const pic = (s.al && s.al.picUrl) || (s.album && s.album.picUrl) || '';
        if (pic) idToPic[s.id] = pic;
      });
      mapped = mapped.map(s => s.cover ? s : { ...s, cover: idToPic[s.id] || '' });
    } catch (e) { console.warn('[Search] backfill failed:', e.message); }
  }

  return mapped;
}

async function handleDiscoverHome() {
  const info = await getLoginInfo();
  const loggedIn = !!(info && info.loggedIn);
  if (!loggedIn) {
    return {
      loggedIn: false,
      user: null,
      dailySongs: [],
      playlists: [],
      podcasts: [],
      mode: 'starter',
      updatedAt: Date.now(),
    };
  }
  const tasks = [
    personalized({ limit: 8, cookie: currentUserCookie(), timestamp: Date.now() }),
    dj_hot({ limit: 6, offset: 0, cookie: currentUserCookie(), timestamp: Date.now() }),
    recommend_resource({ cookie: currentUserCookie(), timestamp: Date.now() }),
    recommend_songs({ cookie: currentUserCookie(), timestamp: Date.now() }),
  ];
  const result = await Promise.allSettled(tasks);

  const personalizedBody = result[0].status === 'fulfilled' && result[0].value && result[0].value.body || {};
  const publicPlaylists = (personalizedBody.result || personalizedBody.data || [])
    .map(pl => mapDiscoverPlaylist(pl, '推荐歌单'))
    .filter(pl => pl.id && pl.name)
    .slice(0, 8);

  const podcastBody = result[1].status === 'fulfilled' && result[1].value && result[1].value.body || {};
  const podcastRaw = podcastBody.djRadios || podcastBody.djradios || podcastBody.radios || podcastBody.data || [];
  const podcasts = (Array.isArray(podcastRaw) ? podcastRaw : [])
    .map(mapPodcastRadio)
    .filter(p => p.id && !isLowSignalPodcastItem(p))
    .slice(0, 6);

  let privatePlaylists = [];
  if (result[2].status === 'fulfilled' && result[2].value) {
    const body = result[2].value.body || {};
    const raw = body.recommend || body.data || [];
    privatePlaylists = (Array.isArray(raw) ? raw : [])
      .map(pl => mapDiscoverPlaylist(pl, '私人推荐'))
      .filter(pl => pl.id && pl.name)
      .slice(0, 6);
  }

  let dailySongs = [];
  if (result[3].status === 'fulfilled' && result[3].value) {
    const body = result[3].value.body || {};
    const raw = body.data && (body.data.dailySongs || body.data.recommend) || body.recommend || [];
    dailySongs = (Array.isArray(raw) ? raw : [])
      .map(mapSongRecord)
      .filter(song => song.id && song.name)
      .slice(0, 12);
  }

  return {
    loggedIn,
    user: loggedIn ? { userId: info.userId, nickname: info.nickname || '', avatar: info.avatar || '' } : null,
    dailySongs,
    playlists: privatePlaylists.concat(publicPlaylists).slice(0, 10),
    podcasts,
    updatedAt: Date.now(),
  };
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
  let weather;
  try {
    weather = await fetchOpenMeteoWeather(params);
  } catch (e) {
    console.warn('[WeatherRadio] weather provider failed, using fallback radio:', e.message);
    weather = fallbackWeatherForRadio(params, e, WEATHER_DEFAULT_LOCATION);
  }
  const queries = weatherRadioSeedQueries(weather.mood);
  let songs = [];
  const settled = await Promise.allSettled(queries.slice(0, 4).map(q => handleSearch(q, 6)));
  settled.forEach(result => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) songs = songs.concat(result.value);
  });
  if (songs.length < 10 && weather.mood && Array.isArray(weather.mood.keywords)) {
    const more = await Promise.allSettled(weather.mood.keywords.slice(0, 2).map(q => handleSearch(q, 6)));
    more.forEach(result => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) songs = songs.concat(result.value);
    });
  }
  songs = orderWeatherSongs(songs, weather.mood);
  return {
    ok: true,
    weather,
    radio: {
      title: weather.mood.title,
      subtitle: weather.mood.tagline,
      seedQueries: queries.slice(0, 4),
      songs: songs.slice(0, 18),
      updatedAt: Date.now(),
    },
  };
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
  const info = await getQQLoginInfo();
  if (!info.loggedIn || !info.userId) return { loggedIn: false, provider: 'qq', playlists: [] };
  const uin = info.userId;
  const createdReq = qqGetJSON('https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss', {
    hostUin: 0,
    hostuin: uin,
    sin: 0,
    size: 200,
    g_tk: 5381,
    loginUin: uin,
    format: 'json',
    inCharset: 'utf8',
    outCharset: 'utf-8',
    notice: 0,
    platform: 'yqq.json',
    needNewCode: 0,
  }, { headers: { Referer: 'https://y.qq.com/portal/profile.html' } });
  const collectReq = qqGetJSON('https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg', {
    ct: 20,
    cid: 205360956,
    userid: uin,
    reqtype: 3,
    sin: 0,
    ein: 80,
  }, { headers: { Referer: 'https://y.qq.com/portal/profile.html' } });
  const [createdRaw, collectRaw] = await Promise.allSettled([createdReq, collectReq]);
  const created = createdRaw.status === 'fulfilled' && createdRaw.value && createdRaw.value.data && Array.isArray(createdRaw.value.data.disslist)
    ? createdRaw.value.data.disslist.map(pl => mapQQPlaylist(pl, 'created')) : [];
  const collected = collectRaw.status === 'fulfilled' && collectRaw.value && collectRaw.value.data && Array.isArray(collectRaw.value.data.cdlist)
    ? collectRaw.value.data.cdlist.map(pl => mapQQPlaylist(pl, 'collect')) : [];
  const playlists = uniqueQQPlaylists(created.concat(collected));
  return { loggedIn: true, provider: 'qq', userId: uin, playlists };
}

async function handleQQPlaylistTracks(id) {
  const info = await getQQLoginInfo();
  if (!info.loggedIn || !info.userId) return { loggedIn: false, provider: 'qq', tracks: [] };
  const pid = String(id || '').trim();
  if (!pid) return { loggedIn: true, provider: 'qq', error: 'Missing QQ playlist id', tracks: [] };
  const result = await qqGetJSON('https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg', {
    type: 1,
    utf8: 1,
    disstid: pid,
    loginUin: info.userId,
    format: 'json',
    inCharset: 'utf8',
    outCharset: 'utf-8',
    notice: 0,
    platform: 'yqq.json',
    needNewCode: 0,
  }, { headers: { Referer: 'https://y.qq.com/n/yqq/playlist' } });
  const detail = result && result.cdlist && result.cdlist[0] ? result.cdlist[0] : {};
  const { playlist, tracks } = buildQQPlaylistTracksPayload(pid, detail);
  return { loggedIn: true, provider: 'qq', playlist, tracks };
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
  const singerMid = String(mid || '').trim();
  const num = Math.max(10, Math.min(80, parseInt(limit || '36', 10) || 36));
  if (!singerMid) return { provider: 'qq', error: 'MISSING_SINGER_MID', artist: null, songs: [] };
  const json = await qqMusicRequest({
    comm: { ct: 24, cv: 0 },
    singer: {
      module: 'music.web_singer_info_svr',
      method: 'get_singer_detail_info',
      param: { sort: 5, singermid: singerMid, sin: 0, num },
    },
  }, { cookie: true });
  const block = json && json.singer;
  if (!block || Number(block.code || 0) !== 0) {
    return { provider: 'qq', error: block && (block.message || block.msg || block.code) || 'QQ_ARTIST_DETAIL_FAILED', artist: null, songs: [] };
  }
  const data = block.data || {};
  const info = data.singer_info || data.singerInfo || {};
  const rawSongs = Array.isArray(data.songlist) ? data.songlist : [];
  const songs = rawSongs
    .map(raw => mapQQTrack(raw && (raw.track_info || raw.songInfo || raw.songinfo || raw.song) || raw, {}))
    .filter(song => song && song.name && (song.mid || song.id));
  const matchedSongArtist = songs[0] && (songs[0].artists || []).find(a => a && a.mid === singerMid);
  const artistMid = info.mid || singerMid;
  const artistName = info.name || info.title || (matchedSongArtist && matchedSongArtist.name) || '';
  const totalSong = Number(data.total_song || data.song_count || 0) || songs.length;
  return {
    provider: 'qq',
    artist: {
      provider: 'qq',
      id: info.id || '',
      mid: artistMid,
      name: artistName,
      avatar: info.pic || info.avatar || qqSingerAvatar(artistMid, 300),
      fans: Number(info.fans || 0) || 0,
      musicSize: totalSong,
      albumSize: Number(data.total_album || 0) || 0,
      mvSize: Number(data.total_mv || 0) || 0,
    },
    total: totalSong,
    songs,
  };
}

async function handleQQSearch(keywords, limit) {
  const kw = String(keywords || '').trim();
  if (!kw) return [];
  console.log('[QQSearch]', kw, 'limit:', limit);
  const base = await qqSmartboxSearch(kw, limit);
  const detailed = await Promise.all(base.map(async item => {
    try { return await qqSongDetail(item.mid, item); }
    catch (e) {
      console.warn('[QQSearch] detail failed:', item.mid, e.message);
      return item;
    }
  }));
  return uniqueNamedQQSongs(detailed);
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
  let topid = String(id || '').replace(/\D/g, '');
  if (!topid && mid) {
    try {
      const detail = await qqSongDetail(mid, { mid });
      topid = String((detail && (detail.qqId || detail.id)) || '').replace(/\D/g, '');
    } catch (e) {
      console.warn('[QQComments] detail fallback failed:', e.message);
    }
  }
  if (!topid) return { provider: 'qq', error: 'Missing QQ song id', comments: [] };
  const commentsPayload = buildQQSongCommentsPayload({}, topid, limit, offset);
  const uin = qqCookieUin() || '0';
  const body = await qqGetJSON('https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg', {
    g_tk: '5381',
    loginUin: uin,
    hostUin: '0',
    format: 'json',
    inCharset: 'utf8',
    outCharset: 'utf-8',
    notice: '0',
    platform: 'yqq.json',
    needNewCode: '0',
    cid: '205360772',
    reqtype: '2',
    biztype: '1',
    topid,
    cmd: '8',
    needmusiccrit: '0',
    pagenum: String(commentsPayload.page),
    pagesize: String(limit || 20),
  }, { headers: { Referer: 'https://y.qq.com/n/ryqq/songDetail/' + encodeURIComponent(mid || topid) } });
  return buildQQSongCommentsPayload(body, topid, limit, offset).response;
}

async function handleQQLyric(mid, id) {
  const songMID = String(mid || '').trim();
  const songID = normalizeQQSongId(id);
  if (!songMID && !songID) return { provider: 'qq', error: 'Missing QQ song mid or id', lyric: '' };

  let lyricText = '';
  let transText = '';
  let qrcText = '';
  let romaText = '';
  let source = 'qq-musicu';

  try {
    const param = {};
    if (songMID) param.songMID = songMID;
    if (songID) param.songID = songID;
    const json = await qqMusicRequest({
      comm: { ct: 24, cv: 0 },
      lyric: {
        module: 'music.musichallSong.PlayLyricInfo',
        method: 'GetPlayLyricInfo',
        param,
      },
    }, { cookie: true });
    const data = json && json.lyric && json.lyric.data;
    lyricText = decodeQQLyricText(data && data.lyric);
    transText = decodeQQLyricText(data && data.trans);
    qrcText = decodeQQLyricText(data && data.qrc);
    romaText = decodeQQLyricText(data && data.roma);
  } catch (e) {
    console.warn('[QQLyric] musicu failed:', e.message);
  }

  if (!lyricText && songMID) {
    try {
      const body = await qqGetJSON('https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg', {
        songmid: songMID,
        songtype: '0',
        format: 'json',
        nobase64: '1',
        g_tk: '5381',
        loginUin: qqCookieUin() || '0',
        hostUin: '0',
        inCharset: 'utf8',
        outCharset: 'utf-8',
        notice: '0',
        platform: 'yqq.json',
        needNewCode: '0',
      }, { headers: { Referer: 'https://y.qq.com/portal/player.html' } });
      lyricText = decodeQQLyricText(body && body.lyric);
      transText = decodeQQLyricText(body && (body.trans || body.tlyric)) || transText;
      source = 'qq-legacy';
    } catch (e) {
      console.warn('[QQLyric] legacy failed:', e.message);
    }
  }

  return {
    provider: 'qq',
    id: songID || '',
    mid: songMID,
    lyric: lyricText,
    tlyric: transText,
    yrc: '',
    qrc: qrcText,
    roma: romaText,
    source: lyricText ? source : 'qq-empty',
  };
}

async function fetchMyPodcastItems(key, info, limit, offset) {
  limit = Math.max(8, Math.min(60, Number(limit) || 30));
  offset = Math.max(0, Number(offset) || 0);
  if (key === 'collect') {
    const r = await dj_sublist({ limit, offset, cookie: currentUserCookie(), timestamp: Date.now() });
    const raw = firstArrayFrom(r.body, ['djRadios', 'djradios', 'radios', 'data']);
    return { itemType: 'radio', items: mapPodcastCollectionRadios(raw, key) };
  }
  if (key === 'created') {
    const r = await user_audio({ uid: info.userId, cookie: currentUserCookie(), timestamp: Date.now() });
    const raw = firstArrayFrom(r.body, ['data', 'djRadios', 'djradios', 'radios']);
    return { itemType: 'radio', items: mapPodcastCollectionRadios(raw, key) };
  }
  if (key === 'paid') {
    const r = await dj_paygift({ limit, offset, cookie: currentUserCookie(), timestamp: Date.now() });
    const raw = firstArrayFrom(r.body, ['data', 'djRadios', 'djradios', 'radios']);
    return { itemType: 'radio', items: mapPodcastCollectionRadios(raw, key) };
  }
  if (key === 'liked') {
    let raw = [];
    try {
      const sati = await sati_resource_sub_list({ cookie: currentUserCookie(), timestamp: Date.now() });
      raw = firstArrayFrom(sati.body, ['data', 'resources', 'list']);
    } catch (e) {
      console.warn('[MyPodcastLiked] sati sub list failed:', e.message);
    }
    if (!raw.length) {
      try {
        const recent = await record_recent_voice({ limit, cookie: currentUserCookie(), timestamp: Date.now() });
        raw = firstArrayFrom(recent.body, ['data', 'list', 'resources']);
      } catch (e) {
        console.warn('[MyPodcastLiked] recent voice fallback failed:', e.message);
      }
    }
    return { itemType: 'voice', items: mapPodcastVoiceItems(raw) };
  }
  return { itemType: 'radio', items: [] };
}

// ---------- 业务: 取歌曲URL (探测试听) ----------
//   返回 { url, trial, level, br }
//   trial=true 表示这是试听片段 (freeTrialInfo 非空)
async function handleSongUrl(id, loginInfo, qualityPreference) {
  console.log('[SongUrl] id:', id, 'logged-in:', !!currentUserCookie());
  const requestedQuality = normalizeQualityPreference(qualityPreference);
  const svipReady = hasNeteaseSvip(loginInfo);
  const qualities = qualityCandidatesFrom(requestedQuality, NETEASE_QUALITY_CANDIDATES)
    .filter(q => !q.svip || svipReady);

  let trialFallback = null; // 兜底: 即使是试听也要能播
  let lastData = null;
  let lastError = null;

  for (const q of qualities) {
    try {
      // 优先用 v1 接口 (支持更高音质 level 字段)
      let result;
      try {
        result = await song_url_v1({ id, level: q.level, cookie: currentUserCookie() });
      } catch (e) {
        result = await song_url({ id, br: q.br, cookie: currentUserCookie() });
      }
      const d = result.body && result.body.data && result.body.data[0];
      if (d) lastData = d;
      const url = d && d.url;
      const freeTrial = d && d.freeTrialInfo;
      console.log('[SongUrl]', q.level, '->', url ? 'OK' : 'no url', freeTrial ? '(TRIAL)' : '');
      if (url && !freeTrial) {
        return { url, trial: false, playable: true, level: q.level, quality: q.label, br: d.br, requestedQuality };
      }
      if (url && freeTrial && !trialFallback) {
        trialFallback = {
          url,
          trial: true,
          playable: true,
          level: q.level,
          quality: q.label,
          br: d.br,
          requestedQuality,
          trialInfo: freeTrial,
          restriction: classifyNeteasePlaybackRestriction(d, loginInfo),
        };
      }
    } catch (err) {
      lastError = err;
      console.log('[SongUrl]', q.level, 'failed:', err.message);
    }
  }
  if (trialFallback) return trialFallback;
  const restriction = classifyNeteasePlaybackRestriction(lastData, loginInfo);
  return {
    url: null,
    trial: false,
    playable: false,
    reason: restriction.category,
    message: restriction.message,
    restriction,
    lastCode: lastData && lastData.code,
    fee: lastData && lastData.fee,
    error: lastError && lastError.message,
    requestedQuality,
  };
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

  if (await handleUpdateRoutes({
    pathname: pn,
    url,
    res,
    sendJSON,
    fetchLatestUpdateInfo,
    localUpdateFallback,
    updateConfig: UPDATE_CONFIG,
    startUpdateDownloadJob,
    startUpdatePatchJob,
    updateDownloadJobs,
    publicUpdateJob,
    logger: console,
  })) return;

  if (await handleBeatmapRoutes({
    pathname: pn,
    url,
    req,
    res,
    sendJSON,
    readRequestBody,
    beatCacheRootInfo,
    readBeatMapCache,
    writeBeatMapCache,
  })) return;

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

  if (await handleNeteaseAuthRoutes({
    pathname: pn,
    url,
    req,
    res,
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
  })) return;

  if (await handlePodcastBeatmapRoutes(createPodcastRouteContext(
    createPodcastRouteDependencies(),
    { pathname: pn, url, res }
  ))) return;

  if (await handleNeteaseLibraryRoutes({
    pathname: pn,
    url,
    req,
    res,
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
  })) return;

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
    const api = Object.assign({}, neteaseApiDefaults, overrides || {});
    search = api.search;
    cloudsearch = api.cloudsearch;
    song_detail = api.song_detail;
    song_url = api.song_url;
    song_url_v1 = api.song_url_v1;
    login_qr_key = api.login_qr_key;
    login_qr_create = api.login_qr_create;
    login_qr_check = api.login_qr_check;
    login_status = api.login_status;
    logout = api.logout;
    user_account = api.user_account;
    user_playlist = api.user_playlist;
    comment_music = api.comment_music;
    artist_detail = api.artist_detail;
    artist_top_song = api.artist_top_song;
    artist_songs = api.artist_songs;
    like_song = api.like;
    likelist = api.likelist;
    song_like_check = api.song_like_check;
    playlist_tracks = api.playlist_tracks;
    playlist_track_add = api.playlist_track_add;
    playlist_create = api.playlist_create;
    playlist_detail = api.playlist_detail;
    playlist_track_all = api.playlist_track_all;
    personalized = api.personalized;
    recommend_resource = api.recommend_resource;
    recommend_songs = api.recommend_songs;
    dj_detail = api.dj_detail;
    dj_program = api.dj_program;
    dj_hot = api.dj_hot;
    dj_sublist = api.dj_sublist;
    user_audio = api.user_audio;
    dj_paygift = api.dj_paygift;
    record_recent_voice = api.record_recent_voice;
    sati_resource_sub_list = api.sati_resource_sub_list;
    lyric = api.lyric;
    lyric_new = api.lyric_new;
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
