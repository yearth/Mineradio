const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NETEASE_QUALITY_CANDIDATES,
  QQ_QUALITY_CANDIDATE_TEMPLATES,
  hasNeteaseSvip,
  normalizeQualityPreference,
  qualityCandidatesFrom,
  qqVkeyFileCandidates,
} = require('../server-dist/server/services/playback-quality');

test('normalizeQualityPreference preserves legacy aliases and default', () => {
  assert.equal(normalizeQualityPreference(' master '), 'jymaster');
  assert.equal(normalizeQualityPreference('Hi-Res'), 'hires');
  assert.equal(normalizeQualityPreference('SQ'), 'lossless');
  assert.equal(normalizeQualityPreference('320k'), 'exhigh');
  assert.equal(normalizeQualityPreference('std'), 'standard');
  assert.equal(normalizeQualityPreference('unknown'), 'hires');
  assert.equal(normalizeQualityPreference(null), 'hires');
});

test('qualityCandidatesFrom preserves ordered fallback behavior', () => {
  assert.deepEqual(qualityCandidatesFrom('lossless', NETEASE_QUALITY_CANDIDATES).map(item => item.level), [
    'lossless',
    'exhigh',
    'standard',
  ]);
  assert.deepEqual(qualityCandidatesFrom('exhigh', QQ_QUALITY_CANDIDATE_TEMPLATES).map(item => item.level), [
    'exhigh',
    'standard',
    'aac',
  ]);
  assert.deepEqual(qualityCandidatesFrom('missing', [{ level: 'only' }]), [{ level: 'only' }]);
});

test('hasNeteaseSvip preserves logged-in SVIP detection rules', () => {
  assert.equal(hasNeteaseSvip({ loggedIn: true, vipLevel: 'svip' }), true);
  assert.equal(hasNeteaseSvip({ loggedIn: true, isSvip: true }), true);
  assert.equal(hasNeteaseSvip({ loggedIn: true, vipType: 10 }), true);
  assert.equal(hasNeteaseSvip({ loggedIn: true, vipType: 9 }), false);
  assert.equal(hasNeteaseSvip({ loggedIn: false, vipLevel: 'svip' }), false);
  assert.equal(hasNeteaseSvip(null), false);
});

test('qqVkeyFileCandidates preserves media id ordering, dedupe, and filename expansion', () => {
  assert.deepEqual(qqVkeyFileCandidates('songmid', 'mediamid', 'lossless'), {
    requestedQuality: 'lossless',
    fileCandidates: [
      { prefix: 'F000', ext: '.flac', level: 'lossless', label: '无损 FLAC', mediaId: 'mediamid', filename: 'F000mediamid.flac' },
      { prefix: 'M800', ext: '.mp3', level: 'exhigh', label: '320k MP3', mediaId: 'mediamid', filename: 'M800mediamid.mp3' },
      { prefix: 'M500', ext: '.mp3', level: 'standard', label: '128k MP3', mediaId: 'mediamid', filename: 'M500mediamid.mp3' },
      { prefix: 'C400', ext: '.m4a', level: 'aac', label: 'AAC/M4A', mediaId: 'mediamid', filename: 'C400mediamid.m4a' },
      { prefix: 'F000', ext: '.flac', level: 'lossless', label: '无损 FLAC', mediaId: 'songmid', filename: 'F000songmid.flac' },
      { prefix: 'M800', ext: '.mp3', level: 'exhigh', label: '320k MP3', mediaId: 'songmid', filename: 'M800songmid.mp3' },
      { prefix: 'M500', ext: '.mp3', level: 'standard', label: '128k MP3', mediaId: 'songmid', filename: 'M500songmid.mp3' },
      { prefix: 'C400', ext: '.m4a', level: 'aac', label: 'AAC/M4A', mediaId: 'songmid', filename: 'C400songmid.m4a' },
    ],
    filenames: [
      'F000mediamid.flac',
      'M800mediamid.mp3',
      'M500mediamid.mp3',
      'C400mediamid.m4a',
      'F000songmid.flac',
      'M800songmid.mp3',
      'M500songmid.mp3',
      'C400songmid.m4a',
    ],
  });

  const duplicate = qqVkeyFileCandidates('same-mid', 'same-mid', '320k');
  assert.equal(duplicate.requestedQuality, 'exhigh');
  assert.deepEqual(duplicate.fileCandidates.map(item => item.mediaId), ['same-mid', 'same-mid', 'same-mid']);
  assert.deepEqual(duplicate.filenames, ['M800same-mid.mp3', 'M500same-mid.mp3', 'C400same-mid.m4a']);
});
