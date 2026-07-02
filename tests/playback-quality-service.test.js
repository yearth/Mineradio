const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NETEASE_QUALITY_CANDIDATES,
  QQ_QUALITY_CANDIDATE_TEMPLATES,
  hasNeteaseSvip,
  normalizeQualityPreference,
  qualityCandidatesFrom,
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
