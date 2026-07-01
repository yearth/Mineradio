const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  serverTestRuntimeGroups,
  serverTestRuntimeExportNames,
} = require('../server-dist/server/test-support/runtime');

const root = path.join(__dirname, '..');
const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

function extractLegacyTestExportNames(source) {
  const start = source.indexOf('module.exports.__test = {');
  assert.notEqual(start, -1, 'server.js should expose module.exports.__test in test mode');

  const block = source.slice(start, source.indexOf('\n  };\n}', start));
  return Array.from(block.matchAll(/^    ([A-Za-z_$][\w$]*)(?:\(|,)/gm), match => match[1]);
}

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
  assert.deepEqual(serverTestRuntimeExportNames, extractLegacyTestExportNames(serverSource));
  assert.equal(new Set(serverTestRuntimeExportNames).size, serverTestRuntimeExportNames.length);
  assert.equal(serverTestRuntimeExportNames.length, 15);
});
