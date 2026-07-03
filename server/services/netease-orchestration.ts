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
