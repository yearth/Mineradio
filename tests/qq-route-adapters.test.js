const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createQQRouteAdapters,
} = require('../server-dist/server/composition/qq-route-adapters');

function createAdapters(overrides = {}) {
  const calls = [];
  const services = {
    fetchQQUserPlaylists: async deps => {
      calls.push(['fetchQQUserPlaylists', deps]);
      return 'playlists';
    },
    fetchQQPlaylistTracks: async (id, deps) => {
      calls.push(['fetchQQPlaylistTracks', id, deps]);
      return 'tracks';
    },
    fetchQQArtistDetail: async (mid, limit, deps) => {
      calls.push(['fetchQQArtistDetail', mid, limit, deps]);
      return 'artist';
    },
    searchQQSongs: async (keywords, limit, deps) => {
      calls.push(['searchQQSongs', keywords, limit, deps]);
      return 'search';
    },
    fetchQQSongComments: async (id, mid, limit, offset, deps) => {
      calls.push(['fetchQQSongComments', id, mid, limit, offset, deps]);
      return 'comments';
    },
    fetchQQLyric: async (mid, id, deps) => {
      calls.push(['fetchQQLyric', mid, id, deps]);
      return 'lyric';
    },
    qqVkeyFileCandidates: (songmid, mediaMid, qualityPreference) => {
      calls.push(['qqVkeyFileCandidates', songmid, mediaMid, qualityPreference]);
      return {
        requestedQuality: qualityPreference || 'standard',
        fileCandidates: [
          { filename: 'C400song.m4a', level: 'standard', label: 'Standard' },
        ],
        filenames: ['C400song.m4a'],
      };
    },
    qqPlaybackUnavailablePayload: payload => {
      calls.push(['qqPlaybackUnavailablePayload', payload]);
      return { provider: 'qq', playable: false, payload };
    },
    mapQQPlaylist: value => value,
    uniqueQQPlaylists: value => value,
    buildQQPlaylistTracksPayload: value => value,
    mapQQTrack: value => value,
    qqSingerAvatar: mid => `avatar:${mid}`,
    uniqueNamedQQSongs: value => value,
    buildQQSongCommentsPayload: value => value,
    normalizeQQSongId: value => String(value || '').trim(),
    decodeQQLyricText: value => value,
  };
  const deps = {
    getQQLoginInfo: async () => ({ provider: 'qq', loggedIn: true }),
    qqGetJSON: async () => ({}),
    qqMusicRequest: async () => ({
      req_0: {
        data: {
          sip: ['https://stream.example/'],
          midurlinfo: [{ filename: 'C400song.m4a', purl: 'song.m4a' }],
        },
      },
    }),
    qqSmartboxSearch: async () => [],
    qqSongDetail: async (mid, fallback) => fallback || { mid },
    qqCookieObject: () => ({ uin: '123', qm_keyst: 'music', qqmusic_key: 'playback' }),
    qqCookieUin: cookie => cookie.uin,
    qqCookieMusicKey: cookie => cookie.qm_keyst,
    qqCookiePlaybackKey: cookie => cookie.qqmusic_key,
    logger: { log() {}, warn() {} },
    random: () => 0.23456789,
    services,
    ...overrides,
  };
  return {
    calls,
    adapters: createQQRouteAdapters(deps),
  };
}

test('createQQRouteAdapters exposes legacy QQ handler surface and delegates orchestration services', async () => {
  const { adapters, calls } = createAdapters();

  assert.deepEqual(Object.keys(adapters), [
    'handleQQUserPlaylists',
    'handleQQPlaylistTracks',
    'handleQQArtistDetail',
    'handleQQSearch',
    'handleQQSongUrl',
    'handleQQSongComments',
    'handleQQLyric',
  ]);

  assert.equal(await adapters.handleQQUserPlaylists(), 'playlists');
  assert.equal(await adapters.handleQQPlaylistTracks('playlist-1'), 'tracks');
  assert.equal(await adapters.handleQQArtistDetail('singer-1', 9), 'artist');
  assert.equal(await adapters.handleQQSearch('rain', 5), 'search');
  assert.equal(await adapters.handleQQSongComments('123', 'mid-1', 20, 0), 'comments');
  assert.equal(await adapters.handleQQLyric('mid-1', '123'), 'lyric');

  assert.deepEqual(calls.map(call => call[0]), [
    'fetchQQUserPlaylists',
    'fetchQQPlaylistTracks',
    'fetchQQArtistDetail',
    'searchQQSongs',
    'fetchQQSongComments',
    'fetchQQLyric',
  ]);
});

test('createQQRouteAdapters preserves QQ song URL success payload and vkey request shape', async () => {
  const musicRequests = [];
  const { adapters, calls } = createAdapters({
    qqMusicRequest: async (payload, opts) => {
      musicRequests.push([payload, opts]);
      return {
        req_0: {
          data: {
            sip: ['https://stream.example/'],
            midurlinfo: [{ filename: 'C400song.m4a', purl: 'song.m4a' }],
          },
        },
      };
    },
  });

  const result = await adapters.handleQQSongUrl('song-mid', 'media-mid', 'standard');

  assert.deepEqual(result, {
    provider: 'qq',
    url: 'https://stream.example/song.m4a',
    trial: false,
    playable: true,
    level: 'standard',
    quality: 'Standard',
    filename: 'C400song.m4a',
    requestedQuality: 'standard',
  });
  assert.equal(musicRequests[0][1].cookie, true);
  assert.equal(musicRequests[0][0].req_0.param.guid, '31111110');
  assert.deepEqual(musicRequests[0][0].req_0.param.filename, ['C400song.m4a']);
  assert.equal(musicRequests[0][0].comm.authst, 'music');
  assert.deepEqual(calls[0], ['qqVkeyFileCandidates', 'song-mid', 'media-mid', 'standard']);
});

test('createQQRouteAdapters preserves missing-mid and unavailable QQ playback payloads', async () => {
  const unavailable = createAdapters({
    qqMusicRequest: async () => ({
      req_0: {
        data: {
          midurlinfo: [{ filename: 'C400song.m4a', purl: '' }],
        },
      },
    }),
  });

  assert.deepEqual(await unavailable.adapters.handleQQSongUrl('', 'media', 'standard'), {
    provider: 'qq',
    url: '',
    error: 'MISSING_MID',
    message: 'Missing QQ song mid',
  });

  const result = await unavailable.adapters.handleQQSongUrl('song-mid', 'media', 'standard');
  assert.equal(result.playable, false);
  assert.equal(unavailable.calls.at(-1)[0], 'qqPlaybackUnavailablePayload');
  assert.equal(unavailable.calls.at(-1)[1].hasSession, true);
  assert.equal(unavailable.calls.at(-1)[1].hasPlaybackKey, true);
});
