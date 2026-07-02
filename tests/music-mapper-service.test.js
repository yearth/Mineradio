const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isLowSignalPodcastItem,
  isQQFavoritePlaylist,
  isQzoneBackgroundPlaylist,
  firstArrayFrom,
  lowSignalText,
  mapArtists,
  mapDiscoverPlaylist,
  mapPodcastCollectionRadio,
  mapPodcastProgram,
  mapPodcastRadio,
  mapPodcastVoice,
  mapQQArtists,
  mapQQPlaylistTrack,
  mapQQSmartSong,
  mapQQTrack,
  mapSongRecord,
  podcastCollectionMeta,
  qqAlbumCover,
} = require('../server-dist/server/services/music-mapper');

test('mapSongRecord preserves Netease song shape and artist filtering', () => {
  assert.deepEqual(mapArtists([{ id: 1, name: 'A' }, { id: 2 }, null, { id: 3, name: 'B' }]), [
    { id: 1, name: 'A' },
    { id: 3, name: 'B' },
  ]);

  assert.deepEqual(mapSongRecord({
    id: 101,
    name: 'Rain',
    ar: [{ id: 11, name: 'Singer A' }, { id: 12, name: 'Singer B' }],
    al: { name: 'Album A', picUrl: 'https://img.example/a.jpg' },
    dt: 188000,
    fee: 1,
  }), {
    provider: 'netease',
    source: 'netease',
    type: 'song',
    id: 101,
    name: 'Rain',
    artist: 'Singer A / Singer B',
    artists: [{ id: 11, name: 'Singer A' }, { id: 12, name: 'Singer B' }],
    artistId: 11,
    album: 'Album A',
    cover: 'https://img.example/a.jpg',
    duration: 188000,
    fee: 1,
  });

  assert.equal(mapSongRecord({ album: { coverUrl: 'https://img.example/fallback.jpg' }, duration: 123 }).cover, 'https://img.example/fallback.jpg');
});

test('mapDiscoverPlaylist and mapPodcastRadio preserve list item mapping', () => {
  assert.deepEqual(mapDiscoverPlaylist({
    resourceId: 'pl001',
    title: 'Daily Mix',
    coverImgUrl: 'https://img.example/cover.jpg',
    songCount: 12,
    playcount: 99,
    user: { name: 'Curator' },
    alg: 'daily',
  }, '推荐歌单'), {
    provider: 'netease',
    source: 'netease',
    type: 'playlist',
    id: 'pl001',
    name: 'Daily Mix',
    cover: 'https://img.example/cover.jpg',
    trackCount: 12,
    playCount: 99,
    creator: 'Curator',
    tag: '推荐歌单',
  });

  assert.deepEqual(mapPodcastRadio({
    radioId: 'radio001',
    radioName: 'Night Radio',
    picURL: 'https://img.example/radio.jpg',
    description: 'Late sounds',
    djSimple: { nickname: 'DJ One' },
    categoryName: 'Music',
    programCnt: 8,
    subscriberCount: 100,
  }), {
    id: 'radio001',
    rid: 'radio001',
    name: 'Night Radio',
    cover: 'https://img.example/radio.jpg',
    desc: 'Late sounds',
    djName: 'DJ One',
    category: 'Music',
    programCount: 8,
    subCount: 100,
  });
});

test('low signal and QQ playlist predicates preserve filtering rules', () => {
  assert.equal(lowSignalText('  QZone 背景音乐  '), 'qzone 背景音乐');
  assert.equal(isLowSignalPodcastItem({ name: '付费精品', category: '播客' }), true);
  assert.equal(isLowSignalPodcastItem({ radioName: 'City Pop', desc: 'night drive' }), false);
  assert.equal(isQQFavoritePlaylist({ name: '我喜欢的音乐' }), true);
  assert.equal(isQQFavoritePlaylist({ name: 'Road Trip' }), false);
  assert.equal(isQzoneBackgroundPlaylist({ name: '空间背景音乐', creator: 'QQ' }), true);
  assert.equal(isQzoneBackgroundPlaylist({ name: 'Daily Mix', creator: 'QQ 音乐' }), false);
});

test('podcast program and voice mappers preserve legacy playable item fallbacks', () => {
  assert.deepEqual(mapPodcastProgram({
    id: 'program001',
    mainSong: {
      id: 901,
      name: 'Episode Track',
      ar: [{ id: 7, name: 'Host A' }],
      al: { name: 'Track Album', picUrl: 'https://img.example/track.jpg' },
      dt: 188000,
      fee: 0,
    },
    radio: {
      id: 'radio001',
      name: 'Night Podcast',
      dj: { nickname: 'DJ One' },
      picUrl: 'https://img.example/radio.jpg',
    },
    desc: 'Episode desc',
    serial: 4,
  }), {
    type: 'podcast',
    source: 'podcast',
    id: 901,
    programId: 'program001',
    radioId: 'radio001',
    name: 'Episode Track',
    artist: 'Night Podcast',
    artists: [{ id: 7, name: 'Host A' }],
    artistId: 7,
    album: 'Night Podcast',
    cover: 'https://img.example/radio.jpg',
    duration: 188000,
    fee: 0,
    djName: 'DJ One',
    radioName: 'Night Podcast',
    desc: 'Episode desc',
    createTime: 0,
    serialNum: 4,
  });

  assert.deepEqual(mapPodcastVoice({
    resource: {
      voiceId: 'voice001',
      trackId: 902,
      title: 'Voice Title',
      durationMs: 90000,
      podcastName: 'Voice Podcast',
      coverImgUrl: 'https://img.example/voice.jpg',
      voiceList: { voiceListId: 'vl001', voiceListName: 'Voice List', dj: { nickname: 'Voice DJ' } },
      description: 'Voice desc',
    },
  }), {
    type: 'podcast',
    source: 'podcast',
    sourceType: 'podcast-voice',
    id: 902,
    programId: 'voice001',
    radioId: 'vl001',
    name: 'Voice Title',
    artist: 'Voice List',
    album: 'Voice Podcast',
    cover: 'https://img.example/voice.jpg',
    duration: 90000,
    djName: 'Voice DJ',
    radioName: 'Voice Podcast',
    desc: 'Voice desc',
  });
});

test('podcast collection helpers preserve array extraction and summary metadata', () => {
  assert.deepEqual(firstArrayFrom({ data: { list: [{ id: 1 }] } }, ['missing', 'data']), [{ id: 1 }]);
  assert.deepEqual(firstArrayFrom({ data: { resources: [{ id: 2 }] } }, ['data']), [{ id: 2 }]);
  assert.deepEqual(firstArrayFrom(null, ['data']), []);

  assert.deepEqual(mapPodcastCollectionRadio({
    radioId: 'radio002',
    radioName: 'Collected Radio',
    categoryName: 'Talk',
    djName: 'Collector',
  }, 'collect'), {
    id: 'radio002',
    rid: 'radio002',
    name: 'Collected Radio',
    cover: '',
    desc: '',
    djName: 'Collector',
    category: 'Talk',
    programCount: 0,
    subCount: 0,
    type: 'podcast-radio',
    sourceType: 'podcast-radio',
    collectionKey: 'collect',
    radioId: 'radio002',
    artist: 'Collector',
    album: 'Talk',
  });

  assert.deepEqual(podcastCollectionMeta('liked', [{ cover: 'https://img.example/liked.jpg' }]), {
    key: 'liked',
    title: '喜欢的声音',
    sub: '收藏或最近喜欢的声音',
    itemType: 'voice',
    count: 1,
    cover: 'https://img.example/liked.jpg',
  });
  assert.deepEqual(podcastCollectionMeta('custom', [{ picUrl: 'https://img.example/custom.jpg' }]), {
    key: 'custom',
    title: 'custom',
    sub: '',
    itemType: 'radio',
    count: 1,
    cover: 'https://img.example/custom.jpg',
  });
});

test('QQ artist and album helpers preserve legacy URL and filtering behavior', () => {
  assert.deepEqual(mapQQArtists([{ id: 1, mid: 'm1', title: 'Title Name' }, {}, { id: 2, name: 'Named' }]), [
    { id: 1, mid: 'm1', name: 'Title Name' },
    { id: 2, mid: undefined, name: 'Named' },
  ]);
  assert.equal(qqAlbumCover('', 300), '');
  assert.equal(qqAlbumCover('album001'), 'https://y.qq.com/music/photo_new/T002R300x300M000album001.jpg?max_age=2592000');
  assert.equal(qqAlbumCover('album001', 500), 'https://y.qq.com/music/photo_new/T002R500x500M000album001.jpg?max_age=2592000');
});

test('mapQQSmartSong preserves smartbox fallback song shape', () => {
  assert.deepEqual(mapQQSmartSong({ id: 'doc001', mid: 'mid001', name: 'QQ Rain', singer: 'QQ Artist' }), {
    provider: 'qq',
    source: 'qq',
    type: 'qq',
    id: 'mid001',
    qqId: 'doc001',
    mid: 'mid001',
    songmid: 'mid001',
    name: 'QQ Rain',
    artist: 'QQ Artist',
    artists: [{ name: 'QQ Artist' }],
    album: '',
    cover: '',
    duration: 0,
    fee: 0,
    playable: false,
  });
});

test('mapQQTrack preserves detailed QQ track mapping and fallback fields', () => {
  assert.deepEqual(mapQQTrack({
    id: 12001,
    mid: 'qqmid001',
    title: 'QQ Detail',
    singer: [{ id: 66, mid: 'singer001', name: 'QQ Artist' }],
    album: { pmid: 'album001', title: 'QQ Album' },
    interval: 188,
    file: { media_mid: 'media001' },
    pay: { pay_play: 1 },
  }, { id: 'fallback-id', name: 'Fallback', artist: 'Fallback Artist', cover: 'https://img.example/fallback.jpg' }), {
    provider: 'qq',
    source: 'qq',
    type: 'qq',
    id: 'qqmid001',
    qqId: 12001,
    mid: 'qqmid001',
    songmid: 'qqmid001',
    mediaMid: 'media001',
    name: 'QQ Detail',
    artist: 'QQ Artist',
    artists: [{ id: 66, mid: 'singer001', name: 'QQ Artist' }],
    artistId: 66,
    artistMid: 'singer001',
    album: 'QQ Album',
    albumMid: 'album001',
    cover: 'https://y.qq.com/music/photo_new/T002R300x300M000album001.jpg?max_age=2592000',
    duration: 188000,
    fee: 1,
    playable: false,
  });

  assert.equal(mapQQTrack({}, { songmid: 'fallback-mid', cover: 'https://img.example/fallback.jpg' }).cover, 'https://img.example/fallback.jpg');
});

test('mapQQPlaylistTrack preserves raw and nested playlist track mapping', () => {
  assert.deepEqual(mapQQPlaylistTrack({
    track_info: {
      songid: 22001,
      songmid: 'trackmid001',
      songname: 'QQ Track',
      singername: 'Plain Artist',
      albumname: 'Plain Album',
      albummid: 'albummid001',
      strMediaMid: 'media-track-001',
      interval: 201,
    },
  }), {
    provider: 'qq',
    source: 'qq',
    type: 'qq',
    id: 'trackmid001',
    qqId: 22001,
    mid: 'trackmid001',
    songmid: 'trackmid001',
    mediaMid: 'media-track-001',
    name: 'QQ Track',
    artist: 'Plain Artist',
    artists: [],
    artistId: undefined,
    artistMid: undefined,
    album: 'Plain Album',
    albumMid: 'albummid001',
    cover: 'https://y.qq.com/music/photo_new/T002R300x300M000albummid001.jpg?max_age=2592000',
    duration: 201000,
    fee: 0,
    playable: false,
  });
});
