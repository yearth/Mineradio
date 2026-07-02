const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createUpdateRuntime,
} = require('../server-dist/server/runtime/update-runtime');

test('createUpdateRuntime preserves update override defaults and reset behavior', () => {
  const runtime = createUpdateRuntime();

  assert.equal(runtime.platform('darwin'), 'darwin');
  assert.equal(runtime.manifest('default.yml'), 'default.yml');
  assert.equal(runtime.autoDownload(), true);
  assert.equal(runtime.autoPatch(), true);
  assert.equal(runtime.jobs.size, 0);

  runtime.setPlatform('win32');
  runtime.setManifest('manifest.json');
  runtime.setAutoDownload(false);
  runtime.setAutoPatch(false);
  runtime.jobs.set('job-1', { id: 'job-1' });

  assert.equal(runtime.platform('darwin'), 'win32');
  assert.equal(runtime.manifest('default.yml'), 'manifest.json');
  assert.equal(runtime.autoDownload(), false);
  assert.equal(runtime.autoPatch(), false);
  assert.equal(runtime.jobs.size, 1);

  runtime.reset();

  assert.equal(runtime.platform('darwin'), 'darwin');
  assert.equal(runtime.manifest('default.yml'), 'default.yml');
  assert.equal(runtime.autoDownload(), true);
  assert.equal(runtime.autoPatch(), true);
  assert.equal(runtime.jobs.size, 0);
});

test('createUpdateRuntime normalizes override inputs like the legacy test hooks', () => {
  const runtime = createUpdateRuntime();

  runtime.setPlatform(null);
  runtime.setManifest(undefined);
  runtime.setAutoDownload(0);
  runtime.setAutoPatch('');

  assert.equal(runtime.platform('linux'), 'linux');
  assert.equal(runtime.manifest('latest.yml'), 'latest.yml');
  assert.equal(runtime.autoDownload(), true);
  assert.equal(runtime.autoPatch(), true);
});
