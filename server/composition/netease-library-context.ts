import type { NeteaseLibraryRouteContext } from '../controllers/netease-library-controller';

export type NeteaseLibraryRouteDependencies = Omit<NeteaseLibraryRouteContext, 'pathname' | 'url' | 'req' | 'res'>;

export type NeteaseLibraryRouteRequestContext = Pick<NeteaseLibraryRouteContext, 'pathname' | 'url' | 'req' | 'res'>;

export function createNeteaseLibraryRouteContext(
  deps: NeteaseLibraryRouteDependencies,
  route: NeteaseLibraryRouteRequestContext
): NeteaseLibraryRouteContext {
  return {
    pathname: route.pathname,
    url: route.url,
    req: route.req,
    res: route.res,
    sendJSON: deps.sendJSON,
    readRequestBody: deps.readRequestBody,
    getLoginInfo: deps.getLoginInfo,
    requireLogin: deps.requireLogin,
    getUserCookie: deps.getUserCookie,
    userPlaylist: deps.userPlaylist,
    songLikeCheck: deps.songLikeCheck,
    likelist: deps.likelist,
    likeSong: deps.likeSong,
    playlistCreate: deps.playlistCreate,
    playlistTracks: deps.playlistTracks,
    playlistTrackAdd: deps.playlistTrackAdd,
    normalizeApiCode: deps.normalizeApiCode,
    normalizeApiMessage: deps.normalizeApiMessage,
    now: deps.now,
    logger: deps.logger,
  };
}
