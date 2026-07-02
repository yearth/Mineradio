const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handleNeteaseMediaRoutes,
} = require('../server-dist/server/controllers/netease-media-controller');

function baseContext(overrides = {}) {
  const calls = [];
  return {
    calls,
    ctx: {
      pathname: '/api/song/url',
      url: new URL('http://localhost/api/song/url?id=10&quality=exhigh'),
      res: 'res',
      sendJSON: (res, data, status) => calls.push({ res, data, status }),
      getUserCookie: () => 'MUSIC_U=secret',
      getLoginInfo: async () => ({ loggedIn: true, vipType: 11, vipLevel: 'svip', isVip: true, isSvip: true, vipLabel: 'SVIP' }),
      handleSongUrl: async (id, loginInfo, quality) => ({ id, quality, loginInfo, url: 'u' }),
      lyricNew: async () => ({ body: { lrc: { lyric: 'new' }, tlyric: { lyric: 't' }, yrc: { lyric: 'y' } } }),
      lyric: async () => ({ body: { lrc: { lyric: 'old' } } }),
      commentMusic: async () => ({ body: { hotComments: [], comments: [], total: 0 } }),
      buildNeteaseSongCommentsPayload: (body, id, offset) => ({ body, id, offset, comments: [] }),
      artistDetail: async () => ({ body: { artist: { id: 66, name: 'Artist', picUrl: 'pic' } } }),
      artistSongs: async () => ({ body: { songs: [{ id: 1, name: 'Song', ar: [] }] } }),
      artistTopSong: async () => ({ body: { songs: [{ id: 2, name: 'Top', ar: [] }] } }),
      playlistTrackAll: async () => ({ body: { songs: [{ id: 1, name: 'Track', ar: [] }] } }),
      playlistDetail: async () => ({ body: { playlist: { id: 77, name: 'List', coverImgUrl: 'cover', trackCount: 1, tracks: [{ id: 2, name: 'Fallback', ar: [] }] } } }),
      mapSongRecord: song => ({ id: song.id, name: song.name }),
      now: () => 123,
      logger: { error: (...args) => calls.push({ error: args }), warn: (...args) => calls.push({ warn: args }) },
      ...overrides,
    },
  };
}

test('handleNeteaseMediaRoutes handles song URL with login metadata and errors', async () => {
  const { calls, ctx } = baseContext();
  assert.equal(await handleNeteaseMediaRoutes(ctx), true);
  assert.equal(calls[0].data.url, 'u');
  assert.equal(calls[0].data.loggedIn, true);
  assert.equal(calls[0].data.vipLevel, 'svip');
  assert.equal(calls[0].data.vipLabel, 'SVIP');

  const err = new Error('song failed');
  const failed = baseContext({ handleSongUrl: async () => { throw err; } });
  assert.equal(await handleNeteaseMediaRoutes(failed.ctx), true);
  assert.deepEqual(failed.calls, [
    { error: ['[SongUrl]', err] },
    { res: 'res', data: { error: 'song failed' }, status: 500 },
  ]);
});

test('handleNeteaseMediaRoutes handles lyric new, fallback, validation, and errors', async () => {
  const modern = baseContext({
    pathname: '/api/lyric',
    url: new URL('http://localhost/api/lyric?id=10'),
  });
  assert.equal(await handleNeteaseMediaRoutes(modern.ctx), true);
  assert.deepEqual(modern.calls[0].data, { lyric: 'new', tlyric: 't', yrc: 'y', source: 'lyric_new' });

  const fallback = baseContext({
    pathname: '/api/lyric',
    url: new URL('http://localhost/api/lyric?id=10'),
    lyricNew: async () => ({ body: {} }),
  });
  assert.equal(await handleNeteaseMediaRoutes(fallback.ctx), true);
  assert.deepEqual(fallback.calls[0].data, { lyric: 'old', tlyric: '', yrc: '', source: 'lyric' });

  const warnErr = new Error('new failed');
  const warnFallback = baseContext({
    pathname: '/api/lyric',
    url: new URL('http://localhost/api/lyric?id=10'),
    lyricNew: async () => { throw warnErr; },
  });
  assert.equal(await handleNeteaseMediaRoutes(warnFallback.ctx), true);
  assert.deepEqual(warnFallback.calls[0], { warn: ['[LyricNew]', 'new failed'] });

  const missing = baseContext({ pathname: '/api/lyric', url: new URL('http://localhost/api/lyric') });
  assert.equal(await handleNeteaseMediaRoutes(missing.ctx), true);
  assert.deepEqual(missing.calls[0], { res: 'res', data: { error: 'Missing song id', lyric: '' }, status: 400 });

  const err = new Error('lyric failed');
  const failed = baseContext({ pathname: '/api/lyric', url: new URL('http://localhost/api/lyric?id=10'), lyricNew: undefined, lyric: async () => { throw err; } });
  assert.equal(await handleNeteaseMediaRoutes(failed.ctx), true);
  assert.deepEqual(failed.calls.at(-1), { res: 'res', data: { error: 'lyric failed', lyric: '' }, status: 500 });
});

test('handleNeteaseMediaRoutes handles song comments', async () => {
  const comments = baseContext({
    pathname: '/api/song/comments',
    url: new URL('http://localhost/api/song/comments?id=10&limit=2&offset=-4'),
  });
  assert.equal(await handleNeteaseMediaRoutes(comments.ctx), true);
  assert.equal(comments.calls[0].data.id, '10');
  assert.equal(comments.calls[0].data.offset, 0);

  const missing = baseContext({ pathname: '/api/song/comments', url: new URL('http://localhost/api/song/comments') });
  assert.equal(await handleNeteaseMediaRoutes(missing.ctx), true);
  assert.deepEqual(missing.calls[0], { res: 'res', data: { error: 'Missing song id', comments: [] }, status: 400 });

  const err = new Error('comments failed');
  const failed = baseContext({ pathname: '/api/song/comments', url: new URL('http://localhost/api/song/comments?id=10'), commentMusic: async () => { throw err; } });
  assert.equal(await handleNeteaseMediaRoutes(failed.ctx), true);
  assert.deepEqual(failed.calls.at(-1), { res: 'res', data: { error: 'comments failed', comments: [] }, status: 500 });
});

test('handleNeteaseMediaRoutes handles artist detail and fallbacks', async () => {
  const artist = baseContext({
    pathname: '/api/artist/detail',
    url: new URL('http://localhost/api/artist/detail?id=66&limit=500'),
  });
  assert.equal(await handleNeteaseMediaRoutes(artist.ctx), true);
  assert.equal(artist.calls[0].data.id, '66');
  assert.equal(artist.calls[0].data.artist.name, 'Artist');
  assert.deepEqual(artist.calls[0].data.songs, [{ id: 1, name: 'Song' }]);

  const topFallback = baseContext({
    pathname: '/api/artist/detail',
    url: new URL('http://localhost/api/artist/detail?id=66'),
    artistSongs: async () => ({ body: { songs: [] } }),
  });
  assert.equal(await handleNeteaseMediaRoutes(topFallback.ctx), true);
  assert.deepEqual(topFallback.calls[0].data.songs, [{ id: 2, name: 'Top' }]);

  const detailErr = new Error('detail failed');
  const songsErr = new Error('songs failed');
  const warnFallback = baseContext({
    pathname: '/api/artist/detail',
    url: new URL('http://localhost/api/artist/detail?id=66'),
    artistDetail: async () => { throw detailErr; },
    artistSongs: async () => { throw songsErr; },
  });
  assert.equal(await handleNeteaseMediaRoutes(warnFallback.ctx), true);
  assert.deepEqual(warnFallback.calls.slice(0, 2), [
    { warn: ['[ArtistDetail] detail failed:', 'detail failed'] },
    { warn: ['[ArtistSongs] hot failed:', 'songs failed'] },
  ]);

  const missing = baseContext({ pathname: '/api/artist/detail', url: new URL('http://localhost/api/artist/detail') });
  assert.equal(await handleNeteaseMediaRoutes(missing.ctx), true);
  assert.deepEqual(missing.calls[0], { res: 'res', data: { error: 'Missing artist id', songs: [] }, status: 400 });

  const topErr = new Error('top failed');
  const failed = baseContext({ pathname: '/api/artist/detail', url: new URL('http://localhost/api/artist/detail?id=66'), artistSongs: async () => ({ body: { songs: [] } }), artistTopSong: async () => { throw topErr; } });
  assert.equal(await handleNeteaseMediaRoutes(failed.ctx), true);
  assert.deepEqual(failed.calls.at(-1), { res: 'res', data: { error: 'top failed', songs: [] }, status: 500 });
});

test('handleNeteaseMediaRoutes handles playlist tracks and fallbacks', async () => {
  const tracks = baseContext({
    pathname: '/api/playlist/tracks',
    url: new URL('http://localhost/api/playlist/tracks?id=77'),
  });
  assert.equal(await handleNeteaseMediaRoutes(tracks.ctx), true);
  assert.deepEqual(tracks.calls[0].data.playlist, { id: '77', name: '', cover: '', trackCount: 1 });
  assert.deepEqual(tracks.calls[0].data.tracks, [{ id: 1, name: 'Track' }]);

  const fallback = baseContext({
    pathname: '/api/playlist/tracks',
    url: new URL('http://localhost/api/playlist/tracks?id=77'),
    playlistTrackAll: async () => { throw new Error('all failed'); },
  });
  assert.equal(await handleNeteaseMediaRoutes(fallback.ctx), true);
  assert.deepEqual(fallback.calls[0], { warn: ['[PlaylistTracks] playlist_track_all failed, fallback to detail:', 'all failed'] });
  assert.deepEqual(fallback.calls.at(-1).data.playlist, { id: 77, name: 'List', cover: 'cover', trackCount: 1 });

  const missing = baseContext({ pathname: '/api/playlist/tracks', url: new URL('http://localhost/api/playlist/tracks') });
  assert.equal(await handleNeteaseMediaRoutes(missing.ctx), true);
  assert.deepEqual(missing.calls[0], { res: 'res', data: { error: 'Missing playlist id', tracks: [] }, status: 400 });

  const err = new Error('detail failed');
  const failed = baseContext({ pathname: '/api/playlist/tracks', url: new URL('http://localhost/api/playlist/tracks?id=77'), playlistTrackAll: async () => ({ body: { songs: [] } }), playlistDetail: async () => { throw err; } });
  assert.equal(await handleNeteaseMediaRoutes(failed.ctx), true);
  assert.deepEqual(failed.calls.at(-1), { res: 'res', data: { error: 'detail failed', tracks: [] }, status: 500 });
});

test('handleNeteaseMediaRoutes ignores unrelated paths', async () => {
  const unrelated = baseContext({ pathname: '/api/audio' });
  assert.equal(await handleNeteaseMediaRoutes(unrelated.ctx), false);
  assert.deepEqual(unrelated.calls, []);
});
