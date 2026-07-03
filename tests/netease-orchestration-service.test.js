const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDiscoverHome,
  fetchNeteaseArtistDetail,
  fetchNeteaseLyric,
  fetchNeteasePlaylistTracks,
  fetchNeteaseSongComments,
  fetchNeteaseSongUrl,
  fetchNeteasePodcastCollectionItems,
  searchNeteaseSongs,
} = require('../server-dist/server/services/netease-orchestration');
const {
  firstArrayFrom,
  buildNeteaseSongCommentsPayload,
  isLowSignalPodcastItem,
  mapDiscoverPlaylist,
  mapPodcastCollectionRadios,
  mapPodcastRadio,
  mapPodcastVoiceItems,
  mapSongRecord,
} = require('../server-dist/server/services/music-mapper');
const {
  NETEASE_QUALITY_CANDIDATES,
  normalizeQualityPreference,
  qualityCandidatesFrom,
  hasNeteaseSvip,
} = require('../server-dist/server/services/playback-quality');
const {
  classifyNeteasePlaybackRestriction,
} = require('../server-dist/server/services/playback-restriction');

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

test('fetchNeteaseSongUrl returns the first full playable URL', async () => {
  const calls = [];
  const logs = [];
  const result = await fetchNeteaseSongUrl('101', { loggedIn: false }, 'exhigh', {
    getUserCookie: () => '',
    songUrlV1: async opts => {
      calls.push(['song_url_v1', opts]);
      return { body: { data: [{ id: opts.id, url: 'https://audio.example/full.mp3', br: 320000, code: 200 }] } };
    },
    songUrl: async opts => {
      calls.push(['song_url', opts]);
      return { body: { data: [] } };
    },
    normalizeQualityPreference,
    hasNeteaseSvip,
    qualityCandidatesFrom,
    qualityCandidates: NETEASE_QUALITY_CANDIDATES,
    classifyNeteasePlaybackRestriction,
    logger: { log(...args) { logs.push(args); } },
  });

  assert.deepEqual(result, {
    url: 'https://audio.example/full.mp3',
    trial: false,
    playable: true,
    level: 'exhigh',
    quality: '极高',
    br: 320000,
    requestedQuality: 'exhigh',
  });
  assert.deepEqual(calls, [
    ['song_url_v1', { id: '101', level: 'exhigh', cookie: '' }],
  ]);
  assert.deepEqual(logs, [
    ['[SongUrl] id:', '101', 'logged-in:', false],
    ['[SongUrl]', 'exhigh', '->', 'OK', ''],
  ]);
});

test('fetchNeteaseSongUrl falls back to legacy URL lookup when v1 fails', async () => {
  const calls = [];
  const logs = [];
  const result = await fetchNeteaseSongUrl('102', { loggedIn: false }, 'exhigh', {
    getUserCookie: () => '',
    songUrlV1: async opts => {
      calls.push(['song_url_v1', opts]);
      throw new Error('v1 unavailable');
    },
    songUrl: async opts => {
      calls.push(['song_url', opts]);
      return { body: { data: [{ id: opts.id, url: 'https://audio.example/legacy.mp3', br: opts.br, code: 200 }] } };
    },
    normalizeQualityPreference,
    hasNeteaseSvip,
    qualityCandidatesFrom,
    qualityCandidates: NETEASE_QUALITY_CANDIDATES,
    classifyNeteasePlaybackRestriction,
    logger: { log(...args) { logs.push(args); } },
  });

  assert.equal(result.url, 'https://audio.example/legacy.mp3');
  assert.equal(result.level, 'exhigh');
  assert.equal(result.br, 999000);
  assert.deepEqual(calls, [
    ['song_url_v1', { id: '102', level: 'exhigh', cookie: '' }],
    ['song_url', { id: '102', br: 999000, cookie: '' }],
  ]);
  assert.deepEqual(logs, [
    ['[SongUrl] id:', '102', 'logged-in:', false],
    ['[SongUrl]', 'exhigh', '->', 'OK', ''],
  ]);
});

test('fetchNeteaseSongUrl returns trial fallback before unavailable restrictions', async () => {
  const result = await fetchNeteaseSongUrl('103', { loggedIn: true }, 'standard', {
    getUserCookie: () => 'MUSIC_U=test-user',
    songUrlV1: async opts => ({
      body: {
        data: [{
          id: opts.id,
          url: 'https://audio.example/trial.mp3',
          br: 128000,
          code: 200,
          fee: 1,
          freeTrialInfo: { start: 0, end: 30 },
        }],
      },
    }),
    songUrl: async () => ({ body: { data: [] } }),
    normalizeQualityPreference,
    hasNeteaseSvip,
    qualityCandidatesFrom,
    qualityCandidates: NETEASE_QUALITY_CANDIDATES,
    classifyNeteasePlaybackRestriction,
    logger: { log() {} },
  });

  assert.equal(result.url, 'https://audio.example/trial.mp3');
  assert.equal(result.trial, true);
  assert.equal(result.playable, true);
  assert.equal(result.restriction.category, 'trial_only');
  assert.deepEqual(result.trialInfo, { start: 0, end: 30 });
});

test('fetchNeteaseSongUrl reports last provider error and restriction metadata when no URL is playable', async () => {
  const result = await fetchNeteaseSongUrl('104', { loggedIn: false }, 'standard', {
    getUserCookie: () => '',
    songUrlV1: async () => { throw new Error('v1 unavailable'); },
    songUrl: async () => { throw new Error('legacy unavailable'); },
    normalizeQualityPreference,
    hasNeteaseSvip,
    qualityCandidatesFrom,
    qualityCandidates: NETEASE_QUALITY_CANDIDATES,
    classifyNeteasePlaybackRestriction,
    logger: { log() {} },
  });

  assert.equal(result.url, null);
  assert.equal(result.playable, false);
  assert.equal(result.reason, 'login_required');
  assert.equal(result.error, 'legacy unavailable');
  assert.equal(result.lastCode, null);
  assert.equal(result.fee, null);
  assert.equal(result.requestedQuality, 'standard');
});

test('fetchNeteaseLyric returns lyric_new payload when modern timed lyrics exist', async () => {
  const calls = [];
  const result = await fetchNeteaseLyric('201', {
    getUserCookie: () => 'MUSIC_U=test-user',
    lyricNew: async opts => {
      calls.push(['lyric_new', opts]);
      return { body: { lrc: { lyric: '[00:01]new' }, tlyric: { lyric: '[00:01]trans' }, yrc: { lyric: '[00:01]yrc' } } };
    },
    lyric: async opts => {
      calls.push(['lyric', opts]);
      return { body: { lrc: { lyric: 'legacy should not run' } } };
    },
    now: () => 456,
    logger: { warn() {} },
  });

  assert.deepEqual(result, {
    lyric: '[00:01]new',
    tlyric: '[00:01]trans',
    yrc: '[00:01]yrc',
    source: 'lyric_new',
  });
  assert.deepEqual(calls, [
    ['lyric_new', { id: '201', cookie: 'MUSIC_U=test-user', timestamp: 456 }],
  ]);
});

test('fetchNeteaseLyric falls back to legacy lyric when lyric_new is empty', async () => {
  const calls = [];
  const result = await fetchNeteaseLyric('202', {
    getUserCookie: () => 'MUSIC_U=test-user',
    lyricNew: async opts => {
      calls.push(['lyric_new', opts]);
      return { body: {} };
    },
    lyric: async opts => {
      calls.push(['lyric', opts]);
      return { body: { lrc: { lyric: '[00:02]legacy' } } };
    },
    now: () => 789,
    logger: { warn() {} },
  });

  assert.deepEqual(result, {
    lyric: '[00:02]legacy',
    tlyric: '',
    yrc: '',
    source: 'lyric',
  });
  assert.deepEqual(calls, [
    ['lyric_new', { id: '202', cookie: 'MUSIC_U=test-user', timestamp: 789 }],
    ['lyric', { id: '202', cookie: 'MUSIC_U=test-user', timestamp: 789 }],
  ]);
});

test('fetchNeteaseLyric warns and falls back when lyric_new throws', async () => {
  const warnings = [];
  const result = await fetchNeteaseLyric('203', {
    getUserCookie: () => 'MUSIC_U=test-user',
    lyricNew: async () => { throw new Error('new failed'); },
    lyric: async opts => ({ body: { lrc: { lyric: '[00:03]legacy after warn' } } }),
    now: () => 999,
    logger: { warn(...args) { warnings.push(args); } },
  });

  assert.equal(result.lyric, '[00:03]legacy after warn');
  assert.equal(result.source, 'lyric');
  assert.deepEqual(warnings, [['[LyricNew]', 'new failed']]);
});

test('fetchNeteaseSongComments maps comments payload with clamped upstream options', async () => {
  const calls = [];
  const result = await fetchNeteaseSongComments('301', 6, 12, {
    getUserCookie: () => 'MUSIC_U=test-user',
    commentMusic: async opts => {
      calls.push(opts);
      return {
        body: {
          comments: [
            { commentId: 1, content: 'regular', likedCount: 2, time: 1700000000000, user: { nickname: 'Fan' } },
          ],
          total: 1,
        },
      };
    },
    buildNeteaseSongCommentsPayload,
    now: () => 111,
  });

  assert.equal(result.id, '301');
  assert.equal(result.total, 1);
  assert.equal(result.hot, false);
  assert.equal(result.comments[0].content, 'regular');
  assert.deepEqual(calls, [
    { id: '301', limit: 6, offset: 12, cookie: 'MUSIC_U=test-user', timestamp: 111 },
  ]);
});

test('fetchNeteaseArtistDetail maps artist metadata and falls back to top songs', async () => {
  const warnings = [];
  const result = await fetchNeteaseArtistDetail('401', 500, {
    getUserCookie: () => 'MUSIC_U=test-user',
    artistDetail: async opts => ({
      body: {
        artist: {
          id: 401,
          name: 'Artist',
          picUrl: 'artist.jpg',
          briefDesc: 'bio',
          musicSize: 9,
          albumSize: 3,
        },
      },
    }),
    artistSongs: async opts => {
      assert.equal(opts.limit, 80);
      return { body: { songs: [] } };
    },
    artistTopSong: async opts => ({
      body: { songs: [{ id: 91, name: 'Top Song', ar: [{ id: 7, name: 'Singer' }], al: {} }] },
    }),
    mapSongRecord,
    now: () => 222,
    logger: { warn(...args) { warnings.push(args); } },
  });

  assert.equal(result.id, '401');
  assert.equal(result.artist.name, 'Artist');
  assert.equal(result.artist.avatar, 'artist.jpg');
  assert.deepEqual(result.songs.map(song => song.id), [91]);
  assert.deepEqual(warnings, []);
});

test('fetchNeteaseArtistDetail warns on detail and hot song failures before top-song fallback', async () => {
  const warnings = [];
  const result = await fetchNeteaseArtistDetail('402', 30, {
    getUserCookie: () => 'MUSIC_U=test-user',
    artistDetail: async () => { throw new Error('detail failed'); },
    artistSongs: async () => { throw new Error('hot failed'); },
    artistTopSong: async () => ({ body: { songs: [{ id: 92, name: 'Top Fallback', ar: [], al: {} }] } }),
    mapSongRecord,
    now: () => 333,
    logger: { warn(...args) { warnings.push(args); } },
  });

  assert.equal(result.artist.id, '402');
  assert.deepEqual(result.songs.map(song => song.id), [92]);
  assert.deepEqual(warnings, [
    ['[ArtistDetail] detail failed:', 'detail failed'],
    ['[ArtistSongs] hot failed:', 'hot failed'],
  ]);
});

test('fetchNeteasePlaylistTracks uses playlist_track_all before detail fallback', async () => {
  const calls = [];
  const result = await fetchNeteasePlaylistTracks('501', {
    getUserCookie: () => 'MUSIC_U=test-user',
    playlistTrackAll: async opts => {
      calls.push(['all', opts]);
      return { body: { songs: [{ id: 11, name: 'Track', ar: [], al: {} }] } };
    },
    playlistDetail: async opts => {
      calls.push(['detail', opts]);
      return { body: { playlist: { tracks: [] } } };
    },
    mapSongRecord,
    now: () => 444,
    logger: { warn() {} },
  });

  assert.deepEqual(result.playlist, { id: '501', name: '', cover: '', trackCount: 1 });
  assert.deepEqual(result.tracks.map(track => track.id), [11]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'all');
});

test('fetchNeteasePlaylistTracks falls back to playlist detail when full track lookup fails', async () => {
  const warnings = [];
  const result = await fetchNeteasePlaylistTracks('502', {
    getUserCookie: () => 'MUSIC_U=test-user',
    playlistTrackAll: async () => { throw new Error('all failed'); },
    playlistDetail: async opts => ({
      body: {
        playlist: {
          id: 502,
          name: 'List',
          coverImgUrl: 'cover.jpg',
          trackCount: 2,
          tracks: [{ id: 12, name: 'Fallback Track', ar: [], al: {} }],
        },
      },
    }),
    mapSongRecord,
    now: () => 555,
    logger: { warn(...args) { warnings.push(args); } },
  });

  assert.deepEqual(result.playlist, { id: 502, name: 'List', cover: 'cover.jpg', trackCount: 2 });
  assert.deepEqual(result.tracks.map(track => track.id), [12]);
  assert.deepEqual(warnings, [['[PlaylistTracks] playlist_track_all failed, fallback to detail:', 'all failed']]);
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
