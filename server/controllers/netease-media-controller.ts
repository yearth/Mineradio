import {
  fetchNeteaseArtistDetail,
  fetchNeteaseLyric,
  fetchNeteasePlaylistTracks,
  fetchNeteaseSongComments,
} from '../services/netease-orchestration';

export type JsonSender = (res: unknown, data: unknown, status?: number) => void;

export type NeteaseMediaRouteContext = {
  pathname: string;
  url: URL;
  res: unknown;
  sendJSON: JsonSender;
  getUserCookie: () => string;
  getLoginInfo: () => Promise<Record<string, any>>;
  handleSongUrl: (id: string | null, loginInfo: Record<string, any>, quality: string) => Promise<Record<string, any>>;
  lyricNew?: (opts: Record<string, any>) => Promise<any>;
  lyric: (opts: Record<string, any>) => Promise<any>;
  commentMusic: (opts: Record<string, any>) => Promise<any>;
  buildNeteaseSongCommentsPayload: (body: any, id: string, offset: number) => unknown;
  artistDetail: (opts: Record<string, any>) => Promise<any>;
  artistSongs: (opts: Record<string, any>) => Promise<any>;
  artistTopSong: (opts: Record<string, any>) => Promise<any>;
  playlistTrackAll?: (opts: Record<string, any>) => Promise<any>;
  playlistDetail?: (opts: Record<string, any>) => Promise<any>;
  mapSongRecord: (song: any) => any;
  now: () => number;
  logger: Pick<Console, 'error' | 'warn'>;
};

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, parseInt(raw || String(fallback), 10) || fallback));
}

export async function handleNeteaseMediaRoutes(ctx: NeteaseMediaRouteContext): Promise<boolean> {
  if (ctx.pathname === '/api/song/url') {
    try {
      const sid = ctx.url.searchParams.get('id');
      const quality = ctx.url.searchParams.get('quality') || '';
      const loginInfo = await ctx.getLoginInfo();
      const info = await ctx.handleSongUrl(sid, loginInfo, quality);
      ctx.sendJSON(ctx.res, {
        ...info,
        loggedIn: loginInfo.loggedIn,
        vipType: loginInfo.vipType || 0,
        vipLevel: loginInfo.vipLevel || 'none',
        isVip: !!loginInfo.isVip,
        isSvip: !!loginInfo.isSvip,
        vipLabel: loginInfo.vipLabel || '无VIP',
      });
    } catch (err: any) {
      ctx.logger.error('[SongUrl]', err);
      ctx.sendJSON(ctx.res, { error: err.message }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/lyric') {
    try {
      const id = ctx.url.searchParams.get('id');
      if (!id) {
        ctx.sendJSON(ctx.res, { error: 'Missing song id', lyric: '' }, 400);
        return true;
      }
      const lyricPayload = await fetchNeteaseLyric(id, {
        getUserCookie: ctx.getUserCookie,
        lyricNew: ctx.lyricNew,
        lyric: ctx.lyric,
        now: ctx.now,
        logger: ctx.logger,
      });
      ctx.sendJSON(ctx.res, lyricPayload);
    } catch (err: any) {
      ctx.logger.error('[Lyric]', err);
      ctx.sendJSON(ctx.res, { error: err.message, lyric: '' }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/song/comments') {
    try {
      const id = ctx.url.searchParams.get('id');
      const limit = clampInt(ctx.url.searchParams.get('limit'), 20, 6, 50);
      const offset = Math.max(0, parseInt(ctx.url.searchParams.get('offset') || '0', 10) || 0);
      if (!id) {
        ctx.sendJSON(ctx.res, { error: 'Missing song id', comments: [] }, 400);
        return true;
      }
      const commentsPayload = await fetchNeteaseSongComments(id, limit, offset, {
        getUserCookie: ctx.getUserCookie,
        commentMusic: ctx.commentMusic,
        buildNeteaseSongCommentsPayload: ctx.buildNeteaseSongCommentsPayload,
        now: ctx.now,
      });
      ctx.sendJSON(ctx.res, commentsPayload);
    } catch (err: any) {
      ctx.logger.error('[SongComments]', err);
      ctx.sendJSON(ctx.res, { error: err.message, comments: [] }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/artist/detail') {
    try {
      const id = ctx.url.searchParams.get('id');
      const limit = clampInt(ctx.url.searchParams.get('limit'), 30, 10, 80);
      if (!id) {
        ctx.sendJSON(ctx.res, { error: 'Missing artist id', songs: [] }, 400);
        return true;
      }
      const artistPayload = await fetchNeteaseArtistDetail(id, limit, {
        getUserCookie: ctx.getUserCookie,
        artistDetail: ctx.artistDetail,
        artistSongs: ctx.artistSongs,
        artistTopSong: ctx.artistTopSong,
        mapSongRecord: ctx.mapSongRecord,
        now: ctx.now,
        logger: ctx.logger,
      });
      ctx.sendJSON(ctx.res, artistPayload);
    } catch (err: any) {
      ctx.logger.error('[ArtistDetail]', err);
      ctx.sendJSON(ctx.res, { error: err.message, songs: [] }, 500);
    }
    return true;
  }

  if (ctx.pathname === '/api/playlist/tracks') {
    try {
      const id = ctx.url.searchParams.get('id');
      if (!id) {
        ctx.sendJSON(ctx.res, { error: 'Missing playlist id', tracks: [] }, 400);
        return true;
      }

      const playlistPayload = await fetchNeteasePlaylistTracks(id, {
        getUserCookie: ctx.getUserCookie,
        playlistTrackAll: ctx.playlistTrackAll,
        playlistDetail: ctx.playlistDetail,
        mapSongRecord: ctx.mapSongRecord,
        now: ctx.now,
        logger: ctx.logger,
      });
      ctx.sendJSON(ctx.res, playlistPayload);
    } catch (err: any) {
      ctx.logger.error('[PlaylistTracks]', err);
      ctx.sendJSON(ctx.res, { error: err.message, tracks: [] }, 500);
    }
    return true;
  }

  return false;
}
