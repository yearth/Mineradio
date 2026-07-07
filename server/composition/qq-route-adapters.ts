import {
  fetchQQArtistDetail as defaultFetchQQArtistDetail,
  fetchQQPlaylistTracks as defaultFetchQQPlaylistTracks,
  fetchQQLyric as defaultFetchQQLyric,
  fetchQQSongComments as defaultFetchQQSongComments,
  fetchQQUserPlaylists as defaultFetchQQUserPlaylists,
  searchQQSongs as defaultSearchQQSongs,
} from '../services/qq-orchestration';
import {
  buildQQPlaylistTracksPayload as defaultBuildQQPlaylistTracksPayload,
  mapQQTrack as defaultMapQQTrack,
  uniqueNamedQQSongs as defaultUniqueNamedQQSongs,
  uniqueQQPlaylists as defaultUniqueQQPlaylists,
} from '../services/music-mapper';
import {
  buildQQSongCommentsPayload as defaultBuildQQSongCommentsPayload,
  mapQQPlaylist as defaultMapQQPlaylist,
  qqSingerAvatar as defaultQQSingerAvatar,
} from '../services/qq-utils';
import {
  qqVkeyFileCandidates as defaultQQVkeyFileCandidates,
} from '../services/playback-quality';
import {
  qqPlaybackUnavailablePayload as defaultQQPlaybackUnavailablePayload,
} from '../services/playback-restriction';
import {
  decodeQQLyricText as defaultDecodeQQLyricText,
  normalizeQQSongId as defaultNormalizeQQSongId,
} from '../services/lyric-utils';

type AnyFn = (...args: any[]) => any;

export interface QQRouteAdapters {
  readonly handleQQUserPlaylists: AnyFn;
  readonly handleQQPlaylistTracks: AnyFn;
  readonly handleQQArtistDetail: AnyFn;
  readonly handleQQSearch: AnyFn;
  readonly handleQQSongUrl: AnyFn;
  readonly handleQQSongComments: AnyFn;
  readonly handleQQLyric: AnyFn;
}

export interface QQRouteAdapterOptions {
  readonly getQQLoginInfo: AnyFn;
  readonly qqGetJSON: AnyFn;
  readonly qqMusicRequest: AnyFn;
  readonly qqSmartboxSearch: AnyFn;
  readonly qqSongDetail: AnyFn;
  readonly qqCookieObject: AnyFn;
  readonly qqCookieUin: AnyFn;
  readonly qqCookieMusicKey: AnyFn;
  readonly qqCookiePlaybackKey: AnyFn;
  readonly logger: unknown;
  readonly random?: () => number;
  readonly services?: Partial<Record<string, AnyFn>>;
}

const defaultServices: Record<string, AnyFn> = {
  fetchQQUserPlaylists: defaultFetchQQUserPlaylists,
  fetchQQPlaylistTracks: defaultFetchQQPlaylistTracks,
  fetchQQArtistDetail: defaultFetchQQArtistDetail,
  searchQQSongs: defaultSearchQQSongs,
  fetchQQSongComments: defaultFetchQQSongComments,
  fetchQQLyric: defaultFetchQQLyric,
  qqVkeyFileCandidates: defaultQQVkeyFileCandidates,
  qqPlaybackUnavailablePayload: defaultQQPlaybackUnavailablePayload,
  mapQQPlaylist: defaultMapQQPlaylist,
  uniqueQQPlaylists: defaultUniqueQQPlaylists,
  buildQQPlaylistTracksPayload: defaultBuildQQPlaylistTracksPayload,
  mapQQTrack: defaultMapQQTrack,
  qqSingerAvatar: defaultQQSingerAvatar,
  uniqueNamedQQSongs: defaultUniqueNamedQQSongs,
  buildQQSongCommentsPayload: defaultBuildQQSongCommentsPayload,
  normalizeQQSongId: defaultNormalizeQQSongId,
  decodeQQLyricText: defaultDecodeQQLyricText,
};

export function createQQRouteAdapters(options: QQRouteAdapterOptions): QQRouteAdapters {
  const services = { ...defaultServices, ...(options.services || {}) } as Record<string, AnyFn>;
  const random = options.random || Math.random;

  async function handleQQUserPlaylists(): Promise<unknown> {
    return services.fetchQQUserPlaylists({
      getQQLoginInfo: options.getQQLoginInfo,
      qqGetJSON: options.qqGetJSON,
      mapQQPlaylist: services.mapQQPlaylist,
      uniqueQQPlaylists: services.uniqueQQPlaylists,
    });
  }

  async function handleQQPlaylistTracks(id: unknown): Promise<unknown> {
    return services.fetchQQPlaylistTracks(id, {
      getQQLoginInfo: options.getQQLoginInfo,
      qqGetJSON: options.qqGetJSON,
      buildQQPlaylistTracksPayload: services.buildQQPlaylistTracksPayload,
    });
  }

  async function handleQQArtistDetail(mid: unknown, limit: unknown): Promise<unknown> {
    return services.fetchQQArtistDetail(mid, limit, {
      qqMusicRequest: options.qqMusicRequest,
      mapQQTrack: services.mapQQTrack,
      qqSingerAvatar: services.qqSingerAvatar,
    });
  }

  async function handleQQSearch(keywords: unknown, limit: unknown): Promise<unknown> {
    return services.searchQQSongs(keywords, limit, {
      qqSmartboxSearch: options.qqSmartboxSearch,
      qqSongDetail: options.qqSongDetail,
      uniqueNamedQQSongs: services.uniqueNamedQQSongs,
      logger: options.logger,
    });
  }

  async function handleQQSongUrl(mid: unknown, mediaMid: unknown, qualityPreference: unknown): Promise<unknown> {
    const songmid = String(mid || '').trim();
    if (!songmid) return { provider: 'qq', url: '', error: 'MISSING_MID', message: 'Missing QQ song mid' };

    const guid = String(10000000 + Math.floor(random() * 90000000));
    const cookieObj = options.qqCookieObject();
    const uin = options.qqCookieUin(cookieObj) || '0';
    const musicKey = options.qqCookieMusicKey(cookieObj);
    const playbackKey = options.qqCookiePlaybackKey(cookieObj);
    const { requestedQuality, fileCandidates, filenames } = services.qqVkeyFileCandidates(
      songmid,
      mediaMid,
      qualityPreference
    );
    const param: Record<string, unknown> = {
      guid,
      songmid: filenames.length ? filenames.map(() => songmid) : [songmid],
      songtype: filenames.length ? filenames.map(() => 0) : [0],
      uin,
      loginflag: 1,
      platform: '20',
    };
    if (filenames.length) param.filename = filenames;

    const comm: Record<string, unknown> = { uin, format: 'json', ct: musicKey ? 19 : 24, cv: 0 };
    if (musicKey) comm.authst = musicKey;

    const json = await options.qqMusicRequest({
      comm,
      req_0: {
        module: 'vkey.GetVkeyServer',
        method: 'CgiGetVkey',
        param,
      },
    }, { cookie: true });
    const data = json && json.req_0 && json.req_0.data;
    const infos = (data && Array.isArray(data.midurlinfo)) ? data.midurlinfo : [];
    const info = infos.find((item: any) => item && item.purl) || infos[0];
    const purl = info && info.purl;
    if (purl) {
      const sip = (data.sip && data.sip[0]) || 'https://ws.stream.qqmusic.qq.com/';
      const fileMeta = fileCandidates.find((item: any) => item.filename === info.filename) || {};
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

    return services.qqPlaybackUnavailablePayload({
      info,
      hasSession: !!(uin && musicKey),
      hasPlaybackKey: !!(uin && playbackKey),
      fileCandidates,
      requestedQuality,
    });
  }

  async function handleQQSongComments(id: unknown, mid: unknown, limit: unknown, offset: unknown): Promise<unknown> {
    return services.fetchQQSongComments(id, mid, limit, offset, {
      qqSongDetail: options.qqSongDetail,
      qqGetJSON: options.qqGetJSON,
      qqCookieUin: options.qqCookieUin,
      buildQQSongCommentsPayload: services.buildQQSongCommentsPayload,
      logger: options.logger,
    });
  }

  async function handleQQLyric(mid: unknown, id: unknown): Promise<unknown> {
    return services.fetchQQLyric(mid, id, {
      qqMusicRequest: options.qqMusicRequest,
      qqGetJSON: options.qqGetJSON,
      qqCookieUin: options.qqCookieUin,
      normalizeQQSongId: services.normalizeQQSongId,
      decodeQQLyricText: services.decodeQQLyricText,
      logger: options.logger,
    });
  }

  return {
    handleQQUserPlaylists,
    handleQQPlaylistTracks,
    handleQQArtistDetail,
    handleQQSearch,
    handleQQSongUrl,
    handleQQSongComments,
    handleQQLyric,
  };
}
