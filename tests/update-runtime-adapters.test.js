const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createUpdateRuntimeAdapters,
} = require('../server-dist/server/composition/update-runtime-adapters');

function createOptions(overrides = {}) {
  const jobs = new Map();
  const calls = [];
  const services = {};
  [
    'uniqueDownloadCandidates',
    'normalizeManifestUpdateInfo',
    'readUpdateManifest',
    'fetchManifestUpdateInfo',
    'fetchTextFromCandidates',
    'parseLatestYmlUpdateInfo',
    'fetchLatestYmlUpdateInfo',
    'fetchLatestUpdateInfo',
    'activeUpdateJobFor',
    'trimUpdateJobs',
    'verifyUpdateFile',
    'moveInvalidUpdateFile',
    'reuseVerifiedInstallerJob',
    'downloadUpdateAssetWithMirrors',
    'startUpdateDownloadJob',
    'patchTargetPath',
    'writePatchFile',
    'normalizePatchPayload',
    'downloadPatchBufferFromCandidate',
    'downloadAndApplyPatchWithMirrors',
    'startUpdatePatchJob',
    'localUpdateFallback',
  ].forEach(name => {
    services[name] = (...args) => {
      calls.push([name, args]);
      return `${name}:result`;
    };
  });
  services.fetchLatestYmlUpdateInfo = async (...args) => {
    calls.push(['fetchLatestYmlUpdateInfo', args]);
    return 'fetchLatestYmlUpdateInfo:result';
  };
  services.fetchLatestUpdateInfo = async (...args) => {
    calls.push(['fetchLatestUpdateInfo', args]);
    return 'fetchLatestUpdateInfo:result';
  };
  services.fetchManifestUpdateInfo = async (...args) => {
    calls.push(['fetchManifestUpdateInfo', args]);
    return 'fetchManifestUpdateInfo:result';
  };
  services.fetchTextFromCandidates = async (...args) => {
    calls.push(['fetchTextFromCandidates', args]);
    return 'fetchTextFromCandidates:result';
  };
  services.readUpdateManifest = async (...args) => {
    calls.push(['readUpdateManifest', args]);
    return 'readUpdateManifest:result';
  };
  services.downloadUpdateAssetWithMirrors = async (...args) => {
    calls.push(['downloadUpdateAssetWithMirrors', args]);
    return 'downloadUpdateAssetWithMirrors:result';
  };
  services.downloadPatchBufferFromCandidate = async (...args) => {
    calls.push(['downloadPatchBufferFromCandidate', args]);
    return 'downloadPatchBufferFromCandidate:result';
  };
  services.downloadAndApplyPatchWithMirrors = async (...args) => {
    calls.push(['downloadAndApplyPatchWithMirrors', args]);
    return 'downloadAndApplyPatchWithMirrors:result';
  };

  return {
    calls,
    options: {
      fs: { label: 'fs' },
      path: { label: 'path' },
      once: async () => {},
      fetch: async (url, opts) => ({ url, opts }),
      rootDir: '/app',
      appVersion: '1.2.3',
      updateConfig: {
        owner: 'owner',
        repo: 'repo',
        preview: true,
        preferMirrors: true,
        mirrors: ['https://mirror.example/'],
        manifest: 'manifest.json',
      },
      updateFallbackNotes: 'fallback notes',
      updateWorkDir: '/work',
      updateDownloadDir: '/downloads',
      updatePatchBackupDir: '/backups',
      patchMaxBytes: 1024,
      updateRuntime: {
        jobs,
        platform: value => `platform:${value}`,
        manifest: value => `manifest:${value}`,
        autoDownload: () => 'autoDownload',
        autoPatch: () => 'autoPatch',
      },
      safeUpdateFileName: (name, version) => `${name || 'Mineradio'}-${version}`,
      userAgent: 'Mineradio/1.2.3',
      logger: { warn() {} },
      services,
      ...overrides,
    },
  };
}

test('createUpdateRuntimeAdapters exposes legacy update wrapper names and shared jobs map', () => {
  const { options } = createOptions();
  const adapters = createUpdateRuntimeAdapters(options);

  assert.deepEqual(Object.keys(adapters), [
    'updateDownloadJobs',
    'publicUpdateJob',
    'updateRuntimePlatform',
    'updateManifestRef',
    'uniqueDownloadCandidates',
    'normalizeManifestUpdateInfo',
    'readUpdateManifest',
    'fetchManifestUpdateInfo',
    'localUpdateFallback',
    'fetchWithTimeout',
    'fetchTextFromCandidates',
    'parseLatestYmlUpdateInfo',
    'fetchLatestYmlUpdateInfo',
    'fetchLatestUpdateInfo',
    'activeUpdateJobFor',
    'trimUpdateJobs',
    'verifyUpdateFile',
    'moveInvalidUpdateFile',
    'reuseVerifiedInstallerJob',
    'downloadUpdateAssetWithMirrors',
    'startUpdateDownloadJob',
    'patchTargetPath',
    'writePatchFile',
    'normalizePatchPayload',
    'downloadPatchBufferFromCandidate',
    'downloadAndApplyPatchWithMirrors',
    'startUpdatePatchJob',
  ]);
  assert.equal(adapters.updateDownloadJobs, options.updateRuntime.jobs);
  assert.equal(typeof adapters.publicUpdateJob, 'function');
  assert.equal(adapters.updateRuntimePlatform(), `platform:${process.platform}`);
  assert.equal(adapters.updateManifestRef(), 'manifest:manifest.json');
});

test('createUpdateRuntimeAdapters wires update wrapper dependencies', async () => {
  const { options, calls } = createOptions();
  const adapters = createUpdateRuntimeAdapters(options);

  assert.equal(adapters.uniqueDownloadCandidates(['asset.exe'], { version: '1.2.3' }), 'uniqueDownloadCandidates:result');
  assert.equal(adapters.normalizeManifestUpdateInfo({ version: '1.2.4' }), 'normalizeManifestUpdateInfo:result');
  assert.equal(await adapters.readUpdateManifest('manifest'), 'readUpdateManifest:result');
  assert.equal(await adapters.fetchManifestUpdateInfo('manifest'), 'fetchManifestUpdateInfo:result');
  assert.equal(adapters.localUpdateFallback('reason', { configured: true }), 'localUpdateFallback:result');
  assert.equal(await adapters.fetchWithTimeout('https://example.test', { method: 'GET' }, 5).then(res => res.url), 'https://example.test');
  assert.equal(await adapters.fetchTextFromCandidates(['a'], 1), 'fetchTextFromCandidates:result');
  assert.equal(adapters.parseLatestYmlUpdateInfo('text', 'reason'), 'parseLatestYmlUpdateInfo:result');
  assert.equal(await adapters.fetchLatestYmlUpdateInfo('reason'), 'fetchLatestYmlUpdateInfo:result');
  assert.equal(await adapters.fetchLatestUpdateInfo(), 'fetchLatestUpdateInfo:result');
  assert.equal(adapters.activeUpdateJobFor('1.2.3'), 'activeUpdateJobFor:result');
  assert.equal(adapters.trimUpdateJobs(), 'trimUpdateJobs:result');
  assert.equal(adapters.verifyUpdateFile('/downloads/app.exe', { version: '1.2.3' }), 'verifyUpdateFile:result');
  assert.equal(adapters.moveInvalidUpdateFile('/downloads/app.exe', 'bad hash'), 'moveInvalidUpdateFile:result');
  assert.equal(adapters.reuseVerifiedInstallerJob({ version: '1.2.3' }), 'reuseVerifiedInstallerJob:result');
  assert.equal(await adapters.downloadUpdateAssetWithMirrors({ id: 'job' }), 'downloadUpdateAssetWithMirrors:result');
  assert.equal(adapters.startUpdateDownloadJob({ version: '1.2.3' }), 'startUpdateDownloadJob:result');
  assert.equal(adapters.patchTargetPath('public/index.html'), 'patchTargetPath:result');
  assert.equal(adapters.writePatchFile({ id: 'job' }, { path: 'public/index.html' }), 'writePatchFile:result');
  assert.equal(adapters.normalizePatchPayload({ version: '1.2.4' }), 'normalizePatchPayload:result');
  assert.equal(await adapters.downloadPatchBufferFromCandidate({ id: 'job' }, 'candidate', 0, 1), 'downloadPatchBufferFromCandidate:result');
  assert.equal(await adapters.downloadAndApplyPatchWithMirrors({ id: 'job' }), 'downloadAndApplyPatchWithMirrors:result');
  assert.equal(adapters.startUpdatePatchJob({ version: '1.2.3' }), 'startUpdatePatchJob:result');

  assert.equal(calls[0][0], 'uniqueDownloadCandidates');
  assert.deepEqual(calls[0][1][1], {
    version: '1.2.3',
    mirrors: ['https://mirror.example/'],
    preferMirrors: true,
  });
  assert.equal(calls.find(call => call[0] === 'startUpdateDownloadJob')[1][1].autoDownload, 'autoDownload');
  assert.equal(calls.find(call => call[0] === 'startUpdatePatchJob')[1][1].autoPatch, 'autoPatch');
});
