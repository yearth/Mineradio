import {
  checkNeteaseQrLogin,
  loginWithNeteaseCookie,
} from '../services/netease-auth-orchestration';

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
      const payload = await loginWithNeteaseCookie(raw, ctx);
      ctx.sendJSON(ctx.res, payload);
    } catch (err: any) {
      if (err && err.code === 'INVALID_NETEASE_COOKIE') {
        ctx.sendJSON(ctx.res, { loggedIn: false, error: err.code, message: err.message }, err.status || 400);
        return true;
      }
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
      const payload = await checkNeteaseQrLogin(key, ctx);
      ctx.sendJSON(ctx.res, payload);
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
