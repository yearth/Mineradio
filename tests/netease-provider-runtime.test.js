const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createNeteaseProviderRuntime,
} = require('../server-dist/server/runtime/netease-provider-runtime');

test('createNeteaseProviderRuntime exposes lazy Netease API proxies', async () => {
  const calls = [];
  const provider = createNeteaseProviderRuntime({
    search: async opts => {
      calls.push(['default-search', opts]);
      return { source: 'default-search' };
    },
    like: async opts => {
      calls.push(['default-like', opts]);
      return { source: 'default-like' };
    },
  });

  assert.equal(await provider.api.search({ keywords: 'rain' }).then(r => r.source), 'default-search');

  provider.runtime.apply({
    search: async opts => {
      calls.push(['override-search', opts]);
      return { source: 'override-search' };
    },
    like: async opts => {
      calls.push(['override-like', opts]);
      return { source: 'override-like' };
    },
  });

  assert.equal(await provider.api.search({ keywords: 'sun' }).then(r => r.source), 'override-search');
  assert.equal(await provider.api.like_song({ id: 101 }).then(r => r.source), 'override-like');
  assert.deepEqual(calls, [
    ['default-search', { keywords: 'rain' }],
    ['override-search', { keywords: 'sun' }],
    ['override-like', { id: 101 }],
  ]);
});

test('createNeteaseProviderRuntime keeps proxy keys and missing-provider errors stable', () => {
  const provider = createNeteaseProviderRuntime({});

  assert.deepEqual(Object.keys(provider.api), [
    'search',
    'cloudsearch',
    'song_detail',
    'song_url',
    'song_url_v1',
    'login_qr_key',
    'login_qr_create',
    'login_qr_check',
    'login_status',
    'logout',
    'user_account',
    'user_playlist',
    'comment_music',
    'artist_detail',
    'artist_top_song',
    'artist_songs',
    'like_song',
    'likelist',
    'song_like_check',
    'playlist_tracks',
    'playlist_track_add',
    'playlist_create',
    'playlist_detail',
    'playlist_track_all',
    'personalized',
    'recommend_resource',
    'recommend_songs',
    'dj_detail',
    'dj_program',
    'dj_hot',
    'dj_sublist',
    'user_audio',
    'dj_paygift',
    'record_recent_voice',
    'sati_resource_sub_list',
    'lyric',
    'lyric_new',
  ]);
  assert.throws(
    () => provider.api.like_song({ id: 101 }),
    /like_song is not a function/
  );
});
