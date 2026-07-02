import type { QQRouteContext } from '../controllers/qq-controller';

export type QQRouteDependencies = Omit<QQRouteContext, 'pathname' | 'url' | 'req' | 'res'>;

export type RouteRequestContext = Pick<QQRouteContext, 'pathname' | 'url' | 'req' | 'res'>;

export function createQQRouteContext(
  deps: QQRouteDependencies,
  route: RouteRequestContext
): QQRouteContext {
  return {
    pathname: route.pathname,
    url: route.url,
    req: route.req,
    res: route.res,
    sendJSON: deps.sendJSON,
    readRequestBody: deps.readRequestBody,
    parseCookieString: deps.parseCookieString,
    normalizeQQCookieInput: deps.normalizeQQCookieInput,
    qqCookieUin: deps.qqCookieUin,
    qqCookieMusicKey: deps.qqCookieMusicKey,
    saveQQCookie: deps.saveQQCookie,
    getQQLoginInfo: deps.getQQLoginInfo,
    handleQQSearch: deps.handleQQSearch,
    handleQQSongUrl: deps.handleQQSongUrl,
    handleQQLyric: deps.handleQQLyric,
    handleQQUserPlaylists: deps.handleQQUserPlaylists,
    handleQQPlaylistTracks: deps.handleQQPlaylistTracks,
    handleQQArtistDetail: deps.handleQQArtistDetail,
    handleQQSongComments: deps.handleQQSongComments,
    logger: deps.logger,
  };
}
