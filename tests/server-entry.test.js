const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  serverTestRuntimeExportNames,
} = require('../server-dist/server/test-support/runtime');

test('createMineradioServerEntry assembles server and legacy test runtime without listening in tests', () => {
  const {
    createMineradioServerEntry,
  } = require('../server-dist/server/server-entry');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-entry-'));
  const entry = createMineradioServerEntry({
    rootDir: path.join(__dirname, '..'),
    env: {
      NODE_ENV: 'test',
      PORT: '0',
      COOKIE_FILE: path.join(tempDir, '.cookie'),
      QQ_COOKIE_FILE: path.join(tempDir, '.qq-cookie'),
      MINERADIO_UPDATE_DIR: path.join(tempDir, 'updates'),
      MINERADIO_BEAT_CACHE_DIR: path.join(tempDir, 'beats'),
    },
    getFetch: () => async () => {
      throw new Error('fetch should remain lazy during entry assembly');
    },
  });

  assert.equal(typeof entry.server.emit, 'function');
  assert.deepEqual(Object.keys(entry.testRuntime), serverTestRuntimeExportNames);
  assert.equal(typeof entry.testRuntime.setNeteaseApi, 'function');
  assert.equal(typeof entry.testRuntime.setRequestText, 'function');
  assert.equal(typeof entry.testRuntime.resetMusicRuntime, 'function');
});
