type Logger = {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

type QQGetJSON = (
  targetUrl: string,
  params: Record<string, unknown>,
  opts?: { headers?: Record<string, string> }
) => Promise<any>;

type LoginInfo = {
  loggedIn?: boolean;
  userId?: string;
};

type SearchQQSongsDeps = {
  qqSmartboxSearch: (keywords: string, limit: unknown) => Promise<any[]>;
  qqSongDetail: (mid: unknown, fallback: any) => Promise<any>;
  uniqueNamedQQSongs: (songs: any[]) => any[];
  logger?: Logger;
};

type FetchQQUserPlaylistsDeps = {
  getQQLoginInfo: () => Promise<LoginInfo>;
  qqGetJSON: QQGetJSON;
  mapQQPlaylist: (playlist: any, kind: string) => Record<string, unknown>;
  uniqueQQPlaylists: (playlists: Record<string, unknown>[]) => any[];
};

type FetchQQPlaylistTracksDeps = {
  getQQLoginInfo: () => Promise<LoginInfo>;
  qqGetJSON: QQGetJSON;
  buildQQPlaylistTracksPayload: (playlistId: string, detail: any) => {
    playlist: Record<string, unknown>;
    tracks: Record<string, unknown>[];
  };
};

const QQ_CREATED_PLAYLIST_URL = 'https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss';
const QQ_COLLECTED_PLAYLIST_URL = 'https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg';
const QQ_PLAYLIST_DETAIL_URL = 'https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg';
const QQ_PROFILE_REFERER = 'https://y.qq.com/portal/profile.html';
const QQ_PLAYLIST_REFERER = 'https://y.qq.com/n/yqq/playlist';

export async function searchQQSongs(
  keywords: unknown,
  limit: unknown,
  deps: SearchQQSongsDeps
): Promise<any[]> {
  const kw = String(keywords || '').trim();
  if (!kw) return [];

  const logger = deps.logger || console;
  logger.log('[QQSearch]', kw, 'limit:', limit);

  const base = await deps.qqSmartboxSearch(kw, limit);
  const detailed = await Promise.all(base.map(async item => {
    try {
      return await deps.qqSongDetail(item.mid, item);
    } catch (e: any) {
      logger.warn('[QQSearch] detail failed:', item.mid, e.message);
      return item;
    }
  }));
  return deps.uniqueNamedQQSongs(detailed);
}

export async function fetchQQUserPlaylists(deps: FetchQQUserPlaylistsDeps): Promise<Record<string, unknown>> {
  const info = await deps.getQQLoginInfo();
  if (!info.loggedIn || !info.userId) return { loggedIn: false, provider: 'qq', playlists: [] };

  const uin = info.userId;
  const createdReq = deps.qqGetJSON(QQ_CREATED_PLAYLIST_URL, {
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
  }, { headers: { Referer: QQ_PROFILE_REFERER } });
  const collectReq = deps.qqGetJSON(QQ_COLLECTED_PLAYLIST_URL, {
    ct: 20,
    cid: 205360956,
    userid: uin,
    reqtype: 3,
    sin: 0,
    ein: 80,
  }, { headers: { Referer: QQ_PROFILE_REFERER } });

  const [createdRaw, collectRaw] = await Promise.allSettled([createdReq, collectReq]);
  const created = createdRaw.status === 'fulfilled'
    && createdRaw.value
    && createdRaw.value.data
    && Array.isArray(createdRaw.value.data.disslist)
    ? createdRaw.value.data.disslist.map((pl: any) => deps.mapQQPlaylist(pl, 'created'))
    : [];
  const collected = collectRaw.status === 'fulfilled'
    && collectRaw.value
    && collectRaw.value.data
    && Array.isArray(collectRaw.value.data.cdlist)
    ? collectRaw.value.data.cdlist.map((pl: any) => deps.mapQQPlaylist(pl, 'collect'))
    : [];

  const playlists = deps.uniqueQQPlaylists(created.concat(collected));
  return { loggedIn: true, provider: 'qq', userId: uin, playlists };
}

export async function fetchQQPlaylistTracks(
  id: unknown,
  deps: FetchQQPlaylistTracksDeps
): Promise<Record<string, unknown>> {
  const info = await deps.getQQLoginInfo();
  if (!info.loggedIn || !info.userId) return { loggedIn: false, provider: 'qq', tracks: [] };

  const pid = String(id || '').trim();
  if (!pid) return { loggedIn: true, provider: 'qq', error: 'Missing QQ playlist id', tracks: [] };

  const result = await deps.qqGetJSON(QQ_PLAYLIST_DETAIL_URL, {
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
  }, { headers: { Referer: QQ_PLAYLIST_REFERER } });
  const detail = result && result.cdlist && result.cdlist[0] ? result.cdlist[0] : {};
  const { playlist, tracks } = deps.buildQQPlaylistTracksPayload(pid, detail);
  return { loggedIn: true, provider: 'qq', playlist, tracks };
}
