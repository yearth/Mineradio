const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDiscoverHome,
  fetchNeteasePodcastCollectionItems,
  searchNeteaseSongs,
} = require('../server-dist/server/services/netease-orchestration');
const {
  firstArrayFrom,
  isLowSignalPodcastItem,
  mapDiscoverPlaylist,
  mapPodcastCollectionRadios,
  mapPodcastRadio,
  mapPodcastVoiceItems,
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

test('fetchNeteasePodcastCollectionItems maps collected podcast radios with clamped params', async () => {
  const calls = [];
  const result = await fetchNeteasePodcastCollectionItems('collect', { userId: 99 }, 5, -4, {
    djSublist: async opts => {
      calls.push(['dj_sublist', opts]);
      return {
        body: {
          djRadios: [
            { id: 801, name: 'Collected Radio', picUrl: 'https://img.example/collected.jpg' },
          ],
        },
      };
    },
    userAudio: async () => { throw new Error('unexpected user_audio'); },
    djPaygift: async () => { throw new Error('unexpected dj_paygift'); },
    satiResourceSubList: async () => { throw new Error('unexpected sati'); },
    recordRecentVoice: async () => { throw new Error('unexpected recent'); },
    getUserCookie: () => 'MUSIC_U=test-user',
    firstArrayFrom,
    mapPodcastCollectionRadios,
    mapPodcastVoiceItems,
    now: () => 321,
    logger: { warn() {} },
  });

  assert.equal(result.itemType, 'radio');
  assert.deepEqual(result.items.map(item => item.id), [801]);
  assert.equal(result.items[0].collectionKey, 'collect');
  assert.deepEqual(calls, [
    ['dj_sublist', { limit: 8, offset: 0, cookie: 'MUSIC_U=test-user', timestamp: 321 }],
  ]);
});

test('fetchNeteasePodcastCollectionItems maps created and paid podcast radios', async () => {
  const calls = [];
  const deps = {
    djSublist: async () => { throw new Error('unexpected dj_sublist'); },
    userAudio: async opts => {
      calls.push(['user_audio', opts]);
      return {
        body: {
          data: [
            { id: 802, name: 'Created Radio', picUrl: 'https://img.example/created.jpg' },
          ],
        },
      };
    },
    djPaygift: async opts => {
      calls.push(['dj_paygift', opts]);
      return {
        body: {
          data: [
            { id: 803, name: 'Paid Radio', picUrl: 'https://img.example/paid.jpg' },
          ],
        },
      };
    },
    satiResourceSubList: async () => { throw new Error('unexpected sati'); },
    recordRecentVoice: async () => { throw new Error('unexpected recent'); },
    getUserCookie: () => 'MUSIC_U=test-user',
    firstArrayFrom,
    mapPodcastCollectionRadios,
    mapPodcastVoiceItems,
    now: () => 654,
    logger: { warn() {} },
  };

  const created = await fetchNeteasePodcastCollectionItems('created', { userId: 99 }, 30, 0, deps);
  const paid = await fetchNeteasePodcastCollectionItems('paid', { userId: 99 }, 120, 4, deps);

  assert.deepEqual(created.items.map(item => item.id), [802]);
  assert.deepEqual(paid.items.map(item => item.id), [803]);
  assert.equal(created.items[0].collectionKey, 'created');
  assert.equal(paid.items[0].collectionKey, 'paid');
  assert.deepEqual(calls, [
    ['user_audio', { uid: 99, cookie: 'MUSIC_U=test-user', timestamp: 654 }],
    ['dj_paygift', { limit: 60, offset: 4, cookie: 'MUSIC_U=test-user', timestamp: 654 }],
  ]);
});

test('fetchNeteasePodcastCollectionItems maps liked voices from sati source', async () => {
  const result = await fetchNeteasePodcastCollectionItems('liked', { userId: 99 }, 30, 0, {
    djSublist: async () => { throw new Error('unexpected dj_sublist'); },
    userAudio: async () => { throw new Error('unexpected user_audio'); },
    djPaygift: async () => { throw new Error('unexpected dj_paygift'); },
    satiResourceSubList: async opts => ({
      body: {
        data: [
          {
            resource: {
              id: 804,
              name: 'Liked Voice',
              coverUrl: 'https://img.example/liked.jpg',
              voiceList: { name: 'Liked Podcast' },
            },
          },
        ],
        opts,
      },
    }),
    recordRecentVoice: async () => { throw new Error('unexpected recent'); },
    getUserCookie: () => 'MUSIC_U=test-user',
    firstArrayFrom,
    mapPodcastCollectionRadios,
    mapPodcastVoiceItems,
    now: () => 987,
    logger: { warn() {} },
  });

  assert.equal(result.itemType, 'voice');
  assert.deepEqual(result.items.map(item => item.id), [804]);
});

test('fetchNeteasePodcastCollectionItems falls back to recent voices for liked podcasts', async () => {
  const warnings = [];
  const result = await fetchNeteasePodcastCollectionItems('liked', { userId: 99 }, 7, 0, {
    djSublist: async () => { throw new Error('unexpected dj_sublist'); },
    userAudio: async () => { throw new Error('unexpected user_audio'); },
    djPaygift: async () => { throw new Error('unexpected dj_paygift'); },
    satiResourceSubList: async () => { throw new Error('liked voices unavailable'); },
    recordRecentVoice: async opts => ({
      body: {
        data: [
          {
            id: 805,
            name: 'Recent Liked Voice',
            cover: 'https://img.example/recent.jpg',
            voiceList: { name: 'Recent Podcast' },
          },
        ],
        opts,
      },
    }),
    getUserCookie: () => 'MUSIC_U=test-user',
    firstArrayFrom,
    mapPodcastCollectionRadios,
    mapPodcastVoiceItems,
    now: () => 111,
    logger: { warn(...args) { warnings.push(args); } },
  });

  assert.equal(result.itemType, 'voice');
  assert.deepEqual(result.items.map(item => item.id), [805]);
  assert.deepEqual(warnings, [['[MyPodcastLiked] sati sub list failed:', 'liked voices unavailable']]);
});

test('fetchNeteasePodcastCollectionItems returns empty liked list when liked sources fail', async () => {
  const warnings = [];
  const result = await fetchNeteasePodcastCollectionItems('liked', { userId: 99 }, 7, 0, {
    djSublist: async () => { throw new Error('unexpected dj_sublist'); },
    userAudio: async () => { throw new Error('unexpected user_audio'); },
    djPaygift: async () => { throw new Error('unexpected dj_paygift'); },
    satiResourceSubList: async () => { throw new Error('sati offline'); },
    recordRecentVoice: async () => { throw new Error('recent offline'); },
    getUserCookie: () => 'MUSIC_U=test-user',
    firstArrayFrom,
    mapPodcastCollectionRadios,
    mapPodcastVoiceItems,
    now: () => 222,
    logger: { warn(...args) { warnings.push(args); } },
  });

  assert.deepEqual(result, { itemType: 'voice', items: [] });
  assert.deepEqual(warnings, [
    ['[MyPodcastLiked] sati sub list failed:', 'sati offline'],
    ['[MyPodcastLiked] recent voice fallback failed:', 'recent offline'],
  ]);
});

test('fetchNeteasePodcastCollectionItems returns empty radios for unknown collection keys', async () => {
  const result = await fetchNeteasePodcastCollectionItems('unknown', { userId: 99 }, 30, 0, {
    djSublist: async () => { throw new Error('unexpected dj_sublist'); },
    userAudio: async () => { throw new Error('unexpected user_audio'); },
    djPaygift: async () => { throw new Error('unexpected dj_paygift'); },
    satiResourceSubList: async () => { throw new Error('unexpected sati'); },
    recordRecentVoice: async () => { throw new Error('unexpected recent'); },
    getUserCookie: () => 'MUSIC_U=test-user',
    firstArrayFrom,
    mapPodcastCollectionRadios,
    mapPodcastVoiceItems,
    now: () => 333,
    logger: { warn() {} },
  });

  assert.deepEqual(result, { itemType: 'radio', items: [] });
});
