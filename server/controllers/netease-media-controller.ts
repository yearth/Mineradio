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
      let body: any = {};
      let source = 'lyric';
      try {
        if (typeof ctx.lyricNew === 'function') {
          const nr = await ctx.lyricNew({ id, cookie: ctx.getUserCookie(), timestamp: ctx.now() });
          body = nr.body || {};
          source = 'lyric_new';
        }
      } catch (errNew: any) {
        ctx.logger.warn('[LyricNew]', errNew.message);
      }
      if (!((body.lrc && body.lrc.lyric) || (body.yrc && body.yrc.lyric))) {
        const r = await ctx.lyric({ id, cookie: ctx.getUserCookie(), timestamp: ctx.now() });
        body = r.body || body || {};
        source = 'lyric';
      }
      ctx.sendJSON(ctx.res, {
        lyric: (body.lrc && body.lrc.lyric) || '',
        tlyric: (body.tlyric && body.tlyric.lyric) || '',
        yrc: (body.yrc && body.yrc.lyric) || '',
        source,
      });
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
      const r = await ctx.commentMusic({ id, limit, offset, cookie: ctx.getUserCookie(), timestamp: ctx.now() });
      const body = r.body || r || {};
      ctx.sendJSON(ctx.res, ctx.buildNeteaseSongCommentsPayload(body, id, offset));
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
      let detailBody: any = {};
      try {
        const detail = await ctx.artistDetail({ id, cookie: ctx.getUserCookie(), timestamp: ctx.now() });
        detailBody = detail.body || detail || {};
      } catch (e: any) {
        ctx.logger.warn('[ArtistDetail] detail failed:', e.message);
      }
      let rawSongs: any[] = [];
      try {
        const list = await ctx.artistSongs({ id, order: 'hot', limit, offset: 0, cookie: ctx.getUserCookie(), timestamp: ctx.now() });
        const b = list.body || list || {};
        rawSongs = (b.songs || (b.data && b.data.songs) || []);
      } catch (e: any) {
        ctx.logger.warn('[ArtistSongs] hot failed:', e.message);
      }
      if (!rawSongs.length) {
        const top = await ctx.artistTopSong({ id, cookie: ctx.getUserCookie(), timestamp: ctx.now() });
        const b = top.body || top || {};
        rawSongs = b.songs || [];
      }
      const artist = detailBody.artist || (detailBody.data && (detailBody.data.artist || detailBody.data)) || {};
      const songs = rawSongs.map(ctx.mapSongRecord).filter(s => s.id).slice(0, limit);
      ctx.sendJSON(ctx.res, {
        id,
        artist: {
          id: artist.id || id,
          name: artist.name || artist.artistName || '',
          avatar: artist.avatar || artist.cover || artist.picUrl || artist.img1v1Url || '',
          brief: artist.briefDesc || artist.description || artist.desc || '',
          musicSize: artist.musicSize || artist.songSize || 0,
          albumSize: artist.albumSize || 0,
        },
        songs,
        body: detailBody,
      });
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

      let playlistMeta: any = { id, name: '', cover: '', trackCount: 0 };
      let rawTracks: any[] = [];

      if (typeof ctx.playlistTrackAll === 'function') {
        try {
          const all = await ctx.playlistTrackAll({ id, limit: 500, offset: 0, cookie: ctx.getUserCookie(), timestamp: ctx.now() });
          rawTracks = (all.body && (all.body.songs || all.body.tracks)) || [];
        } catch (err: any) {
          ctx.logger.warn('[PlaylistTracks] playlist_track_all failed, fallback to detail:', err.message);
        }
      }

      if (!rawTracks.length && typeof ctx.playlistDetail === 'function') {
        const detail = await ctx.playlistDetail({ id, s: 0, cookie: ctx.getUserCookie(), timestamp: ctx.now() });
        const pl = (detail.body && detail.body.playlist) || {};
        playlistMeta = { id: pl.id || id, name: pl.name || '', cover: pl.coverImgUrl || '', trackCount: pl.trackCount || 0 };
        rawTracks = pl.tracks || [];
      }

      const tracks = rawTracks.map(ctx.mapSongRecord).filter(t => t.id);

      if (!playlistMeta.trackCount) playlistMeta.trackCount = tracks.length;
      ctx.sendJSON(ctx.res, { playlist: playlistMeta, tracks });
    } catch (err: any) {
      ctx.logger.error('[PlaylistTracks]', err);
      ctx.sendJSON(ctx.res, { error: err.message, tracks: [] }, 500);
    }
    return true;
  }

  return false;
}
