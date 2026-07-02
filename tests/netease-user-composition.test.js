const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createNeteaseAuthRouteContext,
} = require('../server-dist/server/composition/netease-auth-context');
const {
  createNeteaseLibraryRouteContext,
} = require('../server-dist/server/composition/netease-library-context');

test('createNeteaseAuthRouteContext preserves auth route dependencies and lazy cookie access', async () => {
  let cookie = 'cookie-a';
  const sendJSON = () => {};
  const readRequestBody = async () => ({});
  const loginQrKey = async () => ({ body: { data: { unikey: 'key' } } });
  const loginQrCreate = async () => ({ body: { data: {} } });
  const loginQrCheck = async () => ({ body: {} });
  const logout = async () => ({});
  const logger = { error() {}, warn() {} };
  const url = new URL('http://localhost/api/login/qr/key');

  const ctx = createNeteaseAuthRouteContext({
    sendJSON,
    readRequestBody,
    normalizeCookieHeader: raw => String(raw || '').trim(),
    parseCookieString: () => ({ MUSIC_U: 'u' }),
    saveCookie: () => {},
    getUserCookie: () => cookie,
    getLoginInfo: async () => ({ loggedIn: true }),
    pendingNeteaseLoginInfo: () => ({ loggedIn: false }),
    loginQrKey,
    loginQrCreate,
    loginQrCheck,
    readCookieFromResponse: () => '',
    normalizeLoginInfo: () => ({ loggedIn: true }),
    logout,
    now: () => 123,
    logger,
  }, {
    pathname: '/api/login/qr/key',
    url,
    req: 'req',
    res: 'res',
  });

  assert.deepEqual(Object.keys(ctx), [
    'pathname',
    'url',
    'req',
    'res',
    'sendJSON',
    'readRequestBody',
    'normalizeCookieHeader',
    'parseCookieString',
    'saveCookie',
    'getUserCookie',
    'getLoginInfo',
    'pendingNeteaseLoginInfo',
    'loginQrKey',
    'loginQrCreate',
    'loginQrCheck',
    'readCookieFromResponse',
    'normalizeLoginInfo',
    'logout',
    'now',
    'logger',
  ]);
  assert.equal(ctx.url, url);
  assert.equal(ctx.req, 'req');
  assert.equal(ctx.res, 'res');
  assert.equal(ctx.sendJSON, sendJSON);
  assert.equal(ctx.readRequestBody, readRequestBody);
  assert.equal(ctx.loginQrKey, loginQrKey);
  assert.equal(ctx.loginQrCreate, loginQrCreate);
  assert.equal(ctx.loginQrCheck, loginQrCheck);
  assert.equal(ctx.logout, logout);
  assert.equal(ctx.logger, logger);
  assert.equal(ctx.getUserCookie(), 'cookie-a');
  cookie = 'cookie-b';
  assert.equal(ctx.getUserCookie(), 'cookie-b');
  assert.equal(ctx.now(), 123);
});

test('createNeteaseLibraryRouteContext preserves library route dependencies and lazy cookie access', async () => {
  let cookie = 'cookie-a';
  const sendJSON = () => {};
  const userPlaylist = async () => ({ body: { playlist: [] } });
  const songLikeCheck = async () => ({ body: [] });
  const likelist = async () => ({ body: { ids: [] } });
  const likeSong = async () => ({ body: { code: 200 } });
  const playlistCreate = async () => ({ body: { playlist: {} } });
  const playlistTracks = async () => ({ body: { code: 200 } });
  const playlistTrackAdd = async () => ({ body: { code: 200 } });
  const logger = { error() {}, warn() {} };
  const url = new URL('http://localhost/api/user/playlists');

  const ctx = createNeteaseLibraryRouteContext({
    sendJSON,
    readRequestBody: async () => ({}),
    getLoginInfo: async () => ({ loggedIn: true, userId: 1 }),
    requireLogin: async () => ({ loggedIn: true, userId: 1 }),
    getUserCookie: () => cookie,
    userPlaylist,
    songLikeCheck,
    likelist,
    likeSong,
    playlistCreate,
    playlistTracks,
    playlistTrackAdd,
    normalizeApiCode: () => 200,
    normalizeApiMessage: () => 'ok',
    now: () => 456,
    logger,
  }, {
    pathname: '/api/user/playlists',
    url,
    req: { method: 'GET' },
    res: 'res',
  });

  assert.deepEqual(Object.keys(ctx), [
    'pathname',
    'url',
    'req',
    'res',
    'sendJSON',
    'readRequestBody',
    'getLoginInfo',
    'requireLogin',
    'getUserCookie',
    'userPlaylist',
    'songLikeCheck',
    'likelist',
    'likeSong',
    'playlistCreate',
    'playlistTracks',
    'playlistTrackAdd',
    'normalizeApiCode',
    'normalizeApiMessage',
    'now',
    'logger',
  ]);
  assert.equal(ctx.url, url);
  assert.equal(ctx.req.method, 'GET');
  assert.equal(ctx.res, 'res');
  assert.equal(ctx.sendJSON, sendJSON);
  assert.equal(ctx.userPlaylist, userPlaylist);
  assert.equal(ctx.songLikeCheck, songLikeCheck);
  assert.equal(ctx.likelist, likelist);
  assert.equal(ctx.likeSong, likeSong);
  assert.equal(ctx.playlistCreate, playlistCreate);
  assert.equal(ctx.playlistTracks, playlistTracks);
  assert.equal(ctx.playlistTrackAdd, playlistTrackAdd);
  assert.equal(ctx.logger, logger);
  assert.equal(ctx.getUserCookie(), 'cookie-a');
  cookie = 'cookie-b';
  assert.equal(ctx.getUserCookie(), 'cookie-b');
  assert.equal(ctx.now(), 456);
});
