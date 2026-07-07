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
  createRequestRuntime,
} = require('./server-dist/server/runtime/request-runtime');
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
  fetchQQLoginInfo,
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

async function getQQLoginInfo() {
  return fetchQQLoginInfo({
    getQQCookie: () => currentQQCookie(),
    qqCookieObject,
    qqCookieUin,
    qqCookieMusicKey,
    normalizeQQProfile: (body, cookieObj) => normalizeQQProfileService(body, cookieObj, !!currentQQCookie()),
    buildQQProfileUrl,
    parseJSONText,
    requestText,
    baseHeaders: QQ_HEADERS,
    logger: console,
  });
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
  getNeteaseApi: () => ({
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
  }),
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
