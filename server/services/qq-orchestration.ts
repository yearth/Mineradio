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

type FetchQQArtistDetailDeps = {
  qqMusicRequest: (payload: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<any>;
  mapQQTrack: (track: any, fallback: any) => Record<string, unknown>;
  qqSingerAvatar: (singerMid: unknown, size?: number) => string;
};

type FetchQQSongCommentsDeps = {
  qqSongDetail: (mid: unknown, fallback: any) => Promise<any>;
  qqGetJSON: QQGetJSON;
  qqCookieUin: () => string;
  buildQQSongCommentsPayload: (body: any, topid: unknown, limit: unknown, offset: unknown) => {
    page: number;
    response: Record<string, unknown>;
  };
  logger?: Pick<Logger, 'warn'>;
};

type FetchQQLyricDeps = {
  qqMusicRequest: (payload: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<any>;
  qqGetJSON: QQGetJSON;
  qqCookieUin: () => string;
  normalizeQQSongId: (id: unknown) => number;
  decodeQQLyricText: (text: unknown) => string;
  logger?: Pick<Logger, 'warn'>;
};

const QQ_CREATED_PLAYLIST_URL = 'https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss';
const QQ_COLLECTED_PLAYLIST_URL = 'https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg';
const QQ_PLAYLIST_DETAIL_URL = 'https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg';
const QQ_SONG_COMMENTS_URL = 'https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg';
const QQ_LEGACY_LYRIC_URL = 'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg';
const QQ_PROFILE_REFERER = 'https://y.qq.com/portal/profile.html';
const QQ_PLAYLIST_REFERER = 'https://y.qq.com/n/yqq/playlist';
const QQ_PLAYER_REFERER = 'https://y.qq.com/portal/player.html';

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

export async function fetchQQArtistDetail(
  mid: unknown,
  limit: unknown,
  deps: FetchQQArtistDetailDeps
): Promise<Record<string, unknown>> {
  const singerMid = String(mid || '').trim();
  const num = Math.max(10, Math.min(80, parseInt(String(limit || '36'), 10) || 36));
  if (!singerMid) return { provider: 'qq', error: 'MISSING_SINGER_MID', artist: null, songs: [] };

  const json = await deps.qqMusicRequest({
    comm: { ct: 24, cv: 0 },
    singer: {
      module: 'music.web_singer_info_svr',
      method: 'get_singer_detail_info',
      param: { sort: 5, singermid: singerMid, sin: 0, num },
    },
  }, { cookie: true });
  const block = json && json.singer;
  if (!block || Number(block.code || 0) !== 0) {
    return {
      provider: 'qq',
      error: block && (block.message || block.msg || block.code) || 'QQ_ARTIST_DETAIL_FAILED',
      artist: null,
      songs: [],
    };
  }

  const data = block.data || {};
  const info = data.singer_info || data.singerInfo || {};
  const rawSongs = Array.isArray(data.songlist) ? data.songlist : [];
  const songs = rawSongs
    .map((raw: any) => deps.mapQQTrack(raw && (raw.track_info || raw.songInfo || raw.songinfo || raw.song) || raw, {}))
    .filter((song: any) => song && song.name && (song.mid || song.id));
  const matchedSongArtist = songs[0] && (songs[0].artists || []).find((a: any) => a && a.mid === singerMid);
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
      avatar: info.pic || info.avatar || deps.qqSingerAvatar(artistMid, 300),
      fans: Number(info.fans || 0) || 0,
      musicSize: totalSong,
      albumSize: Number(data.total_album || 0) || 0,
      mvSize: Number(data.total_mv || 0) || 0,
    },
    total: totalSong,
    songs,
  };
}

export async function fetchQQSongComments(
  id: unknown,
  mid: unknown,
  limit: unknown,
  offset: unknown,
  deps: FetchQQSongCommentsDeps
): Promise<Record<string, unknown>> {
  const logger = deps.logger || console;
  let topid = String(id || '').replace(/\D/g, '');
  if (!topid && mid) {
    try {
      const detail = await deps.qqSongDetail(mid, { mid });
      topid = String((detail && (detail.qqId || detail.id)) || '').replace(/\D/g, '');
    } catch (e: any) {
      logger.warn('[QQComments] detail fallback failed:', e.message);
    }
  }
  if (!topid) return { provider: 'qq', error: 'Missing QQ song id', comments: [] };

  const commentsPayload = deps.buildQQSongCommentsPayload({}, topid, limit, offset);
  const uin = deps.qqCookieUin() || '0';
  const body = await deps.qqGetJSON(QQ_SONG_COMMENTS_URL, {
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
  }, { headers: { Referer: 'https://y.qq.com/n/ryqq/songDetail/' + encodeURIComponent(String(mid || topid)) } });
  return deps.buildQQSongCommentsPayload(body, topid, limit, offset).response;
}

export async function fetchQQLyric(
  mid: unknown,
  id: unknown,
  deps: FetchQQLyricDeps
): Promise<Record<string, unknown>> {
  const logger = deps.logger || console;
  const songMID = String(mid || '').trim();
  const songID = deps.normalizeQQSongId(id);
  if (!songMID && !songID) return { provider: 'qq', error: 'Missing QQ song mid or id', lyric: '' };

  let lyricText = '';
  let transText = '';
  let qrcText = '';
  let romaText = '';
  let source = 'qq-musicu';

  try {
    const param: Record<string, string | number> = {};
    if (songMID) param.songMID = songMID;
    if (songID) param.songID = songID;
    const json = await deps.qqMusicRequest({
      comm: { ct: 24, cv: 0 },
      lyric: {
        module: 'music.musichallSong.PlayLyricInfo',
        method: 'GetPlayLyricInfo',
        param,
      },
    }, { cookie: true });
    const data = json && json.lyric && json.lyric.data;
    lyricText = deps.decodeQQLyricText(data && data.lyric);
    transText = deps.decodeQQLyricText(data && data.trans);
    qrcText = deps.decodeQQLyricText(data && data.qrc);
    romaText = deps.decodeQQLyricText(data && data.roma);
  } catch (e: any) {
    logger.warn('[QQLyric] musicu failed:', e.message);
  }

  if (!lyricText && songMID) {
    try {
      const body = await deps.qqGetJSON(QQ_LEGACY_LYRIC_URL, {
        songmid: songMID,
        songtype: '0',
        format: 'json',
        nobase64: '1',
        g_tk: '5381',
        loginUin: deps.qqCookieUin() || '0',
        hostUin: '0',
        inCharset: 'utf8',
        outCharset: 'utf-8',
        notice: '0',
        platform: 'yqq.json',
        needNewCode: '0',
      }, { headers: { Referer: QQ_PLAYER_REFERER } });
      lyricText = deps.decodeQQLyricText(body && body.lyric);
      transText = deps.decodeQQLyricText(body && (body.trans || body.tlyric)) || transText;
      source = 'qq-legacy';
    } catch (e: any) {
      logger.warn('[QQLyric] legacy failed:', e.message);
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
