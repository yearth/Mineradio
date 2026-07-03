import type {
  NeteaseAuthRouteDependencies,
} from './composition/netease-auth-context';
import type {
  NeteaseLibraryRouteDependencies,
} from './composition/netease-library-context';
import type {
  NeteaseMediaRouteDependencies,
} from './composition/netease-media-context';
import type {
  PodcastRouteDependencies,
} from './composition/podcast-context';
import type {
  QQRouteDependencies,
} from './composition/qq-context';
import type {
  AppRouteDependencies,
  DiscoverRouteDependencies,
  MediaRouteDependencies,
  SearchRouteDependencies,
  WeatherRouteDependencies,
} from './composition/simple-route-contexts';
import type {
  BeatmapRouteDependencies,
  UpdateRouteDependencies,
} from './composition/ops-route-contexts';

type AnyFn = (...args: any[]) => any;
type Logger = Pick<Console, 'error' | 'log' | 'warn'>;

export type RootRouteRuntimeNeteaseApi = {
  cloudsearch: AnyFn;
  djHot: AnyFn;
  djDetail: AnyFn;
  djProgram: AnyFn;
  lyricNew: AnyFn;
  lyric: AnyFn;
  commentMusic: AnyFn;
  artistDetail: AnyFn;
  artistSongs: AnyFn;
  artistTopSong: AnyFn;
  playlistTrackAll: AnyFn;
  playlistDetail: AnyFn;
  loginQrKey: AnyFn;
  loginQrCreate: AnyFn;
  loginQrCheck: AnyFn;
  logout: AnyFn;
  userPlaylist: AnyFn;
  songLikeCheck: AnyFn;
  likelist: AnyFn;
  likeSong: AnyFn;
  playlistCreate: AnyFn;
  playlistTracks: AnyFn;
  playlistTrackAdd: AnyFn;
};

export type RootRouteRuntimeFactoryInputs = {
  sendJSON: AnyFn;
  readRequestBody: AnyFn;
  normalizeCookieHeader: AnyFn;
  parseCookieString: AnyFn;
  saveCookie: AnyFn;
  getUserCookie: AnyFn;
  getLoginInfo: AnyFn;
  pendingNeteaseLoginInfo: AnyFn;
  readCookieFromResponse: AnyFn;
  normalizeLoginInfo: AnyFn;
  requireLogin: AnyFn;
  normalizeApiCode: AnyFn;
  normalizeApiMessage: AnyFn;
  mapSongRecord: AnyFn;
  buildNeteaseSongCommentsPayload: AnyFn;
  handleSongUrl: AnyFn;
  mapPodcastRadio: AnyFn;
  mapPodcastProgram: AnyFn;
  fetchMyPodcastItems: AnyFn;
  podcastCollectionMeta: AnyFn;
  analyzePodcastDjStream: AnyFn;
  analyzePodcastDjIntro: AnyFn;
  normalizeQQCookieInput: AnyFn;
  qqCookieUin: AnyFn;
  qqCookieMusicKey: AnyFn;
  saveQQCookie: AnyFn;
  getQQLoginInfo: AnyFn;
  handleQQSearch: AnyFn;
  handleQQSongUrl: AnyFn;
  handleQQLyric: AnyFn;
  handleQQUserPlaylists: AnyFn;
  handleQQPlaylistTracks: AnyFn;
  handleQQArtistDetail: AnyFn;
  handleQQSongComments: AnyFn;
  packageInfo: Record<string, unknown>;
  appVersion: string;
  updateConfig: any;
  buildAppVersionPayload: AnyFn;
  fetchLatestUpdateInfo: AnyFn;
  localUpdateFallback: AnyFn;
  startUpdateDownloadJob: AnyFn;
  startUpdatePatchJob: AnyFn;
  updateDownloadJobs: any;
  publicUpdateJob: AnyFn;
  beatCacheRootInfo: AnyFn;
  readBeatMapCache: AnyFn;
  writeBeatMapCache: AnyFn;
  handleDiscoverHome: AnyFn;
  buildWeatherRadio: AnyFn;
  fetchIpWeatherLocation: AnyFn;
  handleSearch: AnyFn;
  audioProxyHeadersFor: AnyFn;
  audioContentTypeForUrl: AnyFn;
  userAgent: string;
  now: AnyFn;
  logger: Logger;
  getNeteaseApi: () => RootRouteRuntimeNeteaseApi;
  getFetch: () => AnyFn;
};

export type RootRouteRuntimeFactories = {
  appRouteDependencies: AppRouteDependencies;
  updateRouteDependencies: UpdateRouteDependencies;
  beatmapRouteDependencies: BeatmapRouteDependencies;
  createDiscoverRouteDependencies: () => DiscoverRouteDependencies;
  createWeatherRouteDependencies: () => WeatherRouteDependencies;
  createSearchRouteDependencies: () => SearchRouteDependencies;
  createQQRouteDependencies: () => QQRouteDependencies;
  createPodcastRouteDependencies: () => PodcastRouteDependencies;
  createNeteaseMediaRouteDependencies: () => NeteaseMediaRouteDependencies;
  createNeteaseAuthRouteDependencies: () => NeteaseAuthRouteDependencies;
  createNeteaseLibraryRouteDependencies: () => NeteaseLibraryRouteDependencies;
  createMediaRouteDependencies: () => MediaRouteDependencies;
};

export function createRootRouteRuntimeFactories(
  runtime: RootRouteRuntimeFactoryInputs
): RootRouteRuntimeFactories {
  const appRouteDependencies = {
    sendJSON: runtime.sendJSON,
    packageInfo: runtime.packageInfo,
    appVersion: runtime.appVersion,
    updateConfig: runtime.updateConfig,
    buildAppVersionPayload: runtime.buildAppVersionPayload,
  };

  const updateRouteDependencies = {
    sendJSON: runtime.sendJSON,
    fetchLatestUpdateInfo: runtime.fetchLatestUpdateInfo,
    localUpdateFallback: runtime.localUpdateFallback,
    updateConfig: runtime.updateConfig,
    startUpdateDownloadJob: runtime.startUpdateDownloadJob,
    startUpdatePatchJob: runtime.startUpdatePatchJob,
    updateDownloadJobs: runtime.updateDownloadJobs,
    publicUpdateJob: runtime.publicUpdateJob,
    logger: runtime.logger,
  };

  const beatmapRouteDependencies = {
    sendJSON: runtime.sendJSON,
    readRequestBody: runtime.readRequestBody,
    beatCacheRootInfo: runtime.beatCacheRootInfo,
    readBeatMapCache: runtime.readBeatMapCache,
    writeBeatMapCache: runtime.writeBeatMapCache,
  };

  return {
    appRouteDependencies,
    updateRouteDependencies,
    beatmapRouteDependencies,
    createDiscoverRouteDependencies() {
      return {
        sendJSON: runtime.sendJSON,
        handleDiscoverHome: runtime.handleDiscoverHome,
        logger: runtime.logger,
      };
    },
    createWeatherRouteDependencies() {
      return {
        sendJSON: runtime.sendJSON,
        buildWeatherRadio: runtime.buildWeatherRadio,
        fetchIpWeatherLocation: runtime.fetchIpWeatherLocation,
        logger: runtime.logger,
      };
    },
    createSearchRouteDependencies() {
      return {
        sendJSON: runtime.sendJSON,
        handleSearch: runtime.handleSearch,
        logger: runtime.logger,
      };
    },
    createQQRouteDependencies() {
      return {
        sendJSON: runtime.sendJSON,
        readRequestBody: runtime.readRequestBody,
        parseCookieString: runtime.parseCookieString,
        normalizeQQCookieInput: runtime.normalizeQQCookieInput,
        qqCookieUin: runtime.qqCookieUin,
        qqCookieMusicKey: runtime.qqCookieMusicKey,
        saveQQCookie: runtime.saveQQCookie,
        getQQLoginInfo: runtime.getQQLoginInfo,
        handleQQSearch: runtime.handleQQSearch,
        handleQQSongUrl: runtime.handleQQSongUrl,
        handleQQLyric: runtime.handleQQLyric,
        handleQQUserPlaylists: runtime.handleQQUserPlaylists,
        handleQQPlaylistTracks: runtime.handleQQPlaylistTracks,
        handleQQArtistDetail: runtime.handleQQArtistDetail,
        handleQQSongComments: runtime.handleQQSongComments,
        logger: runtime.logger,
      };
    },
    createPodcastRouteDependencies() {
      const api = runtime.getNeteaseApi();
      return {
        sendJSON: runtime.sendJSON,
        cloudsearch: api.cloudsearch,
        djHot: api.djHot,
        djDetail: api.djDetail,
        djProgram: api.djProgram,
        mapPodcastRadio: runtime.mapPodcastRadio,
        mapPodcastProgram: runtime.mapPodcastProgram,
        getLoginInfo: runtime.getLoginInfo,
        fetchMyPodcastItems: runtime.fetchMyPodcastItems,
        podcastCollectionMeta: runtime.podcastCollectionMeta,
        analyzePodcastDjStream: runtime.analyzePodcastDjStream,
        analyzePodcastDjIntro: runtime.analyzePodcastDjIntro,
        userAgent: runtime.userAgent,
        getUserCookie: runtime.getUserCookie,
        timestamp: runtime.now,
        now: runtime.now,
        logger: runtime.logger,
      };
    },
    createNeteaseMediaRouteDependencies() {
      const api = runtime.getNeteaseApi();
      return {
        sendJSON: runtime.sendJSON,
        getUserCookie: runtime.getUserCookie,
        getLoginInfo: runtime.getLoginInfo,
        handleSongUrl: runtime.handleSongUrl,
        lyricNew: api.lyricNew,
        lyric: api.lyric,
        commentMusic: api.commentMusic,
        buildNeteaseSongCommentsPayload: runtime.buildNeteaseSongCommentsPayload,
        artistDetail: api.artistDetail,
        artistSongs: api.artistSongs,
        artistTopSong: api.artistTopSong,
        playlistTrackAll: api.playlistTrackAll,
        playlistDetail: api.playlistDetail,
        mapSongRecord: runtime.mapSongRecord,
        now: runtime.now,
        logger: runtime.logger,
      };
    },
    createNeteaseAuthRouteDependencies() {
      const api = runtime.getNeteaseApi();
      return {
        sendJSON: runtime.sendJSON,
        readRequestBody: runtime.readRequestBody,
        normalizeCookieHeader: runtime.normalizeCookieHeader,
        parseCookieString: runtime.parseCookieString,
        saveCookie: runtime.saveCookie,
        getUserCookie: runtime.getUserCookie,
        getLoginInfo: runtime.getLoginInfo,
        pendingNeteaseLoginInfo: runtime.pendingNeteaseLoginInfo,
        loginQrKey: api.loginQrKey,
        loginQrCreate: api.loginQrCreate,
        loginQrCheck: api.loginQrCheck,
        readCookieFromResponse: runtime.readCookieFromResponse,
        normalizeLoginInfo: runtime.normalizeLoginInfo,
        logout: api.logout,
        now: runtime.now,
        logger: runtime.logger,
      };
    },
    createNeteaseLibraryRouteDependencies() {
      const api = runtime.getNeteaseApi();
      return {
        sendJSON: runtime.sendJSON,
        readRequestBody: runtime.readRequestBody,
        getLoginInfo: runtime.getLoginInfo,
        requireLogin: runtime.requireLogin,
        getUserCookie: runtime.getUserCookie,
        userPlaylist: api.userPlaylist,
        songLikeCheck: api.songLikeCheck,
        likelist: api.likelist,
        likeSong: api.likeSong,
        playlistCreate: api.playlistCreate,
        playlistTracks: api.playlistTracks,
        playlistTrackAdd: api.playlistTrackAdd,
        normalizeApiCode: runtime.normalizeApiCode,
        normalizeApiMessage: runtime.normalizeApiMessage,
        now: runtime.now,
        logger: runtime.logger,
      };
    },
    createMediaRouteDependencies() {
      return {
        fetch: runtime.getFetch(),
        audioProxyHeadersFor: runtime.audioProxyHeadersFor,
        audioContentTypeForUrl: runtime.audioContentTypeForUrl,
        userAgent: runtime.userAgent,
        logger: runtime.logger,
      };
    },
  };
}
