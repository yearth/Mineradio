const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  beatCacheRootInfo,
  compactBeatMapCachePayload,
  readBeatMapCache,
  safeBeatMapCacheFile,
  writeBeatMapCache,
} = require('../server-dist/server/services/beatmap-cache');

test('beat cache root and file helpers preserve directory safety and stable filenames', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-beat-cache-service-'));
  const key = 'netease:track/123?quality=hires';

  const info = beatCacheRootInfo(tmp);
  assert.equal(info.dir, tmp);
  assert.equal(info.root, path.parse(tmp).root);
  assert.equal(info.allowed, true);
  assert.equal(info.available, true);

  const file = safeBeatMapCacheFile(key, tmp);
  assert.equal(path.dirname(file), tmp);
  assert.match(path.basename(file), /^netease_track_123_quality_hires-[a-f0-9]{40}\.json$/);
  assert.equal(safeBeatMapCacheFile('', tmp), null);
  assert.equal(safeBeatMapCacheFile('x'.repeat(241), tmp), null);
});

test('compactBeatMapCachePayload preserves metadata truncation and validation', () => {
  const map = { beats: [{ time: 0.5, strength: 0.7 }] };
  const payload = compactBeatMapCachePayload({
    key: 'song-key',
    provider: 'p'.repeat(40),
    title: 't'.repeat(200),
    artist: 'a'.repeat(200),
    mode: '',
    map,
    ignored: 'nope',
  });

  assert.equal(payload.v, 1);
  assert.equal(payload.key, 'song-key');
  assert.equal(typeof payload.savedAt, 'number');
  assert.equal(payload.meta.provider.length, 32);
  assert.equal(payload.meta.title.length, 160);
  assert.equal(payload.meta.artist.length, 160);
  assert.equal(payload.meta.mode, 'mr');
  assert.deepEqual(payload.map, map);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'ignored'), false);
  assert.equal(compactBeatMapCachePayload({ key: 'missing-map' }), null);
});

test('beat cache read and write preserve legacy success and invalid payload results', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-beat-cache-service-'));
  const key = 'qq:track/456';
  const map = { duration: 12, beats: [{ time: 1, strength: 0.5 }] };

  assert.equal(readBeatMapCache(key, tmp), null);
  const saved = writeBeatMapCache({ key, provider: 'qq', title: 'Song', artist: 'Artist', mode: 'dj', map }, tmp);

  assert.equal(saved.ok, true);
  assert.equal(saved.key, key);
  assert.equal(saved.dir, tmp);
  assert.equal(typeof saved.savedAt, 'number');

  const entry = readBeatMapCache(key, tmp);
  assert.equal(entry.key, key);
  assert.equal(entry.meta.provider, 'qq');
  assert.equal(entry.meta.mode, 'dj');
  assert.deepEqual(entry.map, map);

  assert.deepEqual(writeBeatMapCache({ key: 'missing-map' }, tmp), {
    ok: false,
    error: 'INVALID_BEATMAP_CACHE_PAYLOAD',
  });
  assert.deepEqual(writeBeatMapCache({ key: 'x'.repeat(241), map: { beats: [] } }, tmp), {
    ok: false,
    error: 'INVALID_BEATMAP_CACHE_KEY',
  });
});
