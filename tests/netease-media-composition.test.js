const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createNeteaseMediaRouteContext,
} = require('../server-dist/server/composition/netease-media-context');

test('createNeteaseMediaRouteContext preserves media route dependencies and reads runtime values lazily', () => {
  let cookie = 'cookie-a';
  const sendJSON = () => {};
  const logger = { error() {}, warn() {} };
  const base = {
    sendJSON,
    getUserCookie: () => cookie,
    getLoginInfo: async () => ({ loggedIn: true }),
    handleSongUrl: async () => ({ url: 'u' }),
    lyricNew: async () => ({ body: {} }),
    lyric: async () => ({ body: {} }),
    commentMusic: async () => ({ body: {} }),
    buildNeteaseSongCommentsPayload: () => ({ comments: [] }),
    artistDetail: async () => ({ body: {} }),
    artistSongs: async () => ({ body: {} }),
    artistTopSong: async () => ({ body: {} }),
    playlistTrackAll: async () => ({ body: {} }),
    playlistDetail: async () => ({ body: {} }),
    mapSongRecord: song => song,
    now: () => 456,
    logger,
  };

  const ctx = createNeteaseMediaRouteContext(base, {
    pathname: '/api/song/url',
    url: new URL('http://localhost/api/song/url?id=1'),
    res: 'res',
  });

  assert.deepEqual(Object.keys(ctx), [
    'pathname',
    'url',
    'res',
    'sendJSON',
    'getUserCookie',
    'getLoginInfo',
    'handleSongUrl',
    'lyricNew',
    'lyric',
    'commentMusic',
    'buildNeteaseSongCommentsPayload',
    'artistDetail',
    'artistSongs',
    'artistTopSong',
    'playlistTrackAll',
    'playlistDetail',
    'mapSongRecord',
    'now',
    'logger',
  ]);
  assert.equal(ctx.sendJSON, sendJSON);
  assert.equal(ctx.logger, logger);
  assert.equal(ctx.getUserCookie(), 'cookie-a');
  cookie = 'cookie-b';
  assert.equal(ctx.getUserCookie(), 'cookie-b');
  assert.equal(ctx.now(), 456);
});
