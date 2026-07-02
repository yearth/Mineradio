export type JsonSender = (res: unknown, data: unknown, status?: number) => void;

export type NeteaseLibraryRouteContext = {
  pathname: string;
  url: URL;
  req: any;
  res: unknown;
  sendJSON: JsonSender;
  readRequestBody: (req: unknown) => Promise<any>;
  getLoginInfo: () => Promise<Record<string, any>>;
  requireLogin: (res: unknown) => Promise<Record<string, any> | null>;
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
  now: () => number;
  logger: Pick<Console, 'error' | 'warn'>;
};

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, parseInt(raw || String(fallback), 10) || fallback));
}

export async function handleNeteaseLibraryRoutes(ctx: NeteaseLibraryRouteContext): Promise<boolean> {
  if (ctx.pathname === '/api/user/playlists') {
    try {
      const info = await ctx.getLoginInfo();
      if (!info.loggedIn || !info.userId) {
        ctx.sendJSON(ctx.res, { loggedIn: false, playlists: [] });
        return true;
      }
      const limit = clampInt(ctx.url.searchParams.get('limit'), 60, 12, 100);
      const r = await ctx.userPlaylist({ uid: info.userId, limit, cookie: ctx.getUserCookie(), timestamp: ctx.now() });
      const list = ((r.body && r.body.playlist) || []).map((pl: any) => ({
        id: pl.id,
        name: pl.name,
        cover: pl.coverImgUrl || '',
        trackCount: pl.trackCount || 0,
        playCount: pl.playCount || 0,
        creator: (pl.creator && pl.creator.nickname) || '',
        subscribed: !!pl.subscribed,
        specialType: pl.specialType || 0,
      }));
      ctx.sendJSON(ctx.res, { loggedIn: true, userId: info.userId, playlists: list });
    } catch (err: any) {
      ctx.logger.error('[UserPlaylists]', err);
      ctx.sendJSON(ctx.res, { error: err.message, loggedIn: false, playlists: [] }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/song/like/check') {
    try {
      const info = await ctx.requireLogin(ctx.res);
      if (!info) return true;
      const ids = String(ctx.url.searchParams.get('ids') || ctx.url.searchParams.get('id') || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (!ids.length) {
        ctx.sendJSON(ctx.res, { error: 'Missing song id', liked: {}, ids: [] }, 400);
        return true;
      }
      let likedIds: string[] = [];
      try {
        if (typeof ctx.songLikeCheck === 'function') {
          const checked = await ctx.songLikeCheck({ ids: JSON.stringify(ids.map(Number).filter(Boolean)), cookie: ctx.getUserCookie(), timestamp: ctx.now() });
          const data = (checked.body && (checked.body.data || checked.body.ids)) || checked.body || {};
          if (Array.isArray(data)) likedIds = data.map(String);
          else if (data && typeof data === 'object') {
            ids.forEach(id => {
              if (data[id] || data[String(id)] || data[Number(id)]) likedIds.push(String(id));
            });
          }
        }
      } catch (e: any) {
        ctx.logger.warn('[LikeCheck] direct check failed:', e.message);
      }
      if (!likedIds.length) {
        const r = await ctx.likelist({ uid: info.userId, cookie: ctx.getUserCookie(), timestamp: ctx.now() });
        likedIds = ((r.body && r.body.ids) || []).map(String);
      }
      const set = new Set(likedIds);
      const liked: Record<string, boolean> = {};
      ids.forEach(id => { liked[id] = set.has(String(id)); });
      ctx.sendJSON(ctx.res, { loggedIn: true, ids, liked });
    } catch (err: any) {
      ctx.logger.error('[LikeCheck]', err);
      ctx.sendJSON(ctx.res, { error: err.message }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/song/like') {
    try {
      const info = await ctx.requireLogin(ctx.res);
      if (!info) return true;
      const body = ctx.req.method === 'POST' ? await ctx.readRequestBody(ctx.req) : {};
      const id = body.id || ctx.url.searchParams.get('id');
      const nextLike = String(body.like != null ? body.like : (ctx.url.searchParams.get('like') || 'true')) !== 'false';
      if (!id) {
        ctx.sendJSON(ctx.res, { error: 'Missing song id' }, 400);
        return true;
      }
      const r = await ctx.likeSong({ id, like: String(nextLike), cookie: ctx.getUserCookie(), timestamp: ctx.now() });
      const code = (r.body && r.body.code) || r.code || 200;
      ctx.sendJSON(ctx.res, { loggedIn: true, id, liked: nextLike, code, body: r.body || r });
    } catch (err: any) {
      ctx.logger.error('[Like]', err);
      ctx.sendJSON(ctx.res, { error: err.message }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/playlist/create') {
    try {
      const info = await ctx.requireLogin(ctx.res);
      if (!info) return true;
      const body = ctx.req.method === 'POST' ? await ctx.readRequestBody(ctx.req) : {};
      const name = String(body.name || ctx.url.searchParams.get('name') || '').trim();
      const privacy = String(body.privacy || ctx.url.searchParams.get('privacy') || '0');
      if (!name) {
        ctx.sendJSON(ctx.res, { error: 'Missing playlist name' }, 400);
        return true;
      }
      const r = await ctx.playlistCreate({ name, privacy, cookie: ctx.getUserCookie(), timestamp: ctx.now() });
      const created = (r.body && (r.body.playlist || r.body.data)) || {};
      ctx.sendJSON(ctx.res, { loggedIn: true, playlist: created, body: r.body || r });
    } catch (err: any) {
      ctx.logger.error('[PlaylistCreate]', err);
      ctx.sendJSON(ctx.res, { error: err.message }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/playlist/add-song') {
    try {
      const info = await ctx.requireLogin(ctx.res);
      if (!info) return true;
      const body = ctx.req.method === 'POST' ? await ctx.readRequestBody(ctx.req) : {};
      const pid = body.pid || ctx.url.searchParams.get('pid');
      const id = body.id || body.ids || ctx.url.searchParams.get('id') || ctx.url.searchParams.get('ids');
      if (!pid || !id) {
        ctx.sendJSON(ctx.res, { error: 'Missing playlist id or song id' }, 400);
        return true;
      }
      const attempts: any[] = [];
      let finalBody: any = null;
      let finalCode = 0;
      let finalMessage = '';
      let success = false;

      const primary = await ctx.playlistTracks({ op: 'add', pid, tracks: String(id), cookie: ctx.getUserCookie(), timestamp: ctx.now() });
      finalBody = primary.body || primary;
      finalCode = ctx.normalizeApiCode(primary);
      finalMessage = ctx.normalizeApiMessage(primary);
      success = finalCode === 200 && !(finalBody && finalBody.error);
      attempts.push({ api: 'playlist_tracks', code: finalCode, message: finalMessage, body: finalBody });

      if (!success && typeof ctx.playlistTrackAdd === 'function') {
        try {
          const fallback = await ctx.playlistTrackAdd({ pid, ids: String(id), cookie: ctx.getUserCookie(), timestamp: ctx.now() });
          finalBody = fallback.body || fallback;
          finalCode = ctx.normalizeApiCode(fallback);
          finalMessage = ctx.normalizeApiMessage(fallback);
          success = finalCode === 200 && !(finalBody && finalBody.error);
          attempts.push({ api: 'playlist_track_add', code: finalCode, message: finalMessage, body: finalBody });
        } catch (fallbackErr: any) {
          const errBody = fallbackErr.body || fallbackErr.response || {};
          finalBody = errBody;
          finalCode = ctx.normalizeApiCode(errBody);
          finalMessage = ctx.normalizeApiMessage(errBody) || fallbackErr.message || '';
          attempts.push({ api: 'playlist_track_add', code: finalCode, message: finalMessage, body: errBody });
        }
      }

      if (!success) {
        ctx.sendJSON(ctx.res, { loggedIn: true, pid, id, success: false, code: finalCode, error: finalMessage || 'PLAYLIST_ADD_FAILED', attempts }, finalCode === 401 ? 401 : 409);
        return true;
      }
      ctx.sendJSON(ctx.res, { loggedIn: true, pid, id, success: true, code: finalCode, body: finalBody, attempts });
    } catch (err: any) {
      ctx.logger.error('[PlaylistAddSong]', err);
      ctx.sendJSON(ctx.res, { error: err.message }, 500);
    }
    return true;
  }

  return false;
}
