const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createMemoryStorage,
  readSavedVolume,
  readBooleanPreference,
  saveBooleanPreference,
  normalizePlaybackQuality,
  playbackQualityLabel,
  playbackQualityShortLabel,
  playbackQualityRank,
  playbackQualityWasDowngraded,
  playbackBitrateLabel,
  playbackResolvedQualityText,
  readPlaybackQualityPreference,
} = require('../public/renderer/core/preferences');

test('renderer preferences clamp volume and survive storage failures', () => {
  const storage = createMemoryStorage({ 'apex-player-volume': '1.8' });
  assert.equal(readSavedVolume(storage), 1);

  storage.setItem('apex-player-volume', '-0.2');
  assert.equal(readSavedVolume(storage), 0);

  storage.setItem('apex-player-volume', 'nope');
  assert.equal(readSavedVolume(storage), 1);

  assert.equal(readSavedVolume({ getItem() { throw new Error('blocked'); } }), 1);
});

test('memory storage exposes removable and copyable test state', () => {
  const storage = createMemoryStorage({ a: 1, b: 'two' });

  assert.deepEqual(storage.dump(), { a: 1, b: 'two' });
  storage.removeItem('a');
  assert.equal(storage.getItem('a'), null);
  assert.deepEqual(storage.dump(), { b: 'two' });
});

test('renderer boolean preferences preserve legacy 1/0 storage semantics', () => {
  const storage = createMemoryStorage();

  assert.equal(readBooleanPreference(storage, 'missing', true), true);
  assert.equal(readBooleanPreference(storage, 'missing', false), false);

  saveBooleanPreference(storage, 'feature', true);
  assert.equal(storage.getItem('feature'), '1');
  assert.equal(readBooleanPreference(storage, 'feature', false), true);

  saveBooleanPreference(storage, 'feature', false);
  assert.equal(storage.getItem('feature'), '0');
  assert.equal(readBooleanPreference(storage, 'feature', true), false);

  assert.doesNotThrow(() => saveBooleanPreference({ setItem() { throw new Error('blocked'); } }, 'x', true));
  assert.equal(readBooleanPreference({ getItem() { throw new Error('blocked'); } }, 'x', true), true);
});

test('playback quality helpers preserve labels, aliases, rank, and bitrate text', () => {
  assert.equal(normalizePlaybackQuality('master'), 'jymaster');
  assert.equal(normalizePlaybackQuality('hi-res'), 'hires');
  assert.equal(normalizePlaybackQuality('flac'), 'lossless');
  assert.equal(normalizePlaybackQuality('320k'), 'exhigh');
  assert.equal(normalizePlaybackQuality('std'), 'standard');
  assert.equal(normalizePlaybackQuality('unknown'), 'hires');

  assert.equal(playbackQualityLabel('jymaster'), '超清母带');
  assert.equal(playbackQualityShortLabel('lossless'), 'SQ');
  assert.equal(playbackQualityRank('standard'), 1);
  assert.equal(playbackQualityWasDowngraded('jymaster', 'lossless'), true);
  assert.equal(playbackQualityWasDowngraded('exhigh', 'hires'), false);
  assert.equal(playbackBitrateLabel(320000), '320 kbps');
  assert.equal(playbackBitrateLabel(1411000), '1.41 Mbps');
  assert.equal(playbackResolvedQualityText({ level: 'lossless', br: 1411000 }, 'hires'), '无损 · 1.41 Mbps');
});

test('playback quality preference normalizes stored values and falls back safely', () => {
  assert.equal(readPlaybackQualityPreference(createMemoryStorage({ 'mineradio-playback-quality-v1': 'sq' })), 'lossless');
  assert.equal(readPlaybackQualityPreference(createMemoryStorage()), 'hires');
  assert.equal(readPlaybackQualityPreference({ getItem() { throw new Error('blocked'); } }), 'hires');
});
