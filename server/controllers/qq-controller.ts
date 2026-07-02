export type JsonSender = (res: unknown, data: unknown, status?: number) => void;

export type QQRouteContext = {
  pathname: string;
  url: URL;
  req: unknown;
  res: unknown;
  sendJSON: JsonSender;
  readRequestBody: (req: unknown) => Promise<any>;
  parseCookieString: (raw: string) => Record<string, any>;
  normalizeQQCookieInput: (raw: unknown) => string;
  qqCookieUin: (cookie: Record<string, any>) => unknown;
  qqCookieMusicKey: (cookie: Record<string, any>) => unknown;
  saveQQCookie: (cookie: string) => void;
  getQQLoginInfo: () => Promise<unknown>;
  handleQQSearch: (keywords: string, limit: number) => Promise<unknown>;
  handleQQSongUrl: (mid: string, mediaMid: string, quality: string) => Promise<unknown>;
  handleQQLyric: (mid: string, id: string) => Promise<unknown>;
  handleQQUserPlaylists: () => Promise<unknown>;
  handleQQPlaylistTracks: (id: string) => Promise<unknown>;
  handleQQArtistDetail: (mid: string, limit: number) => Promise<unknown>;
  handleQQSongComments: (id: string, mid: string, limit: number, offset: number) => Promise<unknown>;
  logger: Pick<Console, 'error'>;
};

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, parseInt(raw || String(fallback), 10) || fallback));
}

export async function handleQQRoutes(ctx: QQRouteContext): Promise<boolean> {
  if (ctx.pathname === '/api/qq/search') {
    try {
      const kw = ctx.url.searchParams.get('keywords') || '';
      const limit = clampInt(ctx.url.searchParams.get('limit'), 8, 4, 12);
      const songs = await ctx.handleQQSearch(kw, limit);
      ctx.sendJSON(ctx.res, { provider: 'qq', songs });
    } catch (err: any) {
      ctx.logger.error('[QQSearch]', err);
      ctx.sendJSON(ctx.res, { provider: 'qq', error: err.message, songs: [] }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/qq/song/url') {
    try {
      const mid = ctx.url.searchParams.get('mid') || ctx.url.searchParams.get('id') || '';
      const mediaMid = ctx.url.searchParams.get('mediaMid') || ctx.url.searchParams.get('media_mid') || '';
      const quality = ctx.url.searchParams.get('quality') || '';
      ctx.sendJSON(ctx.res, await ctx.handleQQSongUrl(mid, mediaMid, quality));
    } catch (err: any) {
      ctx.logger.error('[QQSongUrl]', err);
      ctx.sendJSON(ctx.res, { provider: 'qq', url: '', playable: false, error: err.message }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/qq/lyric') {
    try {
      const mid = ctx.url.searchParams.get('mid') || ctx.url.searchParams.get('songmid') || '';
      const id = ctx.url.searchParams.get('id') || ctx.url.searchParams.get('qqId') || '';
      if (!mid && !id) {
        ctx.sendJSON(ctx.res, { provider: 'qq', error: 'Missing QQ song mid or id', lyric: '' }, 400);
        return true;
      }
      ctx.sendJSON(ctx.res, await ctx.handleQQLyric(mid, id));
    } catch (err: any) {
      ctx.logger.error('[QQLyric]', err);
      ctx.sendJSON(ctx.res, { provider: 'qq', error: err.message, lyric: '' }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/qq/login/status') {
    try {
      ctx.sendJSON(ctx.res, await ctx.getQQLoginInfo());
    } catch (err: any) {
      ctx.logger.error('[QQLoginStatus]', err);
      ctx.sendJSON(ctx.res, { provider: 'qq', loggedIn: false, error: err.message }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/qq/login/cookie') {
    try {
      const body = await ctx.readRequestBody(ctx.req);
      const raw = body.cookie || body.data || body.text || '';
      const normalized = ctx.normalizeQQCookieInput(raw);
      const obj = ctx.parseCookieString(normalized);
      if (!ctx.qqCookieUin(obj) || !ctx.qqCookieMusicKey(obj)) {
        ctx.sendJSON(ctx.res, { provider: 'qq', loggedIn: false, error: 'INVALID_QQ_COOKIE', message: 'QQ cookie 缺少 uin 或有效登录票据' }, 400);
        return true;
      }
      ctx.saveQQCookie(normalized);
      ctx.sendJSON(ctx.res, { ...(await ctx.getQQLoginInfo() as Record<string, unknown>), saved: true });
    } catch (err: any) {
      ctx.logger.error('[QQLoginCookie]', err);
      ctx.sendJSON(ctx.res, { provider: 'qq', loggedIn: false, error: err.message }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/qq/logout') {
    ctx.saveQQCookie('');
    ctx.sendJSON(ctx.res, { provider: 'qq', ok: true, loggedIn: false });
    return true;
  }

  if (ctx.pathname === '/api/qq/user/playlists') {
    try {
      ctx.sendJSON(ctx.res, await ctx.handleQQUserPlaylists());
    } catch (err: any) {
      ctx.logger.error('[QQUserPlaylists]', err);
      ctx.sendJSON(ctx.res, { provider: 'qq', loggedIn: false, error: err.message, playlists: [] }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/qq/playlist/tracks') {
    try {
      const id = ctx.url.searchParams.get('id') || ctx.url.searchParams.get('disstid') || '';
      ctx.sendJSON(ctx.res, await ctx.handleQQPlaylistTracks(id));
    } catch (err: any) {
      ctx.logger.error('[QQPlaylistTracks]', err);
      ctx.sendJSON(ctx.res, { provider: 'qq', error: err.message, tracks: [] }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/qq/artist/detail') {
    try {
      const mid = ctx.url.searchParams.get('mid') || ctx.url.searchParams.get('singermid') || '';
      const limit = clampInt(ctx.url.searchParams.get('limit'), 36, 10, 80);
      if (!mid) {
        ctx.sendJSON(ctx.res, { provider: 'qq', error: 'MISSING_SINGER_MID', artist: null, songs: [] }, 400);
        return true;
      }
      ctx.sendJSON(ctx.res, await ctx.handleQQArtistDetail(mid, limit));
    } catch (err: any) {
      ctx.logger.error('[QQArtistDetail]', err);
      ctx.sendJSON(ctx.res, { provider: 'qq', error: err.message, artist: null, songs: [] }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/qq/song/comments') {
    try {
      const id = ctx.url.searchParams.get('id') || ctx.url.searchParams.get('qqId') || '';
      const mid = ctx.url.searchParams.get('mid') || ctx.url.searchParams.get('songmid') || '';
      const limit = clampInt(ctx.url.searchParams.get('limit'), 20, 6, 50);
      const offset = Math.max(0, parseInt(ctx.url.searchParams.get('offset') || '0', 10) || 0);
      ctx.sendJSON(ctx.res, await ctx.handleQQSongComments(id, mid, limit, offset));
    } catch (err: any) {
      ctx.logger.error('[QQSongComments]', err);
      ctx.sendJSON(ctx.res, { provider: 'qq', error: err.message, comments: [] }, 500);
    }
    return true;
  }

  return false;
}
