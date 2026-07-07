import {
  createHttpServer,
  createRequestHandler,
  listenIfNeeded,
  readRequestBody,
  sendJson as sendJSON,
} from './http-utils';
import { createCookieRuntime } from './runtime/cookie-runtime';
import { createSessionRuntime } from './runtime/session-runtime';
import { createUpdateRuntime } from './runtime/update-runtime';
import { buildAppConfig } from './runtime/app-config';
import { createNeteaseProviderRuntime } from './runtime/netease-provider-runtime';
import { serveStatic as serveStaticFile } from './static-utils';
import {
  parseGitHubRepository,
  readUpdateConfig,
} from './services/update-config';
import {
  normalizeApiCode,
  normalizeApiMessage,
} from './services/provider-response';
import {
  normalizeLoginInfo,
  pendingNeteaseLoginInfo,
  readCookieFromResponse,
} from './services/netease-session';
import {
  normalizeCookieHeader,
  normalizeQQCookieInput,
  parseCookieString,
  rawCookieFallback,
} from './services/cookie-session';
import { playbackRestriction } from './services/playback-restriction';
import { NETEASE_QUALITY_CANDIDATES } from './services/playback-quality';
import {
  buildNeteaseSongCommentsPayload,
  mapPodcastProgram,
  mapPodcastRadio,
  mapSongRecord,
  podcastCollectionMeta,
} from './services/music-mapper';
import {
  buildWeatherMood,
  fallbackWeatherForRadio,
  orderWeatherSongs,
  weatherRadioSeedQueries,
} from './services/weather-utils';
import {
  fetchIpWeatherLocation as fetchIpWeatherLocationService,
  fetchOpenMeteoWeather as fetchOpenMeteoWeatherService,
} from './services/weather-provider';
import { buildWeatherRadio as buildWeatherRadioService } from './services/weather-orchestration';
import {
  audioContentTypeForUrl,
  audioProxyHeadersFor,
} from './services/qq-utils';
import {
  beatCacheRootInfo as beatCacheRootInfoService,
  readBeatMapCache as readBeatMapCacheService,
  writeBeatMapCache as writeBeatMapCacheService,
} from './services/beatmap-cache';
import {
  buildAppVersionPayload,
  readPackageInfo as readPackageInfoService,
} from './services/app-info';
import {
  buildServerTestRuntime,
  createServerTestRuntimeBindings,
} from './test-support/runtime';
import { createRootRouteDispatcherDependencies } from './root-dependencies';
import { createRootRouteRuntimeFactories } from './root-runtime-factories';
import { createUpdateRuntimeAdapters } from './composition/update-runtime-adapters';
import { createQQRequestAdapters } from './composition/qq-request-adapters';
import { createQQRouteAdapters } from './composition/qq-route-adapters';
import { createNeteaseRouteAdapters } from './composition/netease-route-adapters';
import { dispatchRootRoute } from './root-dispatcher';
import { createServerBootstrap } from './server-bootstrap';

declare function require(id: string): any;
declare const process: { env: EntryEnvironment };
declare const fetch: AnyFn;

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const tls = require('tls');
const neteaseApiDefaults = require('NeteaseCloudMusicApi');
const {
  analyzePodcastDjStream,
  analyzePodcastDjIntro,
} = require('../../dj-analyzer');
const {
  defaultBeatMapCacheDir,
} = require('../../lib/platform-paths');

type AnyFn = (...args: any[]) => any;
type EntryEnvironment = Record<string, string | undefined>;

export type MineradioServerEntryOptions = {
  readonly rootDir: string;
  readonly env?: EntryEnvironment;
  readonly getFetch?: () => AnyFn;
  readonly logger?: Console;
};

export type MineradioServerEntry = {
  readonly server: unknown;
  readonly testRuntime: Record<string, unknown>;
};

function applySystemCertificateAuthorities(logger: Pick<Console, 'warn'>): void {
  try {
    if (typeof tls.getCACertificates !== 'function' || typeof tls.setDefaultCACertificates !== 'function') return;
    const bundled = tls.getCACertificates('default') || [];
    const system = tls.getCACertificates('system') || [];
    if (!system.length) return;
    const seen = new Set<string>();
    const merged: string[] = [];
    bundled.concat(system).forEach((cert: string) => {
      if (!cert || seen.has(cert)) return;
      seen.add(cert);
      merged.push(cert);
    });
    if (merged.length > bundled.length) tls.setDefaultCACertificates(merged);
  } catch (e) { /* node:coverage ignore next 2 */
    logger.warn('[TLS] system CA merge skipped:', (e as Error).message);
  }
}

export function createMineradioServerEntry(options: MineradioServerEntryOptions): MineradioServerEntry {
  const env = options.env || process.env;
  const logger = options.logger || console;
  const getFetch = options.getFetch || (() => fetch);
  const rootDir = options.rootDir;

  const readPackageInfo = () => readPackageInfoService(path.join(rootDir, 'package.json'), { fs });
  const appPackage = readPackageInfo();
  const appConfig = buildAppConfig({
    env,
    rootDir,
    packageInfo: appPackage,
    defaultBeatMapCacheDir,
  });
  const appVersion = appConfig.appVersion as string;
  const updateConfig = readUpdateConfig(appPackage);

  applySystemCertificateAuthorities(logger);

  const neteaseProvider = createNeteaseProviderRuntime(neteaseApiDefaults);
  const neteaseApiRuntime = neteaseProvider.runtime;
  const {
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
    getFetch,
    rootDir,
    appVersion,
    updateConfig,
    updateFallbackNotes: appConfig.updateFallbackNotes as any,
    updateDownloadDir: appConfig.updateDownloadDir,
    updatePatchBackupDir: appConfig.updatePatchBackupDir,
    patchMaxBytes: appConfig.patchMaxBytes,
    updateRuntime: updateRuntime as any,
    userAgent: `Mineradio/${appVersion}`,
    logger,
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

  const cookieRuntime = createCookieRuntime({
    fs,
    userCookieFile: appConfig.cookieFile,
    qqCookieFile: appConfig.qqCookieFile,
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

  const serveStatic = (res: unknown, filePath: unknown) => serveStaticFile(res as any, filePath as string, fs);
  const beatCacheRootInfo = () => beatCacheRootInfoService(appConfig.beatmapCacheDir);
  const readBeatMapCache = (key: string) => readBeatMapCacheService(key, appConfig.beatmapCacheDir);
  const writeBeatMapCache = (body: unknown) => writeBeatMapCacheService(body, appConfig.beatmapCacheDir);

  const qqRequestAdapters = createQQRequestAdapters({
    http,
    https,
    userAgent: appConfig.userAgent,
    getQQCookie: () => currentQQCookie(),
    logger,
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
    logger,
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
    logger,
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

  const fetchOpenMeteoWeather = (params: unknown) => fetchOpenMeteoWeatherService(params, {
    defaultLocation: appConfig.weatherDefaultLocation,
    forecastUrl: appConfig.openMeteoForecastUrl,
    geocodeUrl: appConfig.openMeteoGeocodeUrl,
    requestJson,
    userAgent: appConfig.userAgent,
  });

  const fetchIpWeatherLocation = () => fetchIpWeatherLocationService({
    defaultLocation: appConfig.weatherDefaultLocation,
    ipLocationUrl: appConfig.weatherIpLocationUrl,
    requestJson,
    userAgent: appConfig.userAgent,
  });

  const buildWeatherRadio = (params: unknown) => buildWeatherRadioService(params, {
    fetchWeather: fetchOpenMeteoWeather,
    fallbackWeatherForRadio,
    weatherRadioSeedQueries,
    searchSongs: handleSearch,
    orderWeatherSongs,
    defaultLocation: appConfig.weatherDefaultLocation,
    now: Date.now,
    logger,
  });

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
    packageInfo: appPackage,
    appVersion,
    updateConfig,
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
    userAgent: appConfig.userAgent,
    now: Date.now,
    logger,
    getFetch,
    getNeteaseApi,
  });

  const rootRouteDependencies = createRootRouteDispatcherDependencies({
    neteaseSongUrlRoute: appConfig.neteaseSongUrlRoute,
    rootDir,
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
    createRequestHandler: createRequestHandler as any,
    dispatchRootRoute,
    listenIfNeeded,
    routeDependencies: rootRouteDependencies,
    env,
    port: appConfig.port,
    host: appConfig.host,
    hasUserCookie: !!currentUserCookie(),
  });

  const testRuntimeBindings = createServerTestRuntimeBindings({
    neteaseApiRuntime,
    requestRuntime: requestRuntime as any,
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

  return {
    server,
    testRuntime: buildServerTestRuntime(testRuntimeBindings),
  };
}
