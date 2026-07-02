const test = require('node:test');
const assert = require('node:assert/strict');

const {
  startUpdateDownloadJob,
  startUpdatePatchJob,
} = require('../server-dist/server/services/update-job-factory');

function deps(overrides = {}) {
  const jobs = overrides.jobs || new Map();
  const calls = [];
  return {
    jobs,
    calls,
    path: {
      join(...parts) {
        return parts.join('/').replace(/\/+/g, '/');
      },
    },
    downloadDir: '/downloads',
    safeUpdateFileName(name, version) {
      return name || `Mineradio-${version}-Setup.exe`;
    },
    uniqueDownloadCandidates(urls) {
      return (Array.isArray(urls) ? urls : [urls])
        .filter(Boolean)
        .map((url, index) => ({ url, label: index === 0 ? 'GitHub 直连' : '下载线路 ' + (index + 1), mirrored: false }));
    },
    activeUpdateJobFor(version) {
      return Array.from(jobs.values())
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .find(job => job.version === version && ['queued', 'downloading', 'ready'].includes(job.status));
    },
    publicUpdateJob(job) {
      if (!job) return { ok: false, error: 'UPDATE_JOB_NOT_FOUND' };
      return {
        ok: job.status !== 'error',
        id: job.id,
        status: job.status,
        mode: job.mode,
        progress: job.progress || 0,
        fileName: job.fileName || '',
        filePath: job.status === 'ready' ? job.filePath : '',
        version: job.version || '',
        cached: !!job.cached,
      };
    },
    trimUpdateJobs() {
      calls.push(['trim']);
    },
    reuseVerifiedInstallerJob(opts) {
      calls.push(['reuse', opts]);
      return overrides.cachedJob || null;
    },
    runDownload(job) {
      calls.push(['download', job.id]);
    },
    runPatch(job) {
      calls.push(['patch', job.id]);
    },
    now: () => 123456789,
    random: () => 0.123456789,
    autoDownload: true,
    autoPatch: true,
    ...overrides,
  };
}

test('startUpdateDownloadJob preserves legacy rejection responses', () => {
  const base = deps();

  assert.deepEqual(startUpdateDownloadJob(null, base), { ok: false, error: 'UPDATE_REPOSITORY_NOT_CONFIGURED' });
  assert.deepEqual(startUpdateDownloadJob({ configured: false }, base), { ok: false, error: 'UPDATE_REPOSITORY_NOT_CONFIGURED' });
  assert.deepEqual(startUpdateDownloadJob({ configured: true, updateAvailable: false }, base), { ok: false, error: 'NO_UPDATE_AVAILABLE' });
  assert.deepEqual(startUpdateDownloadJob({
    configured: true,
    updateAvailable: true,
    release: { downloadUrl: 'file:///tmp/app.exe' },
  }, base), { ok: false, error: 'UPDATE_ASSET_MISSING' });
});

test('startUpdateDownloadJob reuses the newest active installer job', () => {
  const jobs = new Map([
    ['old', { id: 'old', mode: 'installer', version: '1.2.0', status: 'ready', createdAt: 10 }],
    ['new', { id: 'new', mode: 'installer', version: '1.2.0', status: 'downloading', createdAt: 20 }],
  ]);
  const result = startUpdateDownloadJob({
    configured: true,
    updateAvailable: true,
    latestVersion: '1.2.0',
    release: { version: '1.2.0', downloadUrl: 'https://example.com/app.exe' },
  }, deps({ jobs }));

  assert.equal(result.id, 'new');
  assert.equal(jobs.size, 2);
});

test('startUpdateDownloadJob returns verified cached installer jobs before queueing a new download', () => {
  const jobs = new Map();
  const cachedJob = {
    id: 'cached-job',
    status: 'ready',
    mode: 'installer',
    version: '1.2.0',
    filePath: '/downloads/app.exe',
    cached: true,
  };
  const resolved = deps({ jobs, cachedJob });

  const result = startUpdateDownloadJob({
    configured: true,
    updateAvailable: true,
    latestVersion: '1.2.0',
    release: {
      htmlUrl: 'https://example.com/releases/v1.2.0',
      downloadUrl: 'https://example.com/app.exe',
      asset: {
        name: 'app.exe',
        size: 321,
        sha256: 'sha256:ABCDEF',
        sha512: 'sha512-base64',
        downloadUrls: ['https://mirror.example.com/app.exe'],
      },
    },
  }, resolved);

  assert.equal(result.id, 'cached-job');
  assert.equal(result.cached, true);
  assert.equal(resolved.calls[0][0], 'reuse');
  assert.equal(resolved.calls[0][1].filePath, '/downloads/app.exe');
  assert.equal(resolved.calls[0][1].sha256, 'abcdef');
  assert.deepEqual(resolved.calls[0][1].downloadCandidates.map(item => item.url), [
    'https://example.com/app.exe',
    'https://mirror.example.com/app.exe',
  ]);
});

test('startUpdateDownloadJob queues installer jobs and respects autoDownload false', () => {
  const jobs = new Map();
  const resolved = deps({ jobs, autoDownload: false });

  const result = startUpdateDownloadJob({
    configured: true,
    updateAvailable: true,
    latestVersion: '1.2.0',
    release: {
      htmlUrl: 'https://example.com/releases/v1.2.0',
      downloadUrl: 'https://example.com/app.exe',
      asset: { size: 321 },
    },
  }, resolved);

  assert.equal(result.id, '21i3v9-4fzzzx');
  assert.equal(result.status, 'queued');
  assert.equal(result.mode, 'installer');
  const job = jobs.get(result.id);
  assert.equal(job.fileName, 'Mineradio-1.2.0-Setup.exe');
  assert.equal(job.filePath, '/downloads/Mineradio-1.2.0-Setup.exe');
  assert.equal(job.total, 321);
  assert.deepEqual(resolved.calls, [
    ['reuse', {
      fileName: 'Mineradio-1.2.0-Setup.exe',
      filePath: '/downloads/Mineradio-1.2.0-Setup.exe',
      version: '1.2.0',
      downloadUrl: 'https://example.com/app.exe',
      downloadCandidates: [{ url: 'https://example.com/app.exe', label: 'GitHub 直连', mirrored: false }],
      expectedSize: 321,
      sha256: '',
      sha512: '',
      releaseUrl: 'https://example.com/releases/v1.2.0',
      attempts: 1,
    }],
    ['trim'],
  ]);
});

test('startUpdatePatchJob preserves legacy rejection responses', () => {
  const base = deps();

  assert.deepEqual(startUpdatePatchJob(null, base), { ok: false, error: 'UPDATE_REPOSITORY_NOT_CONFIGURED' });
  assert.deepEqual(startUpdatePatchJob({ configured: false }, base), { ok: false, error: 'UPDATE_REPOSITORY_NOT_CONFIGURED' });
  assert.deepEqual(startUpdatePatchJob({ configured: true, updateAvailable: false }, base), { ok: false, error: 'NO_UPDATE_AVAILABLE' });
  assert.deepEqual(startUpdatePatchJob({
    configured: true,
    updateAvailable: true,
    release: { patchAvailable: false, patch: { downloadUrl: 'https://example.com/app.patch.json' } },
  }, base), { ok: false, error: 'PATCH_ASSET_MISSING' });
});

test('startUpdatePatchJob reuses existing patch jobs for the same version', () => {
  const jobs = new Map([
    ['old', { id: 'old', mode: 'patch', version: '1.2.0', status: 'ready', createdAt: 10 }],
    ['new', { id: 'new', mode: 'patch', version: '1.2.0', status: 'queued', createdAt: 20 }],
  ]);

  const result = startUpdatePatchJob({
    configured: true,
    updateAvailable: true,
    latestVersion: '1.2.0',
    release: {
      patchAvailable: true,
      patch: { downloadUrl: 'https://example.com/app.patch.json' },
    },
  }, deps({ jobs }));

  assert.equal(result.id, 'new');
  assert.equal(jobs.size, 2);
});

test('startUpdatePatchJob queues patch jobs and can auto-start patch runner', () => {
  const jobs = new Map();
  const resolved = deps({ jobs, autoPatch: true });

  const result = startUpdatePatchJob({
    configured: true,
    updateAvailable: true,
    latestVersion: '1.2.0',
    release: {
      htmlUrl: 'https://example.com/releases/v1.2.0',
      patchAvailable: true,
      patch: {
        to: '1.2.0',
        name: 'Mineradio.patch.json',
        downloadUrl: 'https://example.com/app.patch.json',
        downloadUrls: ['https://mirror.example.com/app.patch.json'],
        size: 123,
        sha256: 'sha256:ABCDEF',
        sha512: 'sha512-base64',
      },
    },
  }, resolved);

  assert.equal(result.id, 'patch-21i3v9-4fzzzx');
  assert.equal(result.status, 'queued');
  assert.equal(result.mode, 'patch');
  const job = jobs.get(result.id);
  assert.equal(job.fileName, 'Mineradio.patch.json');
  assert.equal(job.filePath, '');
  assert.equal(job.expectedSize, 123);
  assert.equal(job.sha256, 'abcdef');
  assert.equal(job.message, '等待下载快速补丁');
  assert.deepEqual(job.downloadCandidates.map(item => item.url), [
    'https://example.com/app.patch.json',
    'https://mirror.example.com/app.patch.json',
  ]);
  assert.deepEqual(resolved.calls, [
    ['trim'],
    ['patch', 'patch-21i3v9-4fzzzx'],
  ]);
});
