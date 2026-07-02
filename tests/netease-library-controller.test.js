const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handleNeteaseLibraryRoutes,
} = require('../server-dist/server/controllers/netease-library-controller');

function baseContext(overrides = {}) {
  const calls = [];
  return {
    calls,
    ctx: {
      pathname: '/api/user/playlists',
      url: new URL('http://localhost/api/user/playlists?limit=8'),
      req: { method: 'GET' },
      res: 'res',
      sendJSON: (res, data, status) => calls.push({ res, data, status }),
      readRequestBody: async () => ({}),
      getLoginInfo: async () => ({ loggedIn: true, userId: 7 }),
      requireLogin: async () => ({ loggedIn: true, userId: 7 }),
      getUserCookie: () => 'MUSIC_U=secret',
      userPlaylist: async opts => ({
        body: {
          playlist: [{
            id: 1,
            name: 'List',
            coverImgUrl: 'cover',
            trackCount: 2,
            playCount: 3,
            creator: { nickname: 'Me' },
            subscribed: true,
            specialType: 5,
          }],
          opts,
        },
      }),
      songLikeCheck: async () => ({ body: { data: { 10: true } } }),
      likelist: async () => ({ body: { ids: [11] } }),
      likeSong: async opts => ({ body: { code: 200, opts } }),
      playlistCreate: async opts => ({ body: { code: 200, playlist: { id: 9, name: opts.name } } }),
      playlistTracks: async () => ({ body: { code: 200, message: 'ok' } }),
      playlistTrackAdd: async () => ({ body: { code: 200, message: 'fallback ok' } }),
      normalizeApiCode: input => (input.body && input.body.code) || input.code || 200,
      normalizeApiMessage: input => (input.body && input.body.message) || input.message || '',
      now: () => 123,
      logger: { error: (...args) => calls.push({ error: args }), warn: (...args) => calls.push({ warn: args }) },
      ...overrides,
    },
  };
}

test('handleNeteaseLibraryRoutes handles user playlists and logged-out fallback', async () => {
  const { calls, ctx } = baseContext();
  assert.equal(await handleNeteaseLibraryRoutes(ctx), true);
  assert.equal(calls[0].data.loggedIn, true);
  assert.equal(calls[0].data.userId, 7);
  assert.deepEqual(calls[0].data.playlists[0], {
    id: 1,
    name: 'List',
    cover: 'cover',
    trackCount: 2,
    playCount: 3,
    creator: 'Me',
    subscribed: true,
    specialType: 5,
  });

  const loggedOut = baseContext({ getLoginInfo: async () => ({ loggedIn: false }) });
  assert.equal(await handleNeteaseLibraryRoutes(loggedOut.ctx), true);
  assert.deepEqual(loggedOut.calls, [{ res: 'res', data: { loggedIn: false, playlists: [] }, status: undefined }]);
});

test('handleNeteaseLibraryRoutes reports user playlist failures', async () => {
  const err = new Error('playlist failed');
  const { calls, ctx } = baseContext({
    userPlaylist: async () => { throw err; },
  });
  assert.equal(await handleNeteaseLibraryRoutes(ctx), true);
  assert.deepEqual(calls, [
    { error: ['[UserPlaylists]', err] },
    { res: 'res', data: { error: 'playlist failed', loggedIn: false, playlists: [] }, status: 500 },
  ]);
});

test('handleNeteaseLibraryRoutes handles like check direct and fallback flows', async () => {
  const direct = baseContext({
    pathname: '/api/song/like/check',
    url: new URL('http://localhost/api/song/like/check?ids=10,11'),
  });
  assert.equal(await handleNeteaseLibraryRoutes(direct.ctx), true);
  assert.deepEqual(direct.calls[0].data, { loggedIn: true, ids: ['10', '11'], liked: { 10: true, 11: false } });

  const fallback = baseContext({
    pathname: '/api/song/like/check',
    url: new URL('http://localhost/api/song/like/check?id=11'),
    songLikeCheck: async () => ({ body: { data: {} } }),
  });
  assert.equal(await handleNeteaseLibraryRoutes(fallback.ctx), true);
  assert.deepEqual(fallback.calls[0].data, { loggedIn: true, ids: ['11'], liked: { 11: true } });

  const missing = baseContext({
    pathname: '/api/song/like/check',
    url: new URL('http://localhost/api/song/like/check'),
  });
  assert.equal(await handleNeteaseLibraryRoutes(missing.ctx), true);
  assert.deepEqual(missing.calls[0], {
    res: 'res',
    data: { error: 'Missing song id', liked: {}, ids: [] },
    status: 400,
  });
});

test('handleNeteaseLibraryRoutes logs direct like check failures and reports final failures', async () => {
  const directErr = new Error('direct failed');
  const listErr = new Error('list failed');
  const { calls, ctx } = baseContext({
    pathname: '/api/song/like/check',
    url: new URL('http://localhost/api/song/like/check?ids=abc'),
    songLikeCheck: async () => { throw directErr; },
    likelist: async () => { throw listErr; },
  });
  assert.equal(await handleNeteaseLibraryRoutes(ctx), true);
  assert.deepEqual(calls, [
    { warn: ['[LikeCheck] direct check failed:', 'direct failed'] },
    { error: ['[LikeCheck]', listErr] },
    { res: 'res', data: { error: 'list failed' }, status: 500 },
  ]);
});

test('handleNeteaseLibraryRoutes handles like toggle validation and errors', async () => {
  const like = baseContext({
    pathname: '/api/song/like',
    req: { method: 'POST' },
    readRequestBody: async () => ({ id: '10', like: false }),
  });
  assert.equal(await handleNeteaseLibraryRoutes(like.ctx), true);
  assert.equal(like.calls[0].data.id, '10');
  assert.equal(like.calls[0].data.liked, false);

  const missing = baseContext({ pathname: '/api/song/like' });
  assert.equal(await handleNeteaseLibraryRoutes(missing.ctx), true);
  assert.deepEqual(missing.calls[0], { res: 'res', data: { error: 'Missing song id' }, status: 400 });

  const err = new Error('like failed');
  const failed = baseContext({ pathname: '/api/song/like', url: new URL('http://localhost/api/song/like?id=1'), likeSong: async () => { throw err; } });
  assert.equal(await handleNeteaseLibraryRoutes(failed.ctx), true);
  assert.deepEqual(failed.calls.at(-1), { res: 'res', data: { error: 'like failed' }, status: 500 });
});

test('handleNeteaseLibraryRoutes handles playlist create', async () => {
  const create = baseContext({
    pathname: '/api/playlist/create',
    req: { method: 'POST' },
    readRequestBody: async () => ({ name: ' Rain ', privacy: '10' }),
  });
  assert.equal(await handleNeteaseLibraryRoutes(create.ctx), true);
  assert.deepEqual(create.calls[0].data.playlist, { id: 9, name: 'Rain' });

  const missing = baseContext({ pathname: '/api/playlist/create' });
  assert.equal(await handleNeteaseLibraryRoutes(missing.ctx), true);
  assert.deepEqual(missing.calls[0], { res: 'res', data: { error: 'Missing playlist name' }, status: 400 });

  const err = new Error('create failed');
  const failed = baseContext({ pathname: '/api/playlist/create', url: new URL('http://localhost/api/playlist/create?name=x'), playlistCreate: async () => { throw err; } });
  assert.equal(await handleNeteaseLibraryRoutes(failed.ctx), true);
  assert.deepEqual(failed.calls.at(-1), { res: 'res', data: { error: 'create failed' }, status: 500 });
});

test('handleNeteaseLibraryRoutes handles playlist add-song primary, fallback, and failures', async () => {
  const primary = baseContext({
    pathname: '/api/playlist/add-song',
    req: { method: 'POST' },
    readRequestBody: async () => ({ pid: '77', id: '10' }),
  });
  assert.equal(await handleNeteaseLibraryRoutes(primary.ctx), true);
  assert.equal(primary.calls[0].data.success, true);
  assert.deepEqual(primary.calls[0].data.attempts.map(item => item.api), ['playlist_tracks']);

  const fallback = baseContext({
    pathname: '/api/playlist/add-song',
    req: { method: 'POST' },
    readRequestBody: async () => ({ pid: '77', ids: '10,11' }),
    playlistTracks: async () => ({ body: { code: 500, message: 'primary failed' } }),
  });
  assert.equal(await handleNeteaseLibraryRoutes(fallback.ctx), true);
  assert.equal(fallback.calls[0].data.success, true);
  assert.deepEqual(fallback.calls[0].data.attempts.map(item => item.api), ['playlist_tracks', 'playlist_track_add']);

  const missing = baseContext({ pathname: '/api/playlist/add-song' });
  assert.equal(await handleNeteaseLibraryRoutes(missing.ctx), true);
  assert.deepEqual(missing.calls[0], { res: 'res', data: { error: 'Missing playlist id or song id' }, status: 400 });

  const noSuccess = baseContext({
    pathname: '/api/playlist/add-song',
    url: new URL('http://localhost/api/playlist/add-song?pid=77&id=10'),
    playlistTracks: async () => ({ body: { code: 401, message: 'expired' } }),
    playlistTrackAdd: async () => ({ body: { code: 401, message: 'expired' } }),
  });
  assert.equal(await handleNeteaseLibraryRoutes(noSuccess.ctx), true);
  assert.equal(noSuccess.calls[0].status, 401);
  assert.equal(noSuccess.calls[0].data.success, false);
});

test('handleNeteaseLibraryRoutes records playlist add fallback exceptions and reports primary exceptions', async () => {
  const fallbackErr = new Error('fallback exception');
  fallbackErr.body = { code: 500, message: 'fallback body' };
  const fallbackFailed = baseContext({
    pathname: '/api/playlist/add-song',
    url: new URL('http://localhost/api/playlist/add-song?pid=77&id=10'),
    playlistTracks: async () => ({ body: { code: 500, message: 'primary failed' } }),
    playlistTrackAdd: async () => { throw fallbackErr; },
  });
  assert.equal(await handleNeteaseLibraryRoutes(fallbackFailed.ctx), true);
  assert.equal(fallbackFailed.calls[0].status, 409);
  assert.deepEqual(fallbackFailed.calls[0].data.attempts.map(item => item.api), ['playlist_tracks', 'playlist_track_add']);

  const primaryErr = new Error('primary exception');
  const primaryFailed = baseContext({
    pathname: '/api/playlist/add-song',
    url: new URL('http://localhost/api/playlist/add-song?pid=77&id=10'),
    playlistTracks: async () => { throw primaryErr; },
  });
  assert.equal(await handleNeteaseLibraryRoutes(primaryFailed.ctx), true);
  assert.deepEqual(primaryFailed.calls, [
    { error: ['[PlaylistAddSong]', primaryErr] },
    { res: 'res', data: { error: 'primary exception' }, status: 500 },
  ]);
});

test('handleNeteaseLibraryRoutes stops when login is required and ignores unrelated paths', async () => {
  const loginRequired = baseContext({
    pathname: '/api/song/like',
    requireLogin: async () => null,
  });
  assert.equal(await handleNeteaseLibraryRoutes(loginRequired.ctx), true);
  assert.deepEqual(loginRequired.calls, []);

  const unrelated = baseContext({ pathname: '/api/lyric' });
  assert.equal(await handleNeteaseLibraryRoutes(unrelated.ctx), false);
});
