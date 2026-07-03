const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fetchQQArtistDetail,
  fetchQQPlaylistTracks,
  fetchQQLyric,
  fetchQQSongComments,
  fetchQQUserPlaylists,
  searchQQSongs,
} = require('../server-dist/server/services/qq-orchestration');
const {
  decodeQQLyricText,
  normalizeQQSongId,
} = require('../server-dist/server/services/lyric-utils');
const {
  buildQQPlaylistTracksPayload,
  mapQQTrack,
  uniqueNamedQQSongs,
  uniqueQQPlaylists,
} = require('../server-dist/server/services/music-mapper');
const {
  buildQQSongCommentsPayload,
  mapQQPlaylist,
  qqSingerAvatar,
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

test('fetchQQArtistDetail returns missing-singer payload without upstream calls', async () => {
  let called = false;
  const result = await fetchQQArtistDetail('   ', 36, {
    qqMusicRequest: async () => { called = true; return {}; },
    mapQQTrack,
    qqSingerAvatar,
  });

  assert.deepEqual(result, { provider: 'qq', error: 'MISSING_SINGER_MID', artist: null, songs: [] });
  assert.equal(called, false);
});

test('fetchQQArtistDetail clamps limits and maps artist songs', async () => {
  const calls = [];
  const result = await fetchQQArtistDetail('singer001', 500, {
    qqMusicRequest: async (payload, opts) => {
      calls.push({ payload, opts });
      return {
        singer: {
          code: 0,
          data: {
            singer_info: { id: 66, mid: 'singer001', name: 'QQ Artist', pic: 'artist.jpg', fans: 12 },
            total_song: 2,
            total_album: 3,
            total_mv: 4,
            songlist: [
              {
                track_info: {
                  mid: 'song001',
                  name: 'Song One',
                  singer: [{ id: 66, mid: 'singer001', name: 'QQ Artist' }],
                  album: { mid: 'album001', name: 'Album One' },
                  interval: 201,
                },
              },
            ],
          },
        },
      };
    },
    mapQQTrack,
    qqSingerAvatar,
  });

  assert.equal(calls[0].payload.singer.param.num, 80);
  assert.deepEqual(calls[0].opts, { cookie: true });
  assert.equal(result.artist.name, 'QQ Artist');
  assert.equal(result.artist.avatar, 'artist.jpg');
  assert.equal(result.total, 2);
  assert.equal(result.songs[0].id, 'song001');
});

test('fetchQQArtistDetail returns provider errors and fallback artist names', async () => {
  const failed = await fetchQQArtistDetail('singer001', 4, {
    qqMusicRequest: async () => ({ singer: { code: 1000, message: 'artist unavailable' } }),
    mapQQTrack,
    qqSingerAvatar,
  });
  assert.deepEqual(failed, { provider: 'qq', error: 'artist unavailable', artist: null, songs: [] });

  const fallback = await fetchQQArtistDetail('fallbackSinger', 4, {
    qqMusicRequest: async () => ({
      singer: {
        code: 0,
        data: {
          singerInfo: {},
          song_count: 1,
          songlist: [
            {
              mid: 'song002',
              name: 'Fallback Song',
              singer: [{ mid: 'fallbackSinger', name: 'Fallback Name' }],
              album: {},
            },
          ],
        },
      },
    }),
    mapQQTrack,
    qqSingerAvatar,
  });
  assert.equal(fallback.artist.mid, 'fallbackSinger');
  assert.equal(fallback.artist.name, 'Fallback Name');
  assert.match(fallback.artist.avatar, /T001R300x300M000fallbackSinger/);
});

test('fetchQQSongComments returns missing id when id and detail fallback cannot resolve topid', async () => {
  const warnings = [];
  const result = await fetchQQSongComments('', 'missing-mid', 20, 0, {
    qqSongDetail: async () => { throw new Error('detail failed'); },
    qqGetJSON: async () => { throw new Error('should not fetch comments'); },
    qqCookieUin: () => '12345',
    buildQQSongCommentsPayload,
    logger: { warn(...args) { warnings.push(args); } },
  });

  assert.deepEqual(result, { provider: 'qq', error: 'Missing QQ song id', comments: [] });
  assert.deepEqual(warnings, [['[QQComments] detail fallback failed:', 'detail failed']]);
});

test('fetchQQSongComments resolves topid from detail fallback and maps first page comments', async () => {
  const calls = [];
  const result = await fetchQQSongComments('', 'trackmid001', 6, 0, {
    qqSongDetail: async (mid, fallback) => {
      assert.deepEqual(fallback, { mid: 'trackmid001' });
      return { qqId: '22001', mid };
    },
    qqGetJSON: async (url, params, opts) => {
      calls.push({ url, params, opts });
      return {
        hot_comment: {
          commentlist: [
            { commentid: 'hot1', rootcommentcontent: 'nice', praisenum: 9, time: 1700000000, nick: 'Fan' },
          ],
        },
        comment: { commenttotal: 1, commentlist: [] },
      };
    },
    qqCookieUin: () => '12345',
    buildQQSongCommentsPayload,
    logger: { warn() {} },
  });

  assert.equal(calls[0].params.topid, '22001');
  assert.equal(calls[0].params.pagenum, '0');
  assert.equal(calls[0].params.pagesize, '6');
  assert.equal(calls[0].params.loginUin, '12345');
  assert.deepEqual(calls[0].opts, { headers: { Referer: 'https://y.qq.com/n/ryqq/songDetail/trackmid001' } });
  assert.equal(result.total, 1);
  assert.equal(result.hot, true);
  assert.equal(result.comments[0].content, 'nice');
});

test('fetchQQSongComments strips nonnumeric ids and maps paged comments', async () => {
  const result = await fetchQQSongComments('id-22001', '', 6, 12, {
    qqSongDetail: async () => { throw new Error('should not resolve detail'); },
    qqGetJSON: async (url, params) => {
      assert.equal(params.topid, '22001');
      assert.equal(params.pagenum, '2');
      return {
        comment: {
          commenttotal: 2,
          commentlist: [
            { commentid: 'c1', rootcommentcontent: 'regular', praisenum: 1, time: 1700000000, nick: 'Listener' },
          ],
        },
      };
    },
    qqCookieUin: () => '',
    buildQQSongCommentsPayload,
    logger: { warn() {} },
  });

  assert.equal(result.id, '22001');
  assert.equal(result.hot, false);
  assert.equal(result.comments[0].content, 'regular');
});

test('fetchQQLyric requires a QQ song mid or id before upstream calls', async () => {
  let called = false;
  const result = await fetchQQLyric('', '', {
    qqMusicRequest: async () => { called = true; return {}; },
    qqGetJSON: async () => { called = true; return {}; },
    qqCookieUin: () => '12345',
    normalizeQQSongId,
    decodeQQLyricText,
    logger: { warn() {} },
  });

  assert.deepEqual(result, { provider: 'qq', error: 'Missing QQ song mid or id', lyric: '' });
  assert.equal(called, false);
});

test('fetchQQLyric returns decoded musicu lyric data', async () => {
  const result = await fetchQQLyric('qqmid001', '12001', {
    qqMusicRequest: async (payload, opts) => {
      assert.deepEqual(payload.lyric.param, { songMID: 'qqmid001', songID: 12001 });
      assert.deepEqual(opts, { cookie: true });
      return {
        lyric: {
          data: {
            lyric: Buffer.from('[00:01]hello').toString('base64'),
            trans: Buffer.from('[00:01]你好').toString('base64'),
            qrc: Buffer.from('[offset:0]qrc text').toString('base64'),
            roma: Buffer.from('[00:01]roma text').toString('base64'),
          },
        },
      };
    },
    qqGetJSON: async () => { throw new Error('legacy should not run'); },
    qqCookieUin: () => '12345',
    normalizeQQSongId,
    decodeQQLyricText,
    logger: { warn() {} },
  });

  assert.equal(result.id, 12001);
  assert.equal(result.mid, 'qqmid001');
  assert.equal(result.lyric, '[00:01]hello');
  assert.equal(result.tlyric, '[00:01]你好');
  assert.equal(result.qrc, '[offset:0]qrc text');
  assert.equal(result.roma, '[00:01]roma text');
  assert.equal(result.source, 'qq-musicu');
});

test('fetchQQLyric falls back to legacy lyric lookup when musicu has no lyric', async () => {
  const warnings = [];
  const result = await fetchQQLyric('qqmid001', '', {
    qqMusicRequest: async () => ({ lyric: { data: {} } }),
    qqGetJSON: async (url, params, opts) => {
      assert.equal(params.songmid, 'qqmid001');
      assert.equal(params.loginUin, '12345');
      assert.deepEqual(opts, { headers: { Referer: 'https://y.qq.com/portal/player.html' } });
      return { lyric: '[00:02]legacy', trans: '[00:02]legacy trans' };
    },
    qqCookieUin: () => '12345',
    normalizeQQSongId,
    decodeQQLyricText,
    logger: { warn(...args) { warnings.push(args); } },
  });

  assert.equal(result.lyric, '[00:02]legacy');
  assert.equal(result.tlyric, '[00:02]legacy trans');
  assert.equal(result.source, 'qq-legacy');
  assert.deepEqual(warnings, []);
});

test('fetchQQLyric returns qq-empty when musicu and legacy fail', async () => {
  const warnings = [];
  const result = await fetchQQLyric('qqmid001', '', {
    qqMusicRequest: async () => { throw new Error('musicu offline'); },
    qqGetJSON: async () => { throw new Error('legacy offline'); },
    qqCookieUin: () => '0',
    normalizeQQSongId,
    decodeQQLyricText,
    logger: { warn(...args) { warnings.push(args); } },
  });

  assert.equal(result.lyric, '');
  assert.equal(result.source, 'qq-empty');
  assert.deepEqual(warnings, [
    ['[QQLyric] musicu failed:', 'musicu offline'],
    ['[QQLyric] legacy failed:', 'legacy offline'],
  ]);
});
