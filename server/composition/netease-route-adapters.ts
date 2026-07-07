import {
  getNeteaseLoginInfo as defaultGetNeteaseLoginInfo,
  isNeteaseLoginReady as defaultIsNeteaseLoginReady,
  neteaseLoginRequiredPayload as defaultNeteaseLoginRequiredPayload,
} from '../services/netease-session';
import {
  buildDiscoverHome as defaultBuildDiscoverHome,
  fetchNeteasePodcastCollectionItems as defaultFetchNeteasePodcastCollectionItems,
  fetchNeteaseSongUrl as defaultFetchNeteaseSongUrl,
  searchNeteaseSongs as defaultSearchNeteaseSongs,
} from '../services/netease-orchestration';
import {
  firstArrayFrom as defaultFirstArrayFrom,
  isLowSignalPodcastItem as defaultIsLowSignalPodcastItem,
  mapDiscoverPlaylist as defaultMapDiscoverPlaylist,
  mapPodcastCollectionRadios as defaultMapPodcastCollectionRadios,
  mapPodcastRadio as defaultMapPodcastRadio,
  mapPodcastVoiceItems as defaultMapPodcastVoiceItems,
  mapSongRecord as defaultMapSongRecord,
} from '../services/music-mapper';
import {
  hasNeteaseSvip as defaultHasNeteaseSvip,
  normalizeQualityPreference as defaultNormalizeQualityPreference,
  qualityCandidatesFrom as defaultQualityCandidatesFrom,
} from '../services/playback-quality';
import {
  classifyNeteasePlaybackRestriction as defaultClassifyNeteasePlaybackRestriction,
} from '../services/playback-restriction';

type AnyFn = (...args: any[]) => any;

export interface NeteaseRouteAdapters {
  readonly getLoginInfo: AnyFn;
  readonly requireLogin: AnyFn;
  readonly handleSearch: AnyFn;
  readonly handleDiscoverHome: AnyFn;
  readonly fetchMyPodcastItems: AnyFn;
  readonly handleSongUrl: AnyFn;
}

export interface NeteaseRouteAdapterOptions {
  readonly getUserCookie: () => string;
  readonly saveCookie: AnyFn;
  readonly sendJSON: AnyFn;
  readonly getNeteaseApi: () => Record<string, AnyFn>;
  readonly now: AnyFn;
  readonly logger: unknown;
  readonly qualityCandidates: unknown;
  readonly services?: Partial<Record<string, AnyFn>>;
}

const defaultServices: Record<string, AnyFn> = {
  getNeteaseLoginInfo: defaultGetNeteaseLoginInfo,
  isNeteaseLoginReady: defaultIsNeteaseLoginReady,
  neteaseLoginRequiredPayload: defaultNeteaseLoginRequiredPayload,
  searchNeteaseSongs: defaultSearchNeteaseSongs,
  buildDiscoverHome: defaultBuildDiscoverHome,
  fetchNeteasePodcastCollectionItems: defaultFetchNeteasePodcastCollectionItems,
  fetchNeteaseSongUrl: defaultFetchNeteaseSongUrl,
  mapSongRecord: defaultMapSongRecord,
  mapDiscoverPlaylist: defaultMapDiscoverPlaylist,
  mapPodcastRadio: defaultMapPodcastRadio,
  isLowSignalPodcastItem: defaultIsLowSignalPodcastItem,
  firstArrayFrom: defaultFirstArrayFrom,
  mapPodcastCollectionRadios: defaultMapPodcastCollectionRadios,
  mapPodcastVoiceItems: defaultMapPodcastVoiceItems,
  normalizeQualityPreference: defaultNormalizeQualityPreference,
  hasNeteaseSvip: defaultHasNeteaseSvip,
  qualityCandidatesFrom: defaultQualityCandidatesFrom,
  classifyNeteasePlaybackRestriction: defaultClassifyNeteasePlaybackRestriction,
};

export function createNeteaseRouteAdapters(options: NeteaseRouteAdapterOptions): NeteaseRouteAdapters {
  const services = { ...defaultServices, ...(options.services || {}) } as Record<string, AnyFn>;

  async function getLoginInfo(): Promise<unknown> {
    const api = options.getNeteaseApi();
    return services.getNeteaseLoginInfo(options.getUserCookie(), {
      loginStatus: api.loginStatus,
      saveCookie: options.saveCookie,
      userAccount: api.userAccount,
      warn: (options.logger as any).warn,
    });
  }

  async function requireLogin(res: unknown): Promise<unknown> {
    const info = await getLoginInfo();
    if (!services.isNeteaseLoginReady(info)) {
      options.sendJSON(res, services.neteaseLoginRequiredPayload(), 401);
      return null;
    }
    return info;
  }

  async function handleSearch(keywords: unknown, limit: unknown): Promise<unknown> {
    const api = options.getNeteaseApi();
    return services.searchNeteaseSongs(keywords, limit, {
      cloudsearch: api.cloudsearch,
      songDetail: api.songDetail,
      getUserCookie: options.getUserCookie,
      mapSongRecord: services.mapSongRecord,
      logger: options.logger,
    });
  }

  async function handleDiscoverHome(): Promise<unknown> {
    const api = options.getNeteaseApi();
    return services.buildDiscoverHome({
      getLoginInfo,
      getUserCookie: options.getUserCookie,
      personalized: api.personalized,
      djHot: api.djHot,
      recommendResource: api.recommendResource,
      recommendSongs: api.recommendSongs,
      mapDiscoverPlaylist: services.mapDiscoverPlaylist,
      mapPodcastRadio: services.mapPodcastRadio,
      mapSongRecord: services.mapSongRecord,
      isLowSignalPodcastItem: services.isLowSignalPodcastItem,
      now: options.now,
    });
  }

  async function fetchMyPodcastItems(
    key: unknown,
    info: unknown,
    limit: unknown,
    offset: unknown
  ): Promise<unknown> {
    const api = options.getNeteaseApi();
    return services.fetchNeteasePodcastCollectionItems(key, info, limit, offset, {
      djSublist: api.djSublist,
      userAudio: api.userAudio,
      djPaygift: api.djPaygift,
      satiResourceSubList: api.satiResourceSubList,
      recordRecentVoice: api.recordRecentVoice,
      getUserCookie: options.getUserCookie,
      firstArrayFrom: services.firstArrayFrom,
      mapPodcastCollectionRadios: services.mapPodcastCollectionRadios,
      mapPodcastVoiceItems: services.mapPodcastVoiceItems,
      now: options.now,
      logger: options.logger,
    });
  }

  async function handleSongUrl(id: unknown, loginInfo: unknown, qualityPreference: unknown): Promise<unknown> {
    const api = options.getNeteaseApi();
    return services.fetchNeteaseSongUrl(id, loginInfo, qualityPreference, {
      getUserCookie: options.getUserCookie,
      songUrlV1: api.songUrlV1,
      songUrl: api.songUrl,
      normalizeQualityPreference: services.normalizeQualityPreference,
      hasNeteaseSvip: services.hasNeteaseSvip,
      qualityCandidatesFrom: services.qualityCandidatesFrom,
      qualityCandidates: options.qualityCandidates,
      classifyNeteasePlaybackRestriction: services.classifyNeteasePlaybackRestriction,
      logger: options.logger,
    });
  }

  return {
    getLoginInfo,
    requireLogin,
    handleSearch,
    handleDiscoverHome,
    fetchMyPodcastItems,
    handleSongUrl,
  };
}
