type Logger = Pick<Console, 'log' | 'warn'>;

type SearchDeps = {
  cloudsearch: (opts: any) => Promise<any>;
  songDetail: (opts: any) => Promise<any>;
  getUserCookie: () => string;
  mapSongRecord: (song: any) => any;
  logger?: Logger;
};

type DiscoverHomeDeps = {
  getLoginInfo: () => Promise<any>;
  getUserCookie: () => string;
  personalized: (opts: any) => Promise<any>;
  djHot: (opts: any) => Promise<any>;
  recommendResource: (opts: any) => Promise<any>;
  recommendSongs: (opts: any) => Promise<any>;
  mapDiscoverPlaylist: (playlist: any, tag?: string) => any;
  mapPodcastRadio: (radio: any) => any;
  mapSongRecord: (song: any) => any;
  isLowSignalPodcastItem: (item: any) => boolean;
  now?: () => number;
};

type NeteaseQualityCandidate = {
  level: string;
  br: number;
  label: string;
  svip?: boolean;
};

type SongUrlDeps = {
  getUserCookie: () => string;
  songUrlV1: (opts: any) => Promise<any>;
  songUrl: (opts: any) => Promise<any>;
  normalizeQualityPreference: (value: unknown) => string;
  hasNeteaseSvip: (loginInfo: any) => boolean;
  qualityCandidatesFrom: <T extends { level: string }>(target: unknown, candidates: T[]) => T[];
  qualityCandidates: NeteaseQualityCandidate[];
  classifyNeteasePlaybackRestriction: (lastData: any, loginInfo: any) => Record<string, unknown>;
  logger?: Pick<Console, 'log'>;
};

type LyricDeps = {
  getUserCookie: () => string;
  lyricNew?: (opts: any) => Promise<any>;
  lyric: (opts: any) => Promise<any>;
  now?: () => number;
  logger?: Pick<Console, 'warn'>;
};

type SongCommentsDeps = {
  getUserCookie: () => string;
  commentMusic: (opts: any) => Promise<any>;
  buildNeteaseSongCommentsPayload: (body: any, id: string, offset: number) => unknown;
  now?: () => number;
};

type ArtistDetailDeps = {
  getUserCookie: () => string;
  artistDetail: (opts: any) => Promise<any>;
  artistSongs: (opts: any) => Promise<any>;
  artistTopSong: (opts: any) => Promise<any>;
  mapSongRecord: (song: any) => any;
  now?: () => number;
  logger?: Pick<Console, 'warn'>;
};

type PlaylistTracksDeps = {
  getUserCookie: () => string;
  playlistTrackAll?: (opts: any) => Promise<any>;
  playlistDetail?: (opts: any) => Promise<any>;
  mapSongRecord: (song: any) => any;
  now?: () => number;
  logger?: Pick<Console, 'warn'>;
};

type PodcastCollectionDeps = {
  djSublist: (opts: any) => Promise<any>;
  userAudio: (opts: any) => Promise<any>;
  djPaygift: (opts: any) => Promise<any>;
  satiResourceSubList: (opts: any) => Promise<any>;
  recordRecentVoice: (opts: any) => Promise<any>;
  getUserCookie: () => string;
  firstArrayFrom: (obj: any, keys: string[]) => any[];
  mapPodcastCollectionRadios: (raw: any[], key?: string) => any[];
  mapPodcastVoiceItems: (raw: any[]) => any[];
  now?: () => number;
  logger?: Pick<Console, 'warn'>;
};

export async function searchNeteaseSongs(keywords: string, limit: number, deps: SearchDeps): Promise<any[]> {
  const logger = deps.logger || console;
  logger.log('[Search]', keywords, 'limit:', limit);

  const result = await deps.cloudsearch({ keywords, limit, cookie: deps.getUserCookie() });
  const songs = result.body && result.body.result && result.body.result.songs ? result.body.result.songs : [];
  let mapped = songs.map((song: any) => deps.mapSongRecord(song));

  const missing = mapped.filter((song: any) => !song.cover).map((song: any) => song.id);
  if (missing.length) {
    try {
      logger.log('[Search] backfilling covers for', missing.length, 'songs');
      const detail = await deps.songDetail({ ids: missing.join(','), cookie: deps.getUserCookie() });
      const songsArr = (detail.body && detail.body.songs) || [];
      const idToPic: Record<string, string> = {};
      songsArr.forEach((song: any) => {
        const pic = (song.al && song.al.picUrl) || (song.album && song.album.picUrl) || '';
        if (pic) idToPic[song.id] = pic;
      });
      mapped = mapped.map((song: any) => song.cover ? song : { ...song, cover: idToPic[song.id] || '' });
    } catch (error: any) {
      logger.warn('[Search] backfill failed:', error.message);
    }
  }

  return mapped;
}

export async function fetchNeteaseSongUrl(
  id: unknown,
  loginInfo: any,
  qualityPreference: unknown,
  deps: SongUrlDeps
): Promise<Record<string, unknown>> {
  const logger = deps.logger || console;
  logger.log('[SongUrl] id:', id, 'logged-in:', !!deps.getUserCookie());
  const requestedQuality = deps.normalizeQualityPreference(qualityPreference);
  const svipReady = deps.hasNeteaseSvip(loginInfo);
  const qualities = deps.qualityCandidatesFrom(requestedQuality, deps.qualityCandidates)
    .filter(q => !q.svip || svipReady);

  let trialFallback: Record<string, unknown> | null = null;
  let lastData: any = null;
  let lastError: any = null;

  for (const q of qualities) {
    try {
      let result;
      try {
        result = await deps.songUrlV1({ id, level: q.level, cookie: deps.getUserCookie() });
      } catch (e) {
        result = await deps.songUrl({ id, br: q.br, cookie: deps.getUserCookie() });
      }
      const d = result.body && result.body.data && result.body.data[0];
      if (d) lastData = d;
      const url = d && d.url;
      const freeTrial = d && d.freeTrialInfo;
      logger.log('[SongUrl]', q.level, '->', url ? 'OK' : 'no url', freeTrial ? '(TRIAL)' : '');
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
          restriction: deps.classifyNeteasePlaybackRestriction(d, loginInfo),
        };
      }
    } catch (err: any) {
      lastError = err;
      logger.log('[SongUrl]', q.level, 'failed:', err.message);
    }
  }
  if (trialFallback) return trialFallback;
  const restriction = deps.classifyNeteasePlaybackRestriction(lastData, loginInfo);
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

export async function fetchNeteaseLyric(
  id: unknown,
  deps: LyricDeps
): Promise<Record<string, unknown>> {
  const now = deps.now || Date.now;
  const logger = deps.logger || console;
  let body: any = {};
  let source = 'lyric';
  try {
    if (typeof deps.lyricNew === 'function') {
      const nr = await deps.lyricNew({ id, cookie: deps.getUserCookie(), timestamp: now() });
      body = nr.body || {};
      source = 'lyric_new';
    }
  } catch (errNew: any) {
    logger.warn('[LyricNew]', errNew.message);
  }
  if (!((body.lrc && body.lrc.lyric) || (body.yrc && body.yrc.lyric))) {
    const r = await deps.lyric({ id, cookie: deps.getUserCookie(), timestamp: now() });
    body = r.body || body || {};
    source = 'lyric';
  }
  return {
    lyric: (body.lrc && body.lrc.lyric) || '',
    tlyric: (body.tlyric && body.tlyric.lyric) || '',
    yrc: (body.yrc && body.yrc.lyric) || '',
    source,
  };
}

export async function fetchNeteaseSongComments(
  id: string,
  limit: number,
  offset: number,
  deps: SongCommentsDeps
): Promise<unknown> {
  const now = deps.now || Date.now;
  const normalizedLimit = Math.max(6, Math.min(50, Number(limit) || 20));
  const normalizedOffset = Math.max(0, Number(offset) || 0);
  const r = await deps.commentMusic({ id, limit: normalizedLimit, offset: normalizedOffset, cookie: deps.getUserCookie(), timestamp: now() });
  const body = r.body || r || {};
  return deps.buildNeteaseSongCommentsPayload(body, id, normalizedOffset);
}

export async function fetchNeteaseArtistDetail(
  id: string,
  limit: number,
  deps: ArtistDetailDeps
): Promise<Record<string, unknown>> {
  const now = deps.now || Date.now;
  const logger = deps.logger || console;
  const normalizedLimit = Math.max(10, Math.min(80, Number(limit) || 30));
  let detailBody: any = {};
  try {
    const detail = await deps.artistDetail({ id, cookie: deps.getUserCookie(), timestamp: now() });
    detailBody = detail.body || detail || {};
  } catch (e: any) {
    logger.warn('[ArtistDetail] detail failed:', e.message);
  }
  let rawSongs: any[] = [];
  try {
    const list = await deps.artistSongs({ id, order: 'hot', limit: normalizedLimit, offset: 0, cookie: deps.getUserCookie(), timestamp: now() });
    const b = list.body || list || {};
    rawSongs = (b.songs || (b.data && b.data.songs) || []);
  } catch (e: any) {
    logger.warn('[ArtistSongs] hot failed:', e.message);
  }
  if (!rawSongs.length) {
    const top = await deps.artistTopSong({ id, cookie: deps.getUserCookie(), timestamp: now() });
    const b = top.body || top || {};
    rawSongs = b.songs || [];
  }
  const artist = detailBody.artist || (detailBody.data && (detailBody.data.artist || detailBody.data)) || {};
  const songs = rawSongs.map(deps.mapSongRecord).filter((s: any) => s.id).slice(0, normalizedLimit);
  return {
    id,
    artist: {
      id: artist.id || id,
      name: artist.name || artist.artistName || '',
      avatar: artist.avatar || artist.cover || artist.picUrl || artist.img1v1Url || '',
      brief: artist.briefDesc || artist.description || artist.desc || '',
      musicSize: artist.musicSize || artist.songSize || 0,
      albumSize: artist.albumSize || 0,
    },
    songs,
    body: detailBody,
  };
}

export async function fetchNeteasePlaylistTracks(
  id: string,
  deps: PlaylistTracksDeps
): Promise<Record<string, unknown>> {
  const now = deps.now || Date.now;
  const logger = deps.logger || console;
  let playlistMeta: any = { id, name: '', cover: '', trackCount: 0 };
  let rawTracks: any[] = [];

  if (typeof deps.playlistTrackAll === 'function') {
    try {
      const all = await deps.playlistTrackAll({ id, limit: 500, offset: 0, cookie: deps.getUserCookie(), timestamp: now() });
      rawTracks = (all.body && (all.body.songs || all.body.tracks)) || [];
    } catch (err: any) {
      logger.warn('[PlaylistTracks] playlist_track_all failed, fallback to detail:', err.message);
    }
  }

  if (!rawTracks.length && typeof deps.playlistDetail === 'function') {
    const detail = await deps.playlistDetail({ id, s: 0, cookie: deps.getUserCookie(), timestamp: now() });
    const pl = (detail.body && detail.body.playlist) || {};
    playlistMeta = { id: pl.id || id, name: pl.name || '', cover: pl.coverImgUrl || '', trackCount: pl.trackCount || 0 };
    rawTracks = pl.tracks || [];
  }

  const tracks = rawTracks.map(deps.mapSongRecord).filter((t: any) => t.id);

  if (!playlistMeta.trackCount) playlistMeta.trackCount = tracks.length;
  return { playlist: playlistMeta, tracks };
}

export async function buildDiscoverHome(deps: DiscoverHomeDeps): Promise<Record<string, any>> {
  const now = deps.now || Date.now;
  const info = await deps.getLoginInfo();
  const loggedIn = !!(info && info.loggedIn);
  if (!loggedIn) {
    return {
      loggedIn: false,
      user: null,
      dailySongs: [],
      playlists: [],
      podcasts: [],
      mode: 'starter',
      updatedAt: now(),
    };
  }

  const tasks = [
    deps.personalized({ limit: 8, cookie: deps.getUserCookie(), timestamp: now() }),
    deps.djHot({ limit: 6, offset: 0, cookie: deps.getUserCookie(), timestamp: now() }),
    deps.recommendResource({ cookie: deps.getUserCookie(), timestamp: now() }),
    deps.recommendSongs({ cookie: deps.getUserCookie(), timestamp: now() }),
  ];
  const result = await Promise.allSettled(tasks);

  const personalizedBody = result[0].status === 'fulfilled' && result[0].value && result[0].value.body || {};
  const publicPlaylists = (personalizedBody.result || personalizedBody.data || [])
    .map((playlist: any) => deps.mapDiscoverPlaylist(playlist, '推荐歌单'))
    .filter((playlist: any) => playlist.id && playlist.name)
    .slice(0, 8);

  const podcastBody = result[1].status === 'fulfilled' && result[1].value && result[1].value.body || {};
  const podcastRaw = podcastBody.djRadios || podcastBody.djradios || podcastBody.radios || podcastBody.data || [];
  const podcasts = (Array.isArray(podcastRaw) ? podcastRaw : [])
    .map(deps.mapPodcastRadio)
    .filter((podcast: any) => podcast.id && !deps.isLowSignalPodcastItem(podcast))
    .slice(0, 6);

  let privatePlaylists: any[] = [];
  if (result[2].status === 'fulfilled' && result[2].value) {
    const body = result[2].value.body || {};
    const raw = body.recommend || body.data || [];
    privatePlaylists = (Array.isArray(raw) ? raw : [])
      .map((playlist: any) => deps.mapDiscoverPlaylist(playlist, '私人推荐'))
      .filter((playlist: any) => playlist.id && playlist.name)
      .slice(0, 6);
  }

  let dailySongs: any[] = [];
  if (result[3].status === 'fulfilled' && result[3].value) {
    const body = result[3].value.body || {};
    const raw = body.data && (body.data.dailySongs || body.data.recommend) || body.recommend || [];
    dailySongs = (Array.isArray(raw) ? raw : [])
      .map(deps.mapSongRecord)
      .filter((song: any) => song.id && song.name)
      .slice(0, 12);
  }

  return {
    loggedIn,
    user: loggedIn ? { userId: info.userId, nickname: info.nickname || '', avatar: info.avatar || '' } : null,
    dailySongs,
    playlists: privatePlaylists.concat(publicPlaylists).slice(0, 10),
    podcasts,
    updatedAt: now(),
  };
}

export async function fetchNeteasePodcastCollectionItems(
  key: string,
  info: any,
  limit: number,
  offset: number,
  deps: PodcastCollectionDeps
): Promise<{ itemType: string; items: any[] }> {
  const normalizedLimit = Math.max(8, Math.min(60, Number(limit) || 30));
  const normalizedOffset = Math.max(0, Number(offset) || 0);
  const now = deps.now || Date.now;
  const logger = deps.logger || console;

  if (key === 'collect') {
    const response = await deps.djSublist({
      limit: normalizedLimit,
      offset: normalizedOffset,
      cookie: deps.getUserCookie(),
      timestamp: now(),
    });
    const raw = deps.firstArrayFrom(response.body, ['djRadios', 'djradios', 'radios', 'data']);
    return { itemType: 'radio', items: deps.mapPodcastCollectionRadios(raw, key) };
  }

  if (key === 'created') {
    const response = await deps.userAudio({
      uid: info.userId,
      cookie: deps.getUserCookie(),
      timestamp: now(),
    });
    const raw = deps.firstArrayFrom(response.body, ['data', 'djRadios', 'djradios', 'radios']);
    return { itemType: 'radio', items: deps.mapPodcastCollectionRadios(raw, key) };
  }

  if (key === 'paid') {
    const response = await deps.djPaygift({
      limit: normalizedLimit,
      offset: normalizedOffset,
      cookie: deps.getUserCookie(),
      timestamp: now(),
    });
    const raw = deps.firstArrayFrom(response.body, ['data', 'djRadios', 'djradios', 'radios']);
    return { itemType: 'radio', items: deps.mapPodcastCollectionRadios(raw, key) };
  }

  if (key === 'liked') {
    let raw: any[] = [];
    try {
      const response = await deps.satiResourceSubList({
        cookie: deps.getUserCookie(),
        timestamp: now(),
      });
      raw = deps.firstArrayFrom(response.body, ['data', 'resources', 'list']);
    } catch (error: any) {
      logger.warn('[MyPodcastLiked] sati sub list failed:', error.message);
    }

    if (!raw.length) {
      try {
        const response = await deps.recordRecentVoice({
          limit: normalizedLimit,
          cookie: deps.getUserCookie(),
          timestamp: now(),
        });
        raw = deps.firstArrayFrom(response.body, ['data', 'list', 'resources']);
      } catch (error: any) {
        logger.warn('[MyPodcastLiked] recent voice fallback failed:', error.message);
      }
    }

    return { itemType: 'voice', items: deps.mapPodcastVoiceItems(raw) };
  }

  return { itemType: 'radio', items: [] };
}
