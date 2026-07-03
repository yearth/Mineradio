import {
  addNeteaseSongToPlaylist,
  checkNeteaseSongLikes,
  createNeteasePlaylist,
  fetchNeteaseUserPlaylists,
  toggleNeteaseSongLike,
} from '../services/netease-library-orchestration';

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
      const limit = clampInt(ctx.url.searchParams.get('limit'), 60, 12, 100);
      const payload = await fetchNeteaseUserPlaylists(info, limit, ctx);
      ctx.sendJSON(ctx.res, payload);
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
      const payload = await checkNeteaseSongLikes(ids, info, ctx);
      ctx.sendJSON(ctx.res, payload);
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
      const payload = await toggleNeteaseSongLike(id, nextLike, ctx);
      ctx.sendJSON(ctx.res, payload);
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
      const payload = await createNeteasePlaylist(name, privacy, ctx);
      ctx.sendJSON(ctx.res, payload);
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
      const payload = await addNeteaseSongToPlaylist(pid, id, ctx);
      if (!payload.success) {
        ctx.sendJSON(ctx.res, payload, payload.code === 401 ? 401 : 409);
        return true;
      }
      ctx.sendJSON(ctx.res, payload);
    } catch (err: any) {
      ctx.logger.error('[PlaylistAddSong]', err);
      ctx.sendJSON(ctx.res, { error: err.message }, 500);
    }
    return true;
  }

  return false;
}
