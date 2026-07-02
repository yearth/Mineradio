const test = require('node:test');
const assert = require('node:assert/strict');

const {
  downloadAndApplyPatchWithMirrors,
} = require('../server-dist/server/services/update-patch-runner');

function testDeps(overrides = {}) {
  const calls = [];
  return {
    calls,
    deps: Object.assign({
      fs: {
        mkdirSync(dir, opts) {
          calls.push(['mkdir', dir, opts && opts.recursive]);
        },
      },
      downloadDir: '/updates/downloads',
      uniqueDownloadCandidates(url) {
        calls.push(['candidates', url]);
        return [{ url, label: '直连' }];
      },
      async downloadPatchBufferFromCandidate(job, candidate, index, total) {
        calls.push(['download', candidate.url, index, total]);
        return Buffer.from(JSON.stringify({
          to: '1.2.0',
          restartRequired: false,
          files: [{ path: 'public/a.txt', content: 'A' }],
        }));
      },
      normalizePatchPayload(payload) {
        calls.push(['normalize', payload.to, payload.files.length]);
        return payload;
      },
      writePatchFile(job, file) {
        calls.push(['write', file.path, job.id]);
        return { path: file.path, bytes: Buffer.byteLength(file.content) };
      },
      classifyUpdateError(err) {
        calls.push(['classify', err.code || err.message]);
        return { reason: err.message, detail: err.code || '' };
      },
      setUpdateJobError(job, err, message) {
        calls.push(['setError', err.code || err.message, message]);
        job.status = 'error';
        job.error = err.code || 'UPDATE_FAILED';
        job.message = message;
      },
      now: Date.now,
    }, overrides),
  };
}

test('downloadAndApplyPatchWithMirrors applies a patch and marks the job ready', async () => {
  const job = {
    id: 'patch-job',
    downloadUrl: 'https://cdn.example.com/patch.json',
  };
  const { calls, deps } = testDeps({
    async downloadPatchBufferFromCandidate(job, candidate, index, total) {
      calls.push(['download', candidate.url, index, total]);
      return Buffer.from('\uFEFF' + JSON.stringify({
        to: '1.2.9',
        restartRequired: true,
        files: [
          { path: 'public/a.txt', content: 'A' },
          { path: 'assets/b.txt', content: 'BB' },
        ],
      }));
    },
  });

  await downloadAndApplyPatchWithMirrors(job, deps);

  assert.equal(job.status, 'ready');
  assert.equal(job.version, '1.2.9');
  assert.equal(job.progress, 100);
  assert.equal(job.etaSeconds, 0);
  assert.equal(job.restartRequired, true);
  assert.equal(job.message, '快速补丁已应用，重启后生效');
  assert.deepEqual(job.changedFiles, [
    { path: 'public/a.txt', bytes: 1 },
    { path: 'assets/b.txt', bytes: 2 },
  ]);
  assert.deepEqual(calls, [
    ['candidates', 'https://cdn.example.com/patch.json'],
    ['mkdir', '/updates/downloads', true],
    ['download', 'https://cdn.example.com/patch.json', 0, 1],
    ['normalize', '1.2.9', 2],
    ['write', 'public/a.txt', 'patch-job'],
    ['write', 'assets/b.txt', 'patch-job'],
  ]);
});

test('downloadAndApplyPatchWithMirrors switches candidates and reports final patch failure', async () => {
  const job = {
    id: 'patch-fail',
    downloadCandidates: [
      { url: 'https://mirror.example.com/patch.json', label: '镜像' },
      { url: 'https://direct.example.com/patch.json', label: '直连' },
    ],
  };
  const { calls, deps } = testDeps({
    async downloadPatchBufferFromCandidate(job, candidate) {
      if (candidate.url.includes('mirror')) throw Object.assign(new Error('HTTP 503'), { code: 'HTTP_503' });
      return Buffer.from('{bad json');
    },
  });

  await downloadAndApplyPatchWithMirrors(job, deps);

  assert.equal(job.status, 'error');
  assert.match(job.message, /^快速补丁失败：/);
  assert.deepEqual(job.failedAttempts[0], { source: '镜像', reason: 'HTTP 503', detail: 'HTTP_503' });
  assert.equal(job.failedAttempts[1].source, '直连');
  assert.match(job.failedAttempts[1].reason, /JSON|Unexpected|Expected/i);
  assert.equal(job.failedAttempts[1].detail, '');
  assert.equal(calls.some(call => call[0] === 'setError' && /^快速补丁失败：/.test(call[2])), true);
});

test('downloadAndApplyPatchWithMirrors keeps the non-restart success message', async () => {
  const job = {
    id: 'patch-no-restart',
    downloadCandidates: [{ url: 'https://cdn.example.com/patch.json', label: '补丁' }],
  };
  const { deps } = testDeps();

  await downloadAndApplyPatchWithMirrors(job, deps);

  assert.equal(job.status, 'ready');
  assert.equal(job.restartRequired, false);
  assert.equal(job.message, '快速补丁已应用');
});
