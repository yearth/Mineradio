const test = require('node:test');
const assert = require('node:assert/strict');

const {
  searchResultKey,
  readSearchHistory,
  rememberSearchQuery,
  formatProgramTime,
  podcastMetaText,
  programMetaText,
  searchIntentPrefersQQ,
  searchMentionsKnownArtist,
  searchLooksLikeDerivative,
  scoreSongSearchResult,
  mergeSongSearchResults,
} = require('../public/renderer/core/search-logic');
const { createMemoryStorage } = require('../public/renderer/core/preferences');

test('search history trims, dedupes case-insensitively, and caps at ten items', () => {
  const storage = createMemoryStorage({ 'mineradio-search-history': JSON.stringify(['Rain', '  ', 'Jazz']) });

  assert.deepEqual(readSearchHistory(storage), ['Rain', 'Jazz']);
  rememberSearchQuery(storage, 'rain');
  assert.deepEqual(readSearchHistory(storage), ['rain', 'Jazz']);

  for (let i = 0; i < 12; i += 1) {
    rememberSearchQuery(storage, 'song-' + i);
  }
  assert.equal(readSearchHistory(storage).length, 10);
  assert.equal(readSearchHistory(storage)[0], 'song-11');
  assert.deepEqual(readSearchHistory(createMemoryStorage({ 'mineradio-search-history': '{bad json' })), []);
  assert.doesNotThrow(() => rememberSearchQuery({ getItem() { return '[]'; }, setItem() { throw new Error('blocked'); } }, 'safe'));
});

test('search metadata helpers preserve labels and time formatting', () => {
  assert.equal(searchResultKey('  hello ', 'qq'), 'qq|hello');
  assert.equal(formatProgramTime(65), '1:05');
  assert.equal(formatProgramTime(3661), '1:01:01');
  assert.equal(podcastMetaText({ djName: 'DJ', programCount: 12, subCount: 15420 }), 'DJ  ·  12 episodes  ·  15k follows');
  assert.equal(programMetaText({ radioName: 'Radio', artist: 'Artist', djName: 'DJ', duration: 65000 }), 'Radio  ·  DJ  ·  1:05');
});

test('search intent and derivative detection keep current ranking heuristics', () => {
  assert.equal(searchIntentPrefersQQ('周杰伦 晴天'), true);
  assert.equal(searchIntentPrefersQQ('lofi rain'), false);
  assert.equal(searchMentionsKnownArtist('jay chou mojito', '周杰伦'), true);
  assert.equal(searchMentionsKnownArtist('梁博 日落大道', '梁博'), true);
  assert.equal(searchLooksLikeDerivative('晴天 cover remix'), true);
  assert.equal(searchLooksLikeDerivative('晴天 官方版'), false);
});

test('mergeSongSearchResults dedupes by provider key and ranks original artist above covers', () => {
  const netease = [
    { id: 1, name: '日落大道', artist: '某翻唱歌手', album: '日落大道 cover' },
    { id: 2, name: '日落大道', artist: '梁博', album: '迷藏' },
  ];
  const qq = [
    { provider: 'qq', mid: 'm1', name: '日落大道', artist: '梁博', album: '我是唱作人' },
    { provider: 'qq', mid: 'm1', name: '日落大道', artist: '梁博', album: 'duplicate' },
  ];

  const merged = mergeSongSearchResults(netease, qq, 3, '梁博 日落大道');

  assert.equal(merged.length, 3);
  assert.equal(merged[0].artist, '梁博');
  assert.equal(merged.filter(song => song.provider === 'qq').length, 1);
  assert.ok(scoreSongSearchResult({ name: '晴天', artist: '周杰伦' }, '周杰伦 晴天', 0) > 100);
});
