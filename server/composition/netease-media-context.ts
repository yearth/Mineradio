import type { NeteaseMediaRouteContext } from '../controllers/netease-media-controller';

export type NeteaseMediaRouteDependencies = Omit<NeteaseMediaRouteContext, 'pathname' | 'url' | 'res'>;

export type RouteRequestContext = Pick<NeteaseMediaRouteContext, 'pathname' | 'url' | 'res'>;

export function createNeteaseMediaRouteContext(
  deps: NeteaseMediaRouteDependencies,
  route: RouteRequestContext
): NeteaseMediaRouteContext {
  return {
    pathname: route.pathname,
    url: route.url,
    res: route.res,
    sendJSON: deps.sendJSON,
    getUserCookie: deps.getUserCookie,
    getLoginInfo: deps.getLoginInfo,
    handleSongUrl: deps.handleSongUrl,
    lyricNew: deps.lyricNew,
    lyric: deps.lyric,
    commentMusic: deps.commentMusic,
    buildNeteaseSongCommentsPayload: deps.buildNeteaseSongCommentsPayload,
    artistDetail: deps.artistDetail,
    artistSongs: deps.artistSongs,
    artistTopSong: deps.artistTopSong,
    playlistTrackAll: deps.playlistTrackAll,
    playlistDetail: deps.playlistDetail,
    mapSongRecord: deps.mapSongRecord,
    now: deps.now,
    logger: deps.logger,
  };
}
