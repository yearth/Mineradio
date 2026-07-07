const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildServerTestRuntime,
  createServerTestRuntimeBindings,
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
  assert.match(serverSource, /module\.exports\.__test = .*testRuntime/);
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

test('createServerTestRuntimeBindings wires test hooks to mutable runtimes', () => {
  const calls = [];
  const bindings = createServerTestRuntimeBindings({
    neteaseApiRuntime: {
      apply: value => calls.push(['neteaseApiRuntime.apply', value]),
    },
    requestRuntime: {
      setRequestText: value => calls.push(['requestRuntime.setRequestText', value]),
      reset: () => calls.push(['requestRuntime.reset']),
    },
    sessionRuntime: {
      reset: () => calls.push(['sessionRuntime.reset']),
    },
    updateRuntime: {
      setPlatform: value => calls.push(['updateRuntime.setPlatform', value]),
      setManifest: value => calls.push(['updateRuntime.setManifest', value]),
      setAutoDownload: value => calls.push(['updateRuntime.setAutoDownload', value]),
      setAutoPatch: value => calls.push(['updateRuntime.setAutoPatch', value]),
      reset: () => calls.push(['updateRuntime.reset']),
    },
    helpers: {
      normalizeCookieHeader: 'normalizeCookieHeader',
      rawCookieFallback: 'rawCookieFallback',
      parseGitHubRepository: 'parseGitHubRepository',
      readUpdateConfig: 'readUpdateConfig',
      requestText: 'requestText',
      moveInvalidUpdateFile: 'moveInvalidUpdateFile',
      buildWeatherMood: 'buildWeatherMood',
    },
  });
  const runtime = buildServerTestRuntime(bindings);

  assert.equal(runtime.requestText, 'requestText');
  runtime.setNeteaseApi({ cloudsearch: true });
  runtime.setRequestText('override');
  runtime.resetMusicRuntime();
  runtime.setUpdatePlatform('darwin');
  runtime.setUpdateManifest({ version: '1.2.3' });
  runtime.setUpdateAutoDownload(false);
  runtime.setUpdateAutoPatch(true);
  runtime.resetUpdateRuntime();

  assert.deepEqual(calls, [
    ['neteaseApiRuntime.apply', { cloudsearch: true }],
    ['requestRuntime.setRequestText', 'override'],
    ['neteaseApiRuntime.apply', undefined],
    ['sessionRuntime.reset'],
    ['requestRuntime.reset'],
    ['updateRuntime.setPlatform', 'darwin'],
    ['updateRuntime.setManifest', { version: '1.2.3' }],
    ['updateRuntime.setAutoDownload', false],
    ['updateRuntime.setAutoPatch', true],
    ['updateRuntime.reset'],
  ]);
});
