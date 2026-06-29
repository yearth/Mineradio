const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeVersion, compareVersions } = require('../lib/version-utils');

test('normalizeVersion removes v prefix and prerelease/build metadata', () => {
  assert.equal(normalizeVersion('v1.2.3'), '1.2.3');
  assert.equal(normalizeVersion('1.2.3-beta.1'), '1.2.3');
  assert.equal(normalizeVersion('1.2.3+20260630'), '1.2.3');
});

test('compareVersions compares numeric segments and treats missing segments as zero', () => {
  assert.equal(compareVersions('1.2.10', '1.2.9'), 1);
  assert.equal(compareVersions('1.2.0', '1.2'), 0);
  assert.equal(compareVersions('1.2.0', '1.2.1'), -1);
});

