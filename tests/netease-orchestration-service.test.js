const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDiscoverHome,
  searchNeteaseSongs,
} = require('../server-dist/server/services/netease-orchestration');
const {
  isLowSignalPodcastItem,
  mapDiscoverPlaylist,
  mapPodcastRadio,
  mapSongRecord,
} = require('../server-dist/server/services/music-mapper');

test('searchNeteaseSongs maps cloudsearch songs and backfills missing covers', async () => {
  const calls = [];
  const songs = await searchNeteaseSongs('rain', 3, {
    cloudsearch: async opts => {
      calls.push(['cloudsearch', opts]);
      return {
        body: {
          result: {
            songs: [
              {
                id: 101,
                name: 'Rain Loop',
                ar: [{ id: 7, name: 'Nova' }],
                al: { name: 'Weather Beats', picUrl: '' },
                dt: 188000,
                fee: 0,
              },
            ],
          },
        },
      };
    },
    songDetail: async opts => {
      calls.push(['song_detail', opts]);
      return {
        body: {
          songs: [
            { id: 101, al: { picUrl: 'https://img.example/rain.jpg' } },
          ],
        },
      };
    },
    getUserCookie: () => 'MUSIC_U=test-user',
    mapSongRecord,
    logger: { log() {}, warn() {} },
  });

  assert.deepEqual(songs, [
    {
      provider: 'netease',
      source: 'netease',
      type: 'song',
      id: 101,
      name: 'Rain Loop',
      artist: 'Nova',
      artists: [{ id: 7, name: 'Nova' }],
      artistId: 7,
      album: 'Weather Beats',
      cover: 'https://img.example/rain.jpg',
      duration: 188000,
      fee: 0,
    },
  ]);
  assert.deepEqual(calls, [
    ['cloudsearch', { keywords: 'rain', limit: 3, cookie: 'MUSIC_U=test-user' }],
    ['song_detail', { ids: '101', cookie: 'MUSIC_U=test-user' }],
  ]);
});

test('searchNeteaseSongs keeps mapped songs when cover backfill fails', async () => {
  const warnings = [];
  const songs = await searchNeteaseSongs('rain', 3, {
    cloudsearch: async () => ({
      body: {
        result: {
          songs: [
            {
              id: 102,
              name: 'No Cover',
              ar: [{ id: 8, name: 'Fallback Artist' }],
              al: { name: 'Fallback Album', picUrl: '' },
            },
          ],
        },
      },
    }),
    songDetail: async () => { throw new Error('detail offline'); },
    getUserCookie: () => 'MUSIC_U=test-user',
    mapSongRecord,
    logger: {
      log() {},
      warn(...args) { warnings.push(args); },
    },
  });

  assert.equal(songs.length, 1);
  assert.equal(songs[0].id, 102);
  assert.equal(songs[0].cover, '');
  assert.deepEqual(warnings, [['[Search] backfill failed:', 'detail offline']]);
});

test('buildDiscoverHome returns starter payload while logged out without upstream calls', async () => {
  let upstreamCalled = false;
  const home = await buildDiscoverHome({
    getLoginInfo: async () => ({ loggedIn: false }),
    getUserCookie: () => '',
    personalized: async () => { upstreamCalled = true; return { body: {} }; },
    djHot: async () => { upstreamCalled = true; return { body: {} }; },
    recommendResource: async () => { upstreamCalled = true; return { body: {} }; },
    recommendSongs: async () => { upstreamCalled = true; return { body: {} }; },
    mapDiscoverPlaylist,
    mapPodcastRadio,
    mapSongRecord,
    isLowSignalPodcastItem,
    now: () => 123,
  });

  assert.deepEqual(home, {
    loggedIn: false,
    user: null,
    dailySongs: [],
    playlists: [],
    podcasts: [],
    mode: 'starter',
    updatedAt: 123,
  });
  assert.equal(upstreamCalled, false);
});

test('buildDiscoverHome combines playlist, podcast, and daily song sources for logged-in users', async () => {
  const calls = [];
  let cookieCalls = 0;
  const home = await buildDiscoverHome({
    getLoginInfo: async () => ({
      loggedIn: true,
      userId: 9600,
      nickname: 'Discover User',
      avatar: 'https://img.example/discover-avatar.jpg',
    }),
    getUserCookie: () => {
      cookieCalls += 1;
      return 'MUSIC_U=test-user; __csrf=test-csrf';
    },
    personalized: async opts => {
      calls.push(['personalized', opts]);
      return { body: { result: [{ id: 510, name: 'Public Picks', picUrl: 'https://img.example/public.jpg' }] } };
    },
    djHot: async opts => {
      calls.push(['dj_hot', opts]);
      return {
        body: {
          djRadios: [
            { id: 610, name: 'Clean Podcast', picUrl: 'https://img.example/podcast-clean.jpg', desc: 'Good signal', dj: { nickname: 'Podcast DJ' } },
            { id: 611, name: 'Qzone 背景音乐', picUrl: 'https://img.example/low-signal.jpg' },
          ],
        },
      };
    },
    recommendResource: async opts => {
      calls.push(['recommend_resource', opts]);
      return { body: { recommend: [{ id: 520, name: 'Private Picks', coverImgUrl: 'https://img.example/private.jpg' }] } };
    },
    recommendSongs: async opts => {
      calls.push(['recommend_songs', opts]);
      return {
        body: {
          data: {
            dailySongs: [
              {
                id: 710,
                name: 'Daily Track',
                ar: [{ id: 81, name: 'Daily Artist' }],
                al: { name: 'Daily Album', picUrl: 'https://img.example/daily.jpg' },
              },
            ],
          },
        },
      };
    },
    mapDiscoverPlaylist,
    mapPodcastRadio,
    mapSongRecord,
    isLowSignalPodcastItem,
    now: () => 456,
  });

  assert.equal(home.loggedIn, true);
  assert.deepEqual(home.user, {
    userId: 9600,
    nickname: 'Discover User',
    avatar: 'https://img.example/discover-avatar.jpg',
  });
  assert.deepEqual(home.playlists.map(item => item.id), [520, 510]);
  assert.deepEqual(home.podcasts.map(item => item.id), [610]);
  assert.deepEqual(home.dailySongs.map(item => item.id), [710]);
  assert.equal(home.updatedAt, 456);
  assert.deepEqual(calls.map(call => call[0]), ['personalized', 'dj_hot', 'recommend_resource', 'recommend_songs']);
  assert.equal(calls.every(call => call[1].cookie === 'MUSIC_U=test-user; __csrf=test-csrf'), true);
  assert.equal(cookieCalls, 4);
});

test('buildDiscoverHome keeps fulfilled sections when some logged-in upstreams fail', async () => {
  const home = await buildDiscoverHome({
    getLoginInfo: async () => ({
      loggedIn: true,
      userId: 9601,
      nickname: 'Partial User',
      avatar: '',
    }),
    getUserCookie: () => 'MUSIC_U=test-user',
    personalized: async () => ({
      body: {
        result: [
          { id: 530, name: 'Still Public', picUrl: 'https://img.example/public-still.jpg' },
        ],
      },
    }),
    djHot: async () => { throw new Error('podcast offline'); },
    recommendResource: async () => ({
      body: {
        recommend: [
          { id: 540, name: 'Still Private', coverImgUrl: 'https://img.example/private-still.jpg' },
        ],
      },
    }),
    recommendSongs: async () => { throw new Error('daily offline'); },
    mapDiscoverPlaylist,
    mapPodcastRadio,
    mapSongRecord,
    isLowSignalPodcastItem,
    now: () => 789,
  });

  assert.equal(home.loggedIn, true);
  assert.deepEqual(home.playlists.map(item => item.id), [540, 530]);
  assert.deepEqual(home.podcasts, []);
  assert.deepEqual(home.dailySongs, []);
  assert.equal(home.updatedAt, 789);
});
