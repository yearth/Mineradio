export type JsonSender = (res: unknown, data: unknown, status?: number) => void;

type NeteaseApiResult = {
  body?: any;
  code?: number | string;
  message?: string;
};

export type NeteaseAuthRouteContext = {
  pathname: string;
  url: URL;
  req: unknown;
  res: unknown;
  sendJSON: JsonSender;
  readRequestBody: (req: unknown) => Promise<any>;
  normalizeCookieHeader: (raw: unknown) => string;
  parseCookieString: (raw: string) => Record<string, any>;
  saveCookie: (cookie: string) => void;
  getUserCookie: () => string;
  getLoginInfo: () => Promise<Record<string, any>>;
  pendingNeteaseLoginInfo: (body?: any) => Record<string, any>;
  loginQrKey: (opts: Record<string, any>) => Promise<NeteaseApiResult>;
  loginQrCreate: (opts: Record<string, any>) => Promise<NeteaseApiResult>;
  loginQrCheck: (opts: Record<string, any>) => Promise<NeteaseApiResult>;
  readCookieFromResponse: (response: NeteaseApiResult) => string;
  normalizeLoginInfo: (profile: any, account: any, data: any) => Record<string, any>;
  logout: (opts: Record<string, any>) => Promise<unknown>;
  now: () => number;
  logger: Pick<Console, 'error' | 'warn'>;
};

export async function handleNeteaseAuthRoutes(ctx: NeteaseAuthRouteContext): Promise<boolean> {
  if (ctx.pathname === '/api/login/cookie') {
    try {
      const body = await ctx.readRequestBody(ctx.req);
      const raw = body.cookie || body.data || body.text || '';
      const normalized = ctx.normalizeCookieHeader(raw);
      const obj = ctx.parseCookieString(normalized);
      if (!obj.MUSIC_U) {
        ctx.sendJSON(ctx.res, { loggedIn: false, error: 'INVALID_NETEASE_COOKIE', message: '网易云 cookie 缺少 MUSIC_U' }, 400);
        return true;
      }
      ctx.saveCookie(normalized);
      let info = await ctx.getLoginInfo();
      if (!info.loggedIn && ctx.getUserCookie()) {
        info = ctx.pendingNeteaseLoginInfo();
      }
      ctx.sendJSON(ctx.res, { ...info, saved: true, hasCookie: !!ctx.getUserCookie() });
    } catch (err: any) {
      ctx.logger.error('[LoginCookie]', err);
      ctx.sendJSON(ctx.res, { loggedIn: false, error: err.message }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/login/qr/key') {
    try {
      const r = await ctx.loginQrKey({ timestamp: ctx.now() });
      const key = r.body && r.body.data && r.body.data.unikey;
      ctx.sendJSON(ctx.res, { key });
    } catch (err: any) {
      ctx.sendJSON(ctx.res, { error: err.message }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/login/qr/create') {
    try {
      const key = ctx.url.searchParams.get('key');
      const r = await ctx.loginQrCreate({ key, qrimg: true, timestamp: ctx.now() });
      const d = r.body && r.body.data;
      ctx.sendJSON(ctx.res, { img: d && d.qrimg, url: d && d.qrurl });
    } catch (err: any) {
      ctx.sendJSON(ctx.res, { error: err.message }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/login/qr/check') {
    try {
      const key = ctx.url.searchParams.get('key');
      let r = await ctx.loginQrCheck({ key, noCookie: true, timestamp: ctx.now() });
      let body = r.body || {};
      let code = Number(body.code || r.code);
      let msg = body.message || r.message || '';
      let cookie = ctx.readCookieFromResponse(r);
      if (code === 803 && !cookie) {
        try {
          const retry = await ctx.loginQrCheck({ key, timestamp: ctx.now() });
          const retryCookie = ctx.readCookieFromResponse(retry);
          if (retryCookie) {
            r = retry;
            body = retry.body || body;
            code = Number(body.code || retry.code || code);
            msg = body.message || retry.message || msg;
            cookie = retryCookie;
          }
        } catch (retryErr: any) {
          ctx.logger.warn('[Login] qr cookie retry failed:', retryErr.message);
        }
      }
      if (code === 803) {
        if (cookie) ctx.saveCookie(cookie);
        let info = await ctx.getLoginInfo();
        if (!info.loggedIn) {
          const profile = body.profile || (body.data && body.data.profile) || {};
          info = ctx.normalizeLoginInfo(profile, body.account || (body.data && body.data.account), body.data || body);
        }
        if (!info.loggedIn && cookie) {
          info = ctx.pendingNeteaseLoginInfo(body);
        }
        ctx.sendJSON(ctx.res, { code, message: msg, ...info, hasCookie: !!cookie });
        return true;
      }
      ctx.sendJSON(ctx.res, { code, message: msg, nickname: body.nickname, avatar: body.avatarUrl });
    } catch (err: any) {
      ctx.sendJSON(ctx.res, { error: err.message }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/login/status') {
    const info = await ctx.getLoginInfo();
    ctx.sendJSON(ctx.res, info);
    return true;
  }

  if (ctx.pathname === '/api/logout') {
    try {
      await ctx.logout({ cookie: ctx.getUserCookie() });
    } catch (e) {}
    ctx.saveCookie('');
    ctx.sendJSON(ctx.res, { ok: true });
    return true;
  }

  return false;
}
