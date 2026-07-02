const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createQQRouteContext,
} = require('../server-dist/server/composition/qq-context');

test('createQQRouteContext preserves QQ controller dependency order and route bindings', () => {
  const sendJSON = () => {};
  const readRequestBody = async () => ({});
  const logger = { error() {} };
  const deps = {
    sendJSON,
    readRequestBody,
    parseCookieString: raw => ({ raw }),
    normalizeQQCookieInput: raw => String(raw).trim(),
    qqCookieUin: cookie => cookie.uin,
    qqCookieMusicKey: cookie => cookie.qm_keyst,
    saveQQCookie: () => {},
    getQQLoginInfo: async () => ({ loggedIn: false }),
    handleQQSearch: async () => [],
    handleQQSongUrl: async () => ({ url: '' }),
    handleQQLyric: async () => ({ lyric: '' }),
    handleQQUserPlaylists: async () => ({ playlists: [] }),
    handleQQPlaylistTracks: async () => ({ tracks: [] }),
    handleQQArtistDetail: async () => ({ artist: null, songs: [] }),
    handleQQSongComments: async () => ({ comments: [] }),
    logger,
  };
  const req = { method: 'POST' };
  const url = new URL('http://localhost/api/qq/search?keywords=rain');

  const ctx = createQQRouteContext(deps, {
    pathname: '/api/qq/search',
    url,
    req,
    res: 'res',
  });

  assert.deepEqual(Object.keys(ctx), [
    'pathname',
    'url',
    'req',
    'res',
    'sendJSON',
    'readRequestBody',
    'parseCookieString',
    'normalizeQQCookieInput',
    'qqCookieUin',
    'qqCookieMusicKey',
    'saveQQCookie',
    'getQQLoginInfo',
    'handleQQSearch',
    'handleQQSongUrl',
    'handleQQLyric',
    'handleQQUserPlaylists',
    'handleQQPlaylistTracks',
    'handleQQArtistDetail',
    'handleQQSongComments',
    'logger',
  ]);
  assert.equal(ctx.url, url);
  assert.equal(ctx.req, req);
  assert.equal(ctx.sendJSON, sendJSON);
  assert.equal(ctx.readRequestBody, readRequestBody);
  assert.equal(ctx.logger, logger);
});
