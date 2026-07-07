const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createDefaultUpdatePreviewState,
  applyLatestUpdateInfo,
  beginUpdateDownload,
  beginUpdatePatch,
  applyUpdateJobStatus,
  updateProgressDetailText,
  formatUpdateBytes,
  formatUpdateSpeed,
} = require('../public/renderer/core/update-state');

test('applyLatestUpdateInfo maps release metadata into preview state', () => {
  const state = createDefaultUpdatePreviewState();

  applyLatestUpdateInfo(state, {
    currentVersion: '1.1.1',
    latestVersion: '1.2.0',
    configured: true,
    preview: false,
    updateAvailable: true,
    release: {
      version: '1.2.1',
      htmlUrl: 'https://example.test/release',
      downloadUrl: 'https://example.test/app.dmg',
      summary: 'New build',
      notes: ['one', 'two', 'three', 'four', 'five'],
      patchAvailable: true,
      patch: { downloadUrl: 'https://example.test/app.patch' },
    },
  });

  assert.equal(state.currentVersion, '1.1.1');
  assert.equal(state.version, '1.2.0');
  assert.equal(state.configured, true);
  assert.equal(state.preview, false);
  assert.equal(state.updateAvailable, true);
  assert.equal(state.releaseUrl, 'https://example.test/release');
  assert.equal(state.downloadUrl, 'https://example.test/app.dmg');
  assert.equal(state.patchAvailable, true);
  assert.equal(state.patchUrl, 'https://example.test/app.patch');
  assert.equal(state.hero, 'New build');
  assert.deepEqual(state.notes, ['one', 'two', 'three', 'four']);
});

test('beginUpdateDownload and beginUpdatePatch reset transient progress state', () => {
  const state = createDefaultUpdatePreviewState({ status: 'error', progress: 88, installerPath: '/tmp/app.dmg' });

  beginUpdateDownload(state);
  assert.equal(state.status, 'downloading');
  assert.equal(state.mode, 'installer');
  assert.equal(state.progress, 0);
  assert.equal(state.installerPath, '');
  assert.equal(state.message, '正在下载完整安装包');

  state.progress = 42;
  state.errorReason = 'old';
  beginUpdatePatch(state);
  assert.equal(state.status, 'downloading');
  assert.equal(state.mode, 'patch');
  assert.equal(state.progress, 0);
  assert.equal(state.errorReason, '');
  assert.equal(state.patchFallbackTried, false);
  assert.equal(state.message, '正在下载快速补丁');
});

test('applyUpdateJobStatus preserves ready, error, and progress fields', () => {
  const state = createDefaultUpdatePreviewState();

  applyUpdateJobStatus(state, {
    status: 'downloading',
    progress: 45.4,
    received: 1536,
    total: 4096,
    speedBps: 2048,
    etaSeconds: 8,
    sourceLabel: 'mirror',
    attempt: 2,
    attempts: 3,
    message: 'Downloading',
  });

  assert.equal(state.status, 'downloading');
  assert.equal(state.progress, 45.4);
  assert.match(updateProgressDetailText(state), /线路 2\/3/);
  assert.match(updateProgressDetailText(state), /mirror/);
  assert.match(updateProgressDetailText(state), /1.5 KB \/ 4 KB/);
  assert.match(updateProgressDetailText(state), /2 KB\/s/);

  applyUpdateJobStatus(state, { status: 'ready', filePath: '/tmp/Mineradio.dmg', cached: true });
  assert.equal(state.status, 'ready');
  assert.equal(state.progress, 100);
  assert.equal(state.installerPath, '/tmp/Mineradio.dmg');
  assert.equal(state.cached, true);

  applyUpdateJobStatus(state, { status: 'error', error: 'UPDATE_FAILED', errorDetail: 'bad hash', failedAttempts: ['a'] });
  assert.equal(state.status, 'error');
  assert.equal(state.errorReason, 'UPDATE_FAILED');
  assert.equal(state.errorDetail, 'bad hash');
  assert.deepEqual(state.failedAttempts, ['a']);
});

test('update formatters keep compact byte and speed labels', () => {
  assert.equal(formatUpdateBytes(0), '0 B');
  assert.equal(formatUpdateBytes(1536), '1.5 KB');
  assert.equal(formatUpdateBytes(5 * 1024 * 1024), '5 MB');
  assert.equal(formatUpdateSpeed(0), '');
  assert.equal(formatUpdateSpeed(2048), '2 KB/s');
});
