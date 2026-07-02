const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildServerTestRuntime,
  serverTestRuntimeGroups,
  serverTestRuntimeExportNames,
} = require('../server-dist/server/test-support/runtime');

const root = path.join(__dirname, '..');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

test('server test runtime documents the legacy __test surface by owner', () => {
  assert.deepEqual(serverTestRuntimeGroups.music, [
    'setNeteaseApi',
    'setRequestText',
    'resetMusicRuntime',
  ]);
  assert.deepEqual(serverTestRuntimeGroups.update, [
    'setUpdatePlatform',
    'setUpdateManifest',
    'setUpdateAutoDownload',
    'setUpdateAutoPatch',
    'resetUpdateRuntime',
  ]);
  assert.deepEqual(serverTestRuntimeGroups.helpers, [
    'normalizeCookieHeader',
    'rawCookieFallback',
    'parseGitHubRepository',
    'readUpdateConfig',
    'requestText',
    'moveInvalidUpdateFile',
    'buildWeatherMood',
  ]);
});

test('server test runtime export names are unique and complete', () => {
  const groupedNames = Object.values(serverTestRuntimeGroups).flat();
  assert.deepEqual(new Set(serverTestRuntimeExportNames), new Set(groupedNames));
  assert.equal(new Set(serverTestRuntimeExportNames).size, serverTestRuntimeExportNames.length);
  assert.equal(serverTestRuntimeExportNames.length, 15);
  assert.match(serverSource, /module\.exports\.__test = buildServerTestRuntime\(/);
});

test('buildServerTestRuntime preserves the legacy export order and delegates hooks', () => {
  const calls = [];
  const runtime = buildServerTestRuntime({
    setNeteaseApi: value => calls.push(['setNeteaseApi', value]),
    setRequestText: value => calls.push(['setRequestText', value]),
    helpers: {
      normalizeCookieHeader: 'normalizeCookieHeader',
      rawCookieFallback: 'rawCookieFallback',
      parseGitHubRepository: 'parseGitHubRepository',
      readUpdateConfig: 'readUpdateConfig',
      requestText: 'requestText',
      moveInvalidUpdateFile: 'moveInvalidUpdateFile',
      buildWeatherMood: 'buildWeatherMood',
    },
    resetMusicRuntime: () => calls.push(['resetMusicRuntime']),
    setUpdatePlatform: value => calls.push(['setUpdatePlatform', value]),
    setUpdateManifest: value => calls.push(['setUpdateManifest', value]),
    setUpdateAutoDownload: value => calls.push(['setUpdateAutoDownload', value]),
    setUpdateAutoPatch: value => calls.push(['setUpdateAutoPatch', value]),
    resetUpdateRuntime: () => calls.push(['resetUpdateRuntime']),
  });

  assert.deepEqual(Object.keys(runtime), serverTestRuntimeExportNames);
  assert.equal(runtime.normalizeCookieHeader, 'normalizeCookieHeader');
  runtime.setNeteaseApi({ api: true });
  runtime.setRequestText('request');
  runtime.resetMusicRuntime();
  runtime.setUpdateAutoDownload(false);
  runtime.resetUpdateRuntime();

  assert.deepEqual(calls, [
    ['setNeteaseApi', { api: true }],
    ['setRequestText', 'request'],
    ['resetMusicRuntime'],
    ['setUpdateAutoDownload', false],
    ['resetUpdateRuntime'],
  ]);
});
