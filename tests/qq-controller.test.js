const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handleQQRoutes,
} = require('../server-dist/server/controllers/qq-controller');

function baseContext(overrides = {}) {
  const calls = [];
  return {
    calls,
    ctx: {
      pathname: '/api/qq/search',
      url: new URL('http://localhost/api/qq/search?keywords=rain&limit=2'),
      req: { method: 'GET' },
      res: 'res',
      sendJSON: (res, data, status) => calls.push({ res, data, status }),
      readRequestBody: async () => ({ cookie: 'uin=o123; qm_keyst=key' }),
      parseCookieString: raw => Object.fromEntries(String(raw).split(';').map(part => part.trim().split('='))),
      normalizeQQCookieInput: raw => String(raw).trim(),
      qqCookieUin: obj => obj.uin,
      qqCookieMusicKey: obj => obj.qm_keyst,
      saveQQCookie: cookie => calls.push({ saveQQCookie: cookie }),
      getQQLoginInfo: async () => ({ provider: 'qq', loggedIn: true }),
      handleQQSearch: async (keywords, limit) => ({ keywords, limit }),
      handleQQSongUrl: async (mid, mediaMid, quality) => ({ provider: 'qq', mid, mediaMid, quality }),
      handleQQLyric: async (mid, id) => ({ provider: 'qq', mid, id, lyric: 'la' }),
      handleQQUserPlaylists: async () => ({ provider: 'qq', playlists: [1] }),
      handleQQPlaylistTracks: async id => ({ provider: 'qq', id, tracks: [1] }),
      handleQQArtistDetail: async (mid, limit) => ({ provider: 'qq', mid, limit, artist: {} }),
      handleQQSongComments: async (id, mid, limit, offset) => ({ provider: 'qq', id, mid, limit, offset, comments: [] }),
      logger: { error: (...args) => calls.push({ log: args }) },
      ...overrides,
    },
  };
}

test('handleQQRoutes handles QQ search and clamps limits', async () => {
  const { calls, ctx } = baseContext({
    url: new URL('http://localhost/api/qq/search?keywords=rain&limit=99'),
  });

  assert.equal(await handleQQRoutes(ctx), true);
  assert.deepEqual(calls, [{
    res: 'res',
    data: { provider: 'qq', songs: { keywords: 'rain', limit: 12 } },
    status: undefined,
  }]);
});

test('handleQQRoutes handles song URL and lyric validation', async () => {
  const song = baseContext({
    pathname: '/api/qq/song/url',
    url: new URL('http://localhost/api/qq/song/url?id=mid1&media_mid=media1&quality=hires'),
  });

  assert.equal(await handleQQRoutes(song.ctx), true);
  assert.deepEqual(song.calls[0].data, {
    provider: 'qq',
    mid: 'mid1',
    mediaMid: 'media1',
    quality: 'hires',
  });

  const lyricMissing = baseContext({
    pathname: '/api/qq/lyric',
    url: new URL('http://localhost/api/qq/lyric'),
  });

  assert.equal(await handleQQRoutes(lyricMissing.ctx), true);
  assert.deepEqual(lyricMissing.calls, [{
    res: 'res',
    data: { provider: 'qq', error: 'Missing QQ song mid or id', lyric: '' },
    status: 400,
  }]);

  const lyric = baseContext({
    pathname: '/api/qq/lyric',
    url: new URL('http://localhost/api/qq/lyric?songmid=mid2&qqId=100'),
  });

  assert.equal(await handleQQRoutes(lyric.ctx), true);
  assert.deepEqual(lyric.calls[0].data, { provider: 'qq', mid: 'mid2', id: '100', lyric: 'la' });
});

test('handleQQRoutes handles login status, cookie save validation, and logout', async () => {
  const status = baseContext({ pathname: '/api/qq/login/status' });

  assert.equal(await handleQQRoutes(status.ctx), true);
  assert.deepEqual(status.calls[0].data, { provider: 'qq', loggedIn: true });

  const cookie = baseContext({ pathname: '/api/qq/login/cookie' });

  assert.equal(await handleQQRoutes(cookie.ctx), true);
  assert.deepEqual(cookie.calls, [
    { saveQQCookie: 'uin=o123; qm_keyst=key' },
    { res: 'res', data: { provider: 'qq', loggedIn: true, saved: true }, status: undefined },
  ]);

  const invalid = baseContext({
    pathname: '/api/qq/login/cookie',
    readRequestBody: async () => ({ cookie: 'uin=o123' }),
  });

  assert.equal(await handleQQRoutes(invalid.ctx), true);
  assert.deepEqual(invalid.calls, [{
    res: 'res',
    data: {
      provider: 'qq',
      loggedIn: false,
      error: 'INVALID_QQ_COOKIE',
      message: 'QQ cookie 缺少 uin 或有效登录票据',
    },
    status: 400,
  }]);

  const logout = baseContext({ pathname: '/api/qq/logout' });

  assert.equal(await handleQQRoutes(logout.ctx), true);
  assert.deepEqual(logout.calls, [
    { saveQQCookie: '' },
    { res: 'res', data: { provider: 'qq', ok: true, loggedIn: false }, status: undefined },
  ]);
});

test('handleQQRoutes handles library, artist, and comment routes', async () => {
  const playlist = baseContext({ pathname: '/api/qq/user/playlists' });
  assert.equal(await handleQQRoutes(playlist.ctx), true);
  assert.deepEqual(playlist.calls[0].data, { provider: 'qq', playlists: [1] });

  const tracks = baseContext({
    pathname: '/api/qq/playlist/tracks',
    url: new URL('http://localhost/api/qq/playlist/tracks?disstid=77'),
  });
  assert.equal(await handleQQRoutes(tracks.ctx), true);
  assert.deepEqual(tracks.calls[0].data, { provider: 'qq', id: '77', tracks: [1] });

  const artistMissing = baseContext({
    pathname: '/api/qq/artist/detail',
    url: new URL('http://localhost/api/qq/artist/detail'),
  });
  assert.equal(await handleQQRoutes(artistMissing.ctx), true);
  assert.deepEqual(artistMissing.calls[0], {
    res: 'res',
    data: { provider: 'qq', error: 'MISSING_SINGER_MID', artist: null, songs: [] },
    status: 400,
  });

  const artist = baseContext({
    pathname: '/api/qq/artist/detail',
    url: new URL('http://localhost/api/qq/artist/detail?singermid=singer&limit=500'),
  });
  assert.equal(await handleQQRoutes(artist.ctx), true);
  assert.deepEqual(artist.calls[0].data, { provider: 'qq', mid: 'singer', limit: 80, artist: {} });

  const comments = baseContext({
    pathname: '/api/qq/song/comments',
    url: new URL('http://localhost/api/qq/song/comments?qqId=1&songmid=m&limit=1&offset=-4'),
  });
  assert.equal(await handleQQRoutes(comments.ctx), true);
  assert.deepEqual(comments.calls[0].data, { provider: 'qq', id: '1', mid: 'm', limit: 6, offset: 0, comments: [] });
});

test('handleQQRoutes reports route-specific errors and ignores unrelated paths', async () => {
  const err = new Error('boom');
  const failed = baseContext({
    pathname: '/api/qq/search',
    handleQQSearch: async () => { throw err; },
  });

  assert.equal(await handleQQRoutes(failed.ctx), true);
  assert.deepEqual(failed.calls, [
    { log: ['[QQSearch]', err] },
    { res: 'res', data: { provider: 'qq', error: 'boom', songs: [] }, status: 500 },
  ]);

  const unrelated = baseContext({ pathname: '/api/search' });

  assert.equal(await handleQQRoutes(unrelated.ctx), false);
  assert.deepEqual(unrelated.calls, []);
});

test('handleQQRoutes reports QQ song, lyric, and login errors with legacy fallbacks', async () => {
  const songErr = new Error('song url failed');
  const song = baseContext({
    pathname: '/api/qq/song/url',
    handleQQSongUrl: async () => { throw songErr; },
  });

  assert.equal(await handleQQRoutes(song.ctx), true);
  assert.deepEqual(song.calls, [
    { log: ['[QQSongUrl]', songErr] },
    {
      res: 'res',
      data: { provider: 'qq', url: '', playable: false, error: 'song url failed' },
      status: 500,
    },
  ]);

  const lyricErr = new Error('lyric failed');
  const lyric = baseContext({
    pathname: '/api/qq/lyric',
    url: new URL('http://localhost/api/qq/lyric?mid=mid1'),
    handleQQLyric: async () => { throw lyricErr; },
  });

  assert.equal(await handleQQRoutes(lyric.ctx), true);
  assert.deepEqual(lyric.calls, [
    { log: ['[QQLyric]', lyricErr] },
    { res: 'res', data: { provider: 'qq', error: 'lyric failed', lyric: '' }, status: 500 },
  ]);

  const statusErr = new Error('status failed');
  const status = baseContext({
    pathname: '/api/qq/login/status',
    getQQLoginInfo: async () => { throw statusErr; },
  });

  assert.equal(await handleQQRoutes(status.ctx), true);
  assert.deepEqual(status.calls, [
    { log: ['[QQLoginStatus]', statusErr] },
    { res: 'res', data: { provider: 'qq', loggedIn: false, error: 'status failed' }, status: 500 },
  ]);

  const cookieErr = new Error('cookie failed');
  const cookie = baseContext({
    pathname: '/api/qq/login/cookie',
    readRequestBody: async () => { throw cookieErr; },
  });

  assert.equal(await handleQQRoutes(cookie.ctx), true);
  assert.deepEqual(cookie.calls, [
    { log: ['[QQLoginCookie]', cookieErr] },
    { res: 'res', data: { provider: 'qq', loggedIn: false, error: 'cookie failed' }, status: 500 },
  ]);
});

test('handleQQRoutes reports QQ user playlist errors with the legacy fallback', async () => {
  const err = new Error('playlists failed');
  const playlists = baseContext({
    pathname: '/api/qq/user/playlists',
    handleQQUserPlaylists: async () => { throw err; },
  });

  assert.equal(await handleQQRoutes(playlists.ctx), true);
  assert.deepEqual(playlists.calls, [
    { log: ['[QQUserPlaylists]', err] },
    {
      res: 'res',
      data: { provider: 'qq', loggedIn: false, error: 'playlists failed', playlists: [] },
      status: 500,
    },
  ]);
});
