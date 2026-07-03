type Logger = Pick<Console, 'warn'>;

type LoginWithCookieDeps = {
  normalizeCookieHeader: (raw: unknown) => string;
  parseCookieString: (raw: string) => Record<string, any>;
  saveCookie: (cookie: string) => void;
  getUserCookie: () => string;
  getLoginInfo: () => Promise<Record<string, any>>;
  pendingNeteaseLoginInfo: (body?: any) => Record<string, any>;
};

type QrCheckDeps = {
  loginQrCheck: (opts: Record<string, any>) => Promise<any>;
  readCookieFromResponse: (response: any) => string;
  saveCookie: (cookie: string) => void;
  getLoginInfo: () => Promise<Record<string, any>>;
  normalizeLoginInfo: (profile: any, account: any, data: any) => Record<string, any>;
  pendingNeteaseLoginInfo: (body?: any) => Record<string, any>;
  now?: () => number;
  logger?: Logger;
};

export async function loginWithNeteaseCookie(rawCookie: unknown, deps: LoginWithCookieDeps): Promise<Record<string, any>> {
  const normalized = deps.normalizeCookieHeader(rawCookie);
  const obj = deps.parseCookieString(normalized);
  if (!obj.MUSIC_U) {
    const err: any = new Error('网易云 cookie 缺少 MUSIC_U');
    err.code = 'INVALID_NETEASE_COOKIE';
    err.status = 400;
    throw err;
  }
  deps.saveCookie(normalized);
  let info = await deps.getLoginInfo();
  if (!info.loggedIn && deps.getUserCookie()) {
    info = deps.pendingNeteaseLoginInfo();
  }
  return { ...info, saved: true, hasCookie: !!deps.getUserCookie() };
}

export async function checkNeteaseQrLogin(key: string | null, deps: QrCheckDeps): Promise<Record<string, any>> {
  const now = deps.now || Date.now;
  const logger = deps.logger || console;
  let r = await deps.loginQrCheck({ key, noCookie: true, timestamp: now() });
  let body = r.body || {};
  let code = Number(body.code || r.code);
  let message = body.message || r.message || '';
  let cookie = deps.readCookieFromResponse(r);

  if (code === 803 && !cookie) {
    try {
      const retry = await deps.loginQrCheck({ key, timestamp: now() });
      const retryCookie = deps.readCookieFromResponse(retry);
      if (retryCookie) {
        r = retry;
        body = retry.body || body;
        code = Number(body.code || retry.code || code);
        message = body.message || retry.message || message;
        cookie = retryCookie;
      }
    } catch (retryErr: any) {
      logger.warn('[Login] qr cookie retry failed:', retryErr.message);
    }
  }

  if (code !== 803) {
    return { code, message, nickname: body.nickname, avatar: body.avatarUrl };
  }

  if (cookie) deps.saveCookie(cookie);
  let info = await deps.getLoginInfo();
  if (!info.loggedIn) {
    const profile = body.profile || (body.data && body.data.profile) || {};
    info = deps.normalizeLoginInfo(profile, body.account || (body.data && body.data.account), body.data || body);
  }
  if (!info.loggedIn && cookie) {
    info = deps.pendingNeteaseLoginInfo(body);
  }
  return { code, message, ...info, hasCookie: !!cookie };
}
