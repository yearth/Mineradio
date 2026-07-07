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
const { analyzePodcastDjStream, analyzePodcastDjIntro } = require('./dj-analyzer');
const { defaultBeatMapCacheDir } = require('./lib/platform-paths');
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
  createSessionRuntime,
} = require('./server-dist/server/runtime/session-runtime');
const {
  createUpdateRuntime,
} = require('./server-dist/server/runtime/update-runtime');
const {
  buildAppConfig,
} = require('./server-dist/server/runtime/app-config');
const {
  createNeteaseProviderRuntime,
} = require('./server-dist/server/runtime/netease-provider-runtime');
const {
  serveStatic: serveStaticFile,
} = require('./server-dist/server/static-utils');
const {
  parseGitHubRepository,
  readUpdateConfig,
} = require('./server-dist/server/services/update-config');
const {
  normalizeApiCode,
  normalizeApiMessage,
} = require('./server-dist/server/services/provider-response');
const {
  normalizeLoginInfo,
  normalizeNeteaseVip,
  pendingNeteaseLoginInfo,
  readCookieFromResponse,
} = require('./server-dist/server/services/netease-session');
const {
  normalizeCookieHeader,
  normalizeQQCookieInput,
  normalizeQQUin,
  parseCookieString,
  rawCookieFallback,
} = require('./server-dist/server/services/cookie-session');
const {
  classifyNeteasePlaybackRestriction,
  playbackRestriction,
} = require('./server-dist/server/services/playback-restriction');
const {
  NETEASE_QUALITY_CANDIDATES,
} = require('./server-dist/server/services/playback-quality');
const {
  buildNeteaseSongCommentsPayload,
  mapArtists,
  mapPodcastProgram,
  mapPodcastRadio,
  mapQQArtists,
  mapSongRecord,
  podcastCollectionMeta,
  qqAlbumCover,
} = require('./server-dist/server/services/music-mapper');
const {
  decodeHtmlEntities,
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
} = require('./server-dist/server/services/qq-utils');
const {
  beatCacheRootInfo: beatCacheRootInfoService,
  readBeatMapCache: readBeatMapCacheService,
  writeBeatMapCache: writeBeatMapCacheService,
} = require('./server-dist/server/services/beatmap-cache');
const {
  buildAppVersionPayload,
  readPackageInfo: readPackageInfoService,
} = require('./server-dist/server/services/app-info');
const {
  buildServerTestRuntime,
  createServerTestRuntimeBindings,
} = require('./server-dist/server/test-support/runtime');
const {
  createRootRouteDispatcherDependencies,
} = require('./server-dist/server/root-dependencies');
const {
  createRootRouteRuntimeFactories,
} = require('./server-dist/server/root-runtime-factories');
const {
  createUpdateRuntimeAdapters,
} = require('./server-dist/server/composition/update-runtime-adapters');
const {
  createQQRequestAdapters,
} = require('./server-dist/server/composition/qq-request-adapters');
const {
  createQQRouteAdapters,
} = require('./server-dist/server/composition/qq-route-adapters');
const {
  createNeteaseRouteAdapters,
} = require('./server-dist/server/composition/netease-route-adapters');
const {
  dispatchRootRoute,
} = require('./server-dist/server/root-dispatcher');
const {
  createServerBootstrap,
} = require('./server-dist/server/server-bootstrap');

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

const neteaseProvider = createNeteaseProviderRuntime(neteaseApiDefaults);
const neteaseApiRuntime = neteaseProvider.runtime;
const {
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
  like_song,
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
} = neteaseProvider.api;

const updateRuntime = createUpdateRuntime();
const updateAdapters = createUpdateRuntimeAdapters({
  fs,
  path,
  getFetch: () => fetch,
  rootDir: __dirname,
  appVersion: APP_VERSION,
  updateConfig: UPDATE_CONFIG,
  updateFallbackNotes: UPDATE_FALLBACK_NOTES,
  updateDownloadDir: UPDATE_DOWNLOAD_DIR,
  updatePatchBackupDir: UPDATE_PATCH_BACKUP_DIR,
  patchMaxBytes: PATCH_MAX_BYTES,
  updateRuntime,
  userAgent: `Mineradio/${APP_VERSION}`,
  logger: console,
});
const {
  updateDownloadJobs,
  publicUpdateJob,
  fetchLatestUpdateInfo,
  localUpdateFallback,
  startUpdateDownloadJob,
  startUpdatePatchJob,
  moveInvalidUpdateFile,
} = updateAdapters;

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
const sessionRuntime = createSessionRuntime(cookieRuntime);
const {
  currentUserCookie,
  currentQQCookie,
  saveCookie,
  saveQQCookie,
} = sessionRuntime;

// ---------- 工具 ----------
function serveStatic(res, filePath) {
  return serveStaticFile(res, filePath, fs);
}
function readPackageInfo() {
  return readPackageInfoService(path.join(__dirname, 'package.json'), { fs });
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

const qqRequestAdapters = createQQRequestAdapters({
  http,
  https,
  userAgent: UA,
  getQQCookie: () => currentQQCookie(),
  logger: console,
});
const {
  requestRuntime,
  requestText,
  requestJson,
  qqCookieObject,
  qqCookieUin,
  qqCookieMusicKey,
  qqCookiePlaybackKey,
  qqMusicRequest,
  getQQLoginInfo,
  qqGetJSON,
  qqSmartboxSearch,
  qqSongDetail,
} = qqRequestAdapters;

const qqRouteAdapters = createQQRouteAdapters({
  getQQLoginInfo,
  qqGetJSON,
  qqMusicRequest,
  qqSmartboxSearch,
  qqSongDetail,
  qqCookieObject,
  qqCookieUin,
  qqCookieMusicKey,
  qqCookiePlaybackKey,
  logger: console,
});
const {
  handleQQUserPlaylists,
  handleQQPlaylistTracks,
  handleQQArtistDetail,
  handleQQSearch,
  handleQQSongUrl,
  handleQQSongComments,
  handleQQLyric,
} = qqRouteAdapters;

const getNeteaseApi = () => ({
  cloudsearch,
  djHot: dj_hot,
  djDetail: dj_detail,
  djProgram: dj_program,
  lyricNew: lyric_new,
  lyric,
  commentMusic: comment_music,
  artistDetail: artist_detail,
  artistSongs: artist_songs,
  artistTopSong: artist_top_song,
  playlistTrackAll: playlist_track_all,
  playlistDetail: playlist_detail,
  loginQrKey: login_qr_key,
  loginQrCreate: login_qr_create,
  loginQrCheck: login_qr_check,
  logout,
  userPlaylist: user_playlist,
  songLikeCheck: song_like_check,
  likelist,
  likeSong: like_song,
  playlistCreate: playlist_create,
  playlistTracks: playlist_tracks,
  playlistTrackAdd: playlist_track_add,
  songDetail: song_detail,
  personalized,
  recommendResource: recommend_resource,
  recommendSongs: recommend_songs,
  djSublist: dj_sublist,
  userAudio: user_audio,
  djPaygift: dj_paygift,
  satiResourceSubList: sati_resource_sub_list,
  recordRecentVoice: record_recent_voice,
  songUrlV1: song_url_v1,
  songUrl: song_url,
  loginStatus: login_status,
  userAccount: user_account,
});
const neteaseRouteAdapters = createNeteaseRouteAdapters({
  getUserCookie: () => currentUserCookie(),
  saveCookie,
  sendJSON,
  getNeteaseApi,
  now: Date.now,
  logger: console,
  qualityCandidates: NETEASE_QUALITY_CANDIDATES,
});
const {
  getLoginInfo,
  requireLogin,
  handleSearch,
  handleDiscoverHome,
  fetchMyPodcastItems,
  handleSongUrl,
} = neteaseRouteAdapters;

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

const rootRouteRuntimeFactories = createRootRouteRuntimeFactories({
  sendJSON,
  readRequestBody,
  normalizeCookieHeader,
  parseCookieString,
  saveCookie,
  getUserCookie: () => currentUserCookie(),
  getLoginInfo,
  pendingNeteaseLoginInfo,
  readCookieFromResponse,
  normalizeLoginInfo,
  requireLogin,
  normalizeApiCode,
  normalizeApiMessage,
  mapSongRecord,
  buildNeteaseSongCommentsPayload,
  handleSongUrl,
  mapPodcastRadio,
  mapPodcastProgram,
  fetchMyPodcastItems,
  podcastCollectionMeta,
  analyzePodcastDjStream,
  analyzePodcastDjIntro,
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
  packageInfo: APP_PACKAGE,
  appVersion: APP_VERSION,
  updateConfig: UPDATE_CONFIG,
  buildAppVersionPayload,
  fetchLatestUpdateInfo,
  localUpdateFallback,
  startUpdateDownloadJob,
  startUpdatePatchJob,
  updateDownloadJobs,
  publicUpdateJob,
  beatCacheRootInfo,
  readBeatMapCache,
  writeBeatMapCache,
  handleDiscoverHome,
  buildWeatherRadio,
  fetchIpWeatherLocation,
  handleSearch,
  audioProxyHeadersFor,
  audioContentTypeForUrl,
  userAgent: UA,
  now: Date.now,
  logger: console,
  getFetch: () => fetch,
  getNeteaseApi,
});

const rootRouteDependencies = createRootRouteDispatcherDependencies({
  neteaseSongUrlRoute: NETEASE_SONG_URL_ROUTE,
  rootDir: __dirname,
  appRouteDependencies: rootRouteRuntimeFactories.appRouteDependencies,
  updateRouteDependencies: rootRouteRuntimeFactories.updateRouteDependencies,
  beatmapRouteDependencies: rootRouteRuntimeFactories.beatmapRouteDependencies,
  createDiscoverRouteDependencies: rootRouteRuntimeFactories.createDiscoverRouteDependencies,
  createWeatherRouteDependencies: rootRouteRuntimeFactories.createWeatherRouteDependencies,
  createSearchRouteDependencies: rootRouteRuntimeFactories.createSearchRouteDependencies,
  createQQRouteDependencies: rootRouteRuntimeFactories.createQQRouteDependencies,
  createPodcastRouteDependencies: rootRouteRuntimeFactories.createPodcastRouteDependencies,
  createNeteaseMediaRouteDependencies: rootRouteRuntimeFactories.createNeteaseMediaRouteDependencies,
  createNeteaseAuthRouteDependencies: rootRouteRuntimeFactories.createNeteaseAuthRouteDependencies,
  createNeteaseLibraryRouteDependencies: rootRouteRuntimeFactories.createNeteaseLibraryRouteDependencies,
  createMediaRouteDependencies: rootRouteRuntimeFactories.createMediaRouteDependencies,
  serveStatic,
});

const server = createServerBootstrap({
  createServer: http.createServer.bind(http),
  createHttpServer,
  createRequestHandler,
  dispatchRootRoute,
  listenIfNeeded,
  routeDependencies: rootRouteDependencies,
  env: process.env,
  port: PORT,
  host: HOST,
  hasUserCookie: !!currentUserCookie(),
});

module.exports = server;
if (process.env.NODE_ENV === 'test') {
  const testRuntimeBindings = createServerTestRuntimeBindings({
    neteaseApiRuntime,
    requestRuntime,
    sessionRuntime,
    updateRuntime,
    helpers: {
      normalizeCookieHeader,
      rawCookieFallback,
      parseGitHubRepository,
      readUpdateConfig,
      requestText,
      moveInvalidUpdateFile,
      buildWeatherMood,
    },
  });
  module.exports.__test = buildServerTestRuntime(testRuntimeBindings);
}
