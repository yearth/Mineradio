import {
  createNeteaseApiRuntime,
  type NeteaseApiRuntime,
  type NeteaseApiTable,
} from './netease-api-runtime';

type NeteaseProviderFunction = (...args: any[]) => any;

const NETEASE_PROXY_SPECS = [
  ['search', 'search'],
  ['cloudsearch', 'cloudsearch'],
  ['song_detail', 'song_detail'],
  ['song_url', 'song_url'],
  ['song_url_v1', 'song_url_v1'],
  ['login_qr_key', 'login_qr_key'],
  ['login_qr_create', 'login_qr_create'],
  ['login_qr_check', 'login_qr_check'],
  ['login_status', 'login_status'],
  ['logout', 'logout'],
  ['user_account', 'user_account'],
  ['user_playlist', 'user_playlist'],
  ['comment_music', 'comment_music'],
  ['artist_detail', 'artist_detail'],
  ['artist_top_song', 'artist_top_song'],
  ['artist_songs', 'artist_songs'],
  ['like_song', 'like', 'like_song'],
  ['likelist', 'likelist'],
  ['song_like_check', 'song_like_check'],
  ['playlist_tracks', 'playlist_tracks'],
  ['playlist_track_add', 'playlist_track_add'],
  ['playlist_create', 'playlist_create'],
  ['playlist_detail', 'playlist_detail'],
  ['playlist_track_all', 'playlist_track_all'],
  ['personalized', 'personalized'],
  ['recommend_resource', 'recommend_resource'],
  ['recommend_songs', 'recommend_songs'],
  ['dj_detail', 'dj_detail'],
  ['dj_program', 'dj_program'],
  ['dj_hot', 'dj_hot'],
  ['dj_sublist', 'dj_sublist'],
  ['user_audio', 'user_audio'],
  ['dj_paygift', 'dj_paygift'],
  ['record_recent_voice', 'record_recent_voice'],
  ['sati_resource_sub_list', 'sati_resource_sub_list'],
  ['lyric', 'lyric'],
  ['lyric_new', 'lyric_new'],
] as const;

export type NeteaseProviderApi = Record<typeof NETEASE_PROXY_SPECS[number][0], NeteaseProviderFunction>;

export interface NeteaseProviderRuntime {
  readonly runtime: NeteaseApiRuntime;
  readonly api: NeteaseProviderApi;
}

export function createNeteaseProviderRuntime(defaults: NeteaseApiTable): NeteaseProviderRuntime {
  const runtime = createNeteaseApiRuntime(defaults);
  const api = {} as NeteaseProviderApi;

  NETEASE_PROXY_SPECS.forEach(([publicName, providerName, displayName]) => {
    api[publicName] = (...args: any[]) => {
      const fn = runtime.current()[providerName];
      const nameForError = displayName || providerName;
      if (typeof fn !== 'function') throw new TypeError(`${nameForError} is not a function`);
      return fn(...args);
    };
  });

  return { runtime, api };
}
