type Logger = Pick<Console, 'warn'>;

type LibraryDeps = {
  getUserCookie: () => string;
  userPlaylist: (opts: Record<string, any>) => Promise<any>;
  songLikeCheck?: (opts: Record<string, any>) => Promise<any>;
  likelist: (opts: Record<string, any>) => Promise<any>;
  likeSong: (opts: Record<string, any>) => Promise<any>;
  playlistCreate: (opts: Record<string, any>) => Promise<any>;
  playlistTracks: (opts: Record<string, any>) => Promise<any>;
  playlistTrackAdd?: (opts: Record<string, any>) => Promise<any>;
  normalizeApiCode: (input: any) => number;
  normalizeApiMessage: (input: any) => string;
  now?: () => number;
  logger?: Logger;
};

export async function fetchNeteaseUserPlaylists(
  info: Record<string, any>,
  limit: number,
  deps: Pick<LibraryDeps, 'getUserCookie' | 'userPlaylist' | 'now'>
): Promise<Record<string, any>> {
  if (!info.loggedIn || !info.userId) {
    return { loggedIn: false, playlists: [] };
  }
  const now = deps.now || Date.now;
  const r = await deps.userPlaylist({ uid: info.userId, limit, cookie: deps.getUserCookie(), timestamp: now() });
  const playlists = ((r.body && r.body.playlist) || []).map((pl: any) => ({
    id: pl.id,
    name: pl.name,
    cover: pl.coverImgUrl || '',
    trackCount: pl.trackCount || 0,
    playCount: pl.playCount || 0,
    creator: (pl.creator && pl.creator.nickname) || '',
    subscribed: !!pl.subscribed,
    specialType: pl.specialType || 0,
  }));
  return { loggedIn: true, userId: info.userId, playlists };
}

export async function checkNeteaseSongLikes(
  ids: string[],
  info: Record<string, any>,
  deps: Pick<LibraryDeps, 'getUserCookie' | 'songLikeCheck' | 'likelist' | 'now' | 'logger'>
): Promise<Record<string, any>> {
  const now = deps.now || Date.now;
  const logger = deps.logger || console;
  let likedIds: string[] = [];
  try {
    if (typeof deps.songLikeCheck === 'function') {
      const checked = await deps.songLikeCheck({ ids: JSON.stringify(ids.map(Number).filter(Boolean)), cookie: deps.getUserCookie(), timestamp: now() });
      const data = (checked.body && (checked.body.data || checked.body.ids)) || checked.body || {};
      if (Array.isArray(data)) likedIds = data.map(String);
      else if (data && typeof data === 'object') {
        ids.forEach(id => {
          if (data[id] || data[String(id)] || data[Number(id)]) likedIds.push(String(id));
        });
      }
    }
  } catch (e: any) {
    logger.warn('[LikeCheck] direct check failed:', e.message);
  }
  if (!likedIds.length) {
    const r = await deps.likelist({ uid: info.userId, cookie: deps.getUserCookie(), timestamp: now() });
    likedIds = ((r.body && r.body.ids) || []).map(String);
  }
  const set = new Set(likedIds);
  const liked: Record<string, boolean> = {};
  ids.forEach(id => { liked[id] = set.has(String(id)); });
  return { loggedIn: true, ids, liked };
}

export async function toggleNeteaseSongLike(
  id: string,
  nextLike: boolean,
  deps: Pick<LibraryDeps, 'getUserCookie' | 'likeSong' | 'now'>
): Promise<Record<string, any>> {
  const now = deps.now || Date.now;
  const r = await deps.likeSong({ id, like: String(nextLike), cookie: deps.getUserCookie(), timestamp: now() });
  const code = (r.body && r.body.code) || r.code || 200;
  return { loggedIn: true, id, liked: nextLike, code, body: r.body || r };
}

export async function createNeteasePlaylist(
  rawName: string,
  privacy: string,
  deps: Pick<LibraryDeps, 'getUserCookie' | 'playlistCreate' | 'now'>
): Promise<Record<string, any>> {
  const now = deps.now || Date.now;
  const name = String(rawName || '').trim();
  const r = await deps.playlistCreate({ name, privacy, cookie: deps.getUserCookie(), timestamp: now() });
  const created = (r.body && (r.body.playlist || r.body.data)) || {};
  return { loggedIn: true, playlist: created, body: r.body || r };
}

export async function addNeteaseSongToPlaylist(
  pid: string,
  id: string,
  deps: Pick<LibraryDeps, 'getUserCookie' | 'playlistTracks' | 'playlistTrackAdd' | 'normalizeApiCode' | 'normalizeApiMessage' | 'now'>
): Promise<Record<string, any>> {
  const now = deps.now || Date.now;
  const attempts: any[] = [];
  let finalBody: any = null;
  let finalCode = 0;
  let finalMessage = '';
  let success = false;

  const primary = await deps.playlistTracks({ op: 'add', pid, tracks: String(id), cookie: deps.getUserCookie(), timestamp: now() });
  finalBody = primary.body || primary;
  finalCode = deps.normalizeApiCode(primary);
  finalMessage = deps.normalizeApiMessage(primary);
  success = finalCode === 200 && !(finalBody && finalBody.error);
  attempts.push({ api: 'playlist_tracks', code: finalCode, message: finalMessage, body: finalBody });

  if (!success && typeof deps.playlistTrackAdd === 'function') {
    try {
      const fallback = await deps.playlistTrackAdd({ pid, ids: String(id), cookie: deps.getUserCookie(), timestamp: now() });
      finalBody = fallback.body || fallback;
      finalCode = deps.normalizeApiCode(fallback);
      finalMessage = deps.normalizeApiMessage(fallback);
      success = finalCode === 200 && !(finalBody && finalBody.error);
      attempts.push({ api: 'playlist_track_add', code: finalCode, message: finalMessage, body: finalBody });
    } catch (fallbackErr: any) {
      const errBody = fallbackErr.body || fallbackErr.response || {};
      finalBody = errBody;
      finalCode = deps.normalizeApiCode(errBody);
      finalMessage = deps.normalizeApiMessage(errBody) || fallbackErr.message || '';
      attempts.push({ api: 'playlist_track_add', code: finalCode, message: finalMessage, body: errBody });
    }
  }

  if (!success) {
    return { loggedIn: true, pid, id, success: false, code: finalCode, error: finalMessage || 'PLAYLIST_ADD_FAILED', attempts };
  }
  return { loggedIn: true, pid, id, success: true, code: finalCode, body: finalBody, attempts };
}
