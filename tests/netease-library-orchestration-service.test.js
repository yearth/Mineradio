const test = require('node:test');
const assert = require('node:assert/strict');

const {
  addNeteaseSongToPlaylist,
  checkNeteaseSongLikes,
  createNeteasePlaylist,
  fetchNeteaseUserPlaylists,
  toggleNeteaseSongLike,
} = require('../server-dist/server/services/netease-library-orchestration');

function baseDeps(overrides = {}) {
  const calls = [];
  return {
    calls,
    deps: {
      getUserCookie: () => 'MUSIC_U=secret',
      userPlaylist: async opts => {
        calls.push(['userPlaylist', opts]);
        return {
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
          },
        };
      },
      songLikeCheck: async opts => {
        calls.push(['songLikeCheck', opts]);
        return { body: { data: { 10: true } } };
      },
      likelist: async opts => {
        calls.push(['likelist', opts]);
        return { body: { ids: [11] } };
      },
      likeSong: async opts => {
        calls.push(['likeSong', opts]);
        return { body: { code: 200 } };
      },
      playlistCreate: async opts => {
        calls.push(['playlistCreate', opts]);
        return { body: { code: 200, playlist: { id: 9, name: opts.name } } };
      },
      playlistTracks: async opts => {
        calls.push(['playlistTracks', opts]);
        return { body: { code: 200, message: 'ok' } };
      },
      playlistTrackAdd: async opts => {
        calls.push(['playlistTrackAdd', opts]);
        return { body: { code: 200, message: 'fallback ok' } };
      },
      normalizeApiCode: input => (input.body && input.body.code) || input.code || 200,
      normalizeApiMessage: input => (input.body && input.body.message) || input.message || '',
      now: () => 123,
      logger: { warn: (...args) => calls.push(['warn', args]) },
      ...overrides,
    },
  };
}

test('fetchNeteaseUserPlaylists maps provider playlists with login metadata', async () => {
  const { calls, deps } = baseDeps();

  const result = await fetchNeteaseUserPlaylists({ loggedIn: true, userId: 7 }, 8, deps);

  assert.deepEqual(result, {
    loggedIn: true,
    userId: 7,
    playlists: [{
      id: 1,
      name: 'List',
      cover: 'cover',
      trackCount: 2,
      playCount: 3,
      creator: 'Me',
      subscribed: true,
      specialType: 5,
    }],
  });
  assert.deepEqual(calls, [
    ['userPlaylist', { uid: 7, limit: 8, cookie: 'MUSIC_U=secret', timestamp: 123 }],
  ]);
});

test('fetchNeteaseUserPlaylists returns logged-out defaults without provider calls', async () => {
  const { calls, deps } = baseDeps();

  const result = await fetchNeteaseUserPlaylists({ loggedIn: false }, 8, deps);

  assert.deepEqual(result, { loggedIn: false, playlists: [] });
  assert.deepEqual(calls, []);
});

test('checkNeteaseSongLikes uses direct check and falls back to likelist when needed', async () => {
  const direct = baseDeps();
  assert.deepEqual(await checkNeteaseSongLikes(['10', '11'], { userId: 7 }, direct.deps), {
    loggedIn: true,
    ids: ['10', '11'],
    liked: { 10: true, 11: false },
  });
  assert.deepEqual(direct.calls, [
    ['songLikeCheck', { ids: '[10,11]', cookie: 'MUSIC_U=secret', timestamp: 123 }],
  ]);

  const fallback = baseDeps({
    songLikeCheck: async opts => {
      fallbackCalls.push(['songLikeCheck', opts]);
      return { body: { data: {} } };
    },
  });
  const fallbackCalls = fallback.calls;

  assert.deepEqual(await checkNeteaseSongLikes(['11'], { userId: 7 }, fallback.deps), {
    loggedIn: true,
    ids: ['11'],
    liked: { 11: true },
  });
  assert.deepEqual(fallback.calls, [
    ['songLikeCheck', { ids: '[11]', cookie: 'MUSIC_U=secret', timestamp: 123 }],
    ['likelist', { uid: 7, cookie: 'MUSIC_U=secret', timestamp: 123 }],
  ]);
});

test('toggleNeteaseSongLike preserves provider body and requested state', async () => {
  const { calls, deps } = baseDeps();

  const result = await toggleNeteaseSongLike('10', false, deps);

  assert.deepEqual(result, {
    loggedIn: true,
    id: '10',
    liked: false,
    code: 200,
    body: { code: 200 },
  });
  assert.deepEqual(calls, [
    ['likeSong', { id: '10', like: 'false', cookie: 'MUSIC_U=secret', timestamp: 123 }],
  ]);
});

test('createNeteasePlaylist trims names and returns created playlist payloads', async () => {
  const { calls, deps } = baseDeps();

  const result = await createNeteasePlaylist(' Rain ', '10', deps);

  assert.deepEqual(result, {
    loggedIn: true,
    playlist: { id: 9, name: 'Rain' },
    body: { code: 200, playlist: { id: 9, name: 'Rain' } },
  });
  assert.deepEqual(calls, [
    ['playlistCreate', { name: 'Rain', privacy: '10', cookie: 'MUSIC_U=secret', timestamp: 123 }],
  ]);
});

test('addNeteaseSongToPlaylist returns primary success and fallback failure attempts', async () => {
  const primary = baseDeps();

  const ok = await addNeteaseSongToPlaylist('77', '10', primary.deps);

  assert.equal(ok.success, true);
  assert.deepEqual(ok.attempts.map(item => item.api), ['playlist_tracks']);
  assert.deepEqual(primary.calls, [
    ['playlistTracks', { op: 'add', pid: '77', tracks: '10', cookie: 'MUSIC_U=secret', timestamp: 123 }],
  ]);

  const fallback = baseDeps({
    playlistTracks: async opts => {
      fallbackCalls.push(['playlistTracks', opts]);
      return { body: { code: 500, message: 'primary failed' } };
    },
    playlistTrackAdd: async opts => {
      fallbackCalls.push(['playlistTrackAdd', opts]);
      return { body: { code: 401, message: 'expired' } };
    },
  });
  const fallbackCalls = fallback.calls;

  const failed = await addNeteaseSongToPlaylist('77', '10,11', fallback.deps);

  assert.deepEqual(failed, {
    loggedIn: true,
    pid: '77',
    id: '10,11',
    success: false,
    code: 401,
    error: 'expired',
    attempts: [
      { api: 'playlist_tracks', code: 500, message: 'primary failed', body: { code: 500, message: 'primary failed' } },
      { api: 'playlist_track_add', code: 401, message: 'expired', body: { code: 401, message: 'expired' } },
    ],
  });
  assert.equal(failed.status, undefined);
  assert.deepEqual(fallback.calls.map(call => call[0]), ['playlistTracks', 'playlistTrackAdd']);
});
