const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fetchQQPlaylistTracks,
  fetchQQUserPlaylists,
  searchQQSongs,
} = require('../server-dist/server/services/qq-orchestration');
const {
  buildQQPlaylistTracksPayload,
  uniqueNamedQQSongs,
  uniqueQQPlaylists,
} = require('../server-dist/server/services/music-mapper');
const {
  mapQQPlaylist,
} = require('../server-dist/server/services/qq-utils');

test('searchQQSongs returns empty results for blank keywords without provider calls', async () => {
  let called = false;
  const songs = await searchQQSongs('   ', 8, {
    qqSmartboxSearch: async () => { called = true; return []; },
    qqSongDetail: async () => { called = true; return null; },
    uniqueNamedQQSongs,
    logger: { log() {}, warn() {} },
  });

  assert.deepEqual(songs, []);
  assert.equal(called, false);
});

test('searchQQSongs enriches smartbox results and keeps fallback items when detail fails', async () => {
  const warnings = [];
  const songs = await searchQQSongs(' rain ', 8, {
    qqSmartboxSearch: async (keywords, limit) => {
      assert.equal(keywords, 'rain');
      assert.equal(limit, 8);
      return [
        { mid: 'mid-1', name: 'Base 1', artist: 'Artist 1' },
        { mid: 'mid-2', name: 'Base 2', artist: 'Artist 2' },
        { mid: 'mid-2', name: 'Duplicate Base 2', artist: 'Artist 2' },
      ];
    },
    qqSongDetail: async (mid, fallback) => {
      if (mid === 'mid-1') return { ...fallback, name: 'Detailed 1', album: 'Album 1' };
      throw new Error('detail offline');
    },
    uniqueNamedQQSongs,
    logger: {
      log() {},
      warn(...args) { warnings.push(args); },
    },
  });

  assert.deepEqual(songs, [
    { mid: 'mid-1', name: 'Detailed 1', artist: 'Artist 1', album: 'Album 1' },
    { mid: 'mid-2', name: 'Base 2', artist: 'Artist 2' },
  ]);
  assert.deepEqual(warnings, [
    ['[QQSearch] detail failed:', 'mid-2', 'detail offline'],
    ['[QQSearch] detail failed:', 'mid-2', 'detail offline'],
  ]);
});

test('fetchQQUserPlaylists returns logged-out defaults without upstream playlist calls', async () => {
  let upstreamCalled = false;
  const result = await fetchQQUserPlaylists({
    getQQLoginInfo: async () => ({ loggedIn: false }),
    qqGetJSON: async () => { upstreamCalled = true; return {}; },
    mapQQPlaylist,
    uniqueQQPlaylists,
  });

  assert.deepEqual(result, { loggedIn: false, provider: 'qq', playlists: [] });
  assert.equal(upstreamCalled, false);
});

test('fetchQQUserPlaylists combines created and collected playlists', async () => {
  const calls = [];
  const result = await fetchQQUserPlaylists({
    getQQLoginInfo: async () => ({ loggedIn: true, userId: '12345' }),
    qqGetJSON: async (url, params, opts) => {
      calls.push({ url, params, opts });
      if (url.includes('fcg_user_created_diss')) {
        return {
          data: {
            disslist: [
              { dissid: 'created-1', diss_name: 'QQ Created', diss_cover: 'created.jpg', song_cnt: 12 },
            ],
          },
        };
      }
      return {
        data: {
          cdlist: [
            { dissid: 'created-1', diss_name: 'Duplicate' },
            { dissid: 'fav-1', diss_name: '我喜欢的音乐', diss_cover: 'favorite.jpg', songnum: 21 },
          ],
        },
      };
    },
    mapQQPlaylist,
    uniqueQQPlaylists,
  });

  assert.equal(result.loggedIn, true);
  assert.equal(result.provider, 'qq');
  assert.equal(result.userId, '12345');
  assert.deepEqual(result.playlists.map(item => item.id), ['fav-1', 'created-1']);
  assert.equal(calls[0].params.hostuin, '12345');
  assert.equal(calls[0].params.loginUin, '12345');
  assert.equal(calls[1].params.userid, '12345');
  assert.deepEqual(calls.map(call => call.opts), [
    { headers: { Referer: 'https://y.qq.com/portal/profile.html' } },
    { headers: { Referer: 'https://y.qq.com/portal/profile.html' } },
  ]);
});

test('fetchQQUserPlaylists keeps collected playlists when created lookup fails', async () => {
  const result = await fetchQQUserPlaylists({
    getQQLoginInfo: async () => ({ loggedIn: true, userId: '12345' }),
    qqGetJSON: async url => {
      if (url.includes('fcg_user_created_diss')) throw new Error('created list unavailable');
      return {
        data: {
          cdlist: [
            { dissid: 'collect-1', diss_name: 'Collected Only', diss_cover: 'collected.jpg' },
          ],
        },
      };
    },
    mapQQPlaylist,
    uniqueQQPlaylists,
  });

  assert.deepEqual(result.playlists.map(item => item.id), ['collect-1']);
});

test('fetchQQUserPlaylists keeps created playlists when collected lookup fails', async () => {
  const result = await fetchQQUserPlaylists({
    getQQLoginInfo: async () => ({ loggedIn: true, userId: '12345' }),
    qqGetJSON: async url => {
      if (url.includes('fcg_get_profile_order_asset')) throw new Error('collected list unavailable');
      return {
        data: {
          disslist: [
            { dissid: 'created-1', diss_name: 'Created Only', diss_cover: 'created.jpg' },
          ],
        },
      };
    },
    mapQQPlaylist,
    uniqueQQPlaylists,
  });

  assert.deepEqual(result.playlists.map(item => item.id), ['created-1']);
});

test('fetchQQPlaylistTracks returns logged-out and missing-id defaults before detail lookup', async () => {
  let upstreamCalled = false;
  const loggedOut = await fetchQQPlaylistTracks('77', {
    getQQLoginInfo: async () => ({ loggedIn: false }),
    qqGetJSON: async () => { upstreamCalled = true; return {}; },
    buildQQPlaylistTracksPayload,
  });
  const missing = await fetchQQPlaylistTracks('   ', {
    getQQLoginInfo: async () => ({ loggedIn: true, userId: '12345' }),
    qqGetJSON: async () => { upstreamCalled = true; return {}; },
    buildQQPlaylistTracksPayload,
  });

  assert.deepEqual(loggedOut, { loggedIn: false, provider: 'qq', tracks: [] });
  assert.deepEqual(missing, { loggedIn: true, provider: 'qq', error: 'Missing QQ playlist id', tracks: [] });
  assert.equal(upstreamCalled, false);
});

test('fetchQQPlaylistTracks maps QQ playlist detail tracks', async () => {
  const calls = [];
  const result = await fetchQQPlaylistTracks('77', {
    getQQLoginInfo: async () => ({ loggedIn: true, userId: '12345' }),
    qqGetJSON: async (url, params, opts) => {
      calls.push({ url, params, opts });
      return {
        cdlist: [
          {
            dissname: 'QQ Track List',
            logo: 'cover.jpg',
            songlist: [
              {
                id: 22001,
                mid: 'trackmid001',
                name: 'QQ Track',
                singer: [{ id: 66, mid: 'singer001', name: 'QQ Artist' }],
                album: { mid: 'albummid001', name: 'QQ Album' },
                interval: 201,
                file: { media_mid: 'media-track-001' },
                pay: { pay_play: 1 },
              },
            ],
          },
        ],
      };
    },
    buildQQPlaylistTracksPayload,
  });

  assert.equal(result.loggedIn, true);
  assert.equal(result.provider, 'qq');
  assert.equal(result.playlist.id, '77');
  assert.equal(result.tracks.length, 1);
  assert.equal(result.tracks[0].id, 'trackmid001');
  assert.equal(calls[0].params.disstid, '77');
  assert.equal(calls[0].params.loginUin, '12345');
  assert.deepEqual(calls[0].opts, { headers: { Referer: 'https://y.qq.com/n/yqq/playlist' } });
});
