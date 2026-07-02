import type { NeteaseAuthRouteContext } from '../controllers/netease-auth-controller';

export type NeteaseAuthRouteDependencies = Omit<NeteaseAuthRouteContext, 'pathname' | 'url' | 'req' | 'res'>;

export type NeteaseAuthRouteRequestContext = Pick<NeteaseAuthRouteContext, 'pathname' | 'url' | 'req' | 'res'>;

export function createNeteaseAuthRouteContext(
  deps: NeteaseAuthRouteDependencies,
  route: NeteaseAuthRouteRequestContext
): NeteaseAuthRouteContext {
  return {
    pathname: route.pathname,
    url: route.url,
    req: route.req,
    res: route.res,
    sendJSON: deps.sendJSON,
    readRequestBody: deps.readRequestBody,
    normalizeCookieHeader: deps.normalizeCookieHeader,
    parseCookieString: deps.parseCookieString,
    saveCookie: deps.saveCookie,
    getUserCookie: deps.getUserCookie,
    getLoginInfo: deps.getLoginInfo,
    pendingNeteaseLoginInfo: deps.pendingNeteaseLoginInfo,
    loginQrKey: deps.loginQrKey,
    loginQrCreate: deps.loginQrCreate,
    loginQrCheck: deps.loginQrCheck,
    readCookieFromResponse: deps.readCookieFromResponse,
    normalizeLoginInfo: deps.normalizeLoginInfo,
    logout: deps.logout,
    now: deps.now,
    logger: deps.logger,
  };
}
