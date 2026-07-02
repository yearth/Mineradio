const test = require('node:test');
const assert = require('node:assert/strict');

const {
  activeUpdateJobFor,
  ensureMirrorCanBeVerified,
  prepareUpdateJobAttempt,
  publicUpdateJob,
  setUpdateJobError,
  trimUpdateJobs,
} = require('../server-dist/server/services/update-job-runtime');

test('publicUpdateJob maps internal jobs to the legacy public shape', () => {
  assert.deepEqual(publicUpdateJob(null), { ok: false, error: 'UPDATE_JOB_NOT_FOUND' });

  const ready = publicUpdateJob({
    id: 'job-1',
    status: 'ready',
    progress: 100,
    received: 12,
    total: 12,
    speedBps: 9,
    etaSeconds: 0,
    sourceLabel: 'GitHub 直连',
    attempt: 1,
    attempts: 2,
    mode: 'patch',
    message: 'done',
    restartRequired: true,
    cached: true,
    fileName: 'Mineradio.patch.json',
    filePath: '/tmp/Mineradio.patch.json',
    version: '1.2.0',
    releaseUrl: 'https://example.com/releases/v1.2.0',
    failedAttempts: Array.from({ length: 8 }, (_, index) => ({ source: 'line-' + index })),
    createdAt: 11,
    updatedAt: 22,
  });

  assert.equal(ready.ok, true);
  assert.equal(ready.filePath, '/tmp/Mineradio.patch.json');
  assert.equal(ready.mode, 'patch');
  assert.equal(ready.restartRequired, true);
  assert.equal(ready.cached, true);
  assert.equal(ready.failedAttempts.length, 6);
  assert.deepEqual(ready.failedAttempts[0], { source: 'line-0' });
  assert.equal(ready.createdAt, 11);
  assert.equal(ready.updatedAt, 22);

  const hiddenPath = publicUpdateJob({
    id: 'job-2',
    status: 'downloading',
    filePath: '/tmp/hidden.exe',
  });

  assert.equal(hiddenPath.ok, true);
  assert.equal(hiddenPath.progress, 0);
  assert.equal(hiddenPath.filePath, '');
  assert.equal(hiddenPath.mode, 'installer');
});

test('publicUpdateJob reports legacy error fields for failed jobs', () => {
  const result = publicUpdateJob({
    id: 'job-3',
    status: 'error',
    error: 'HTTP_500',
    errorReason: '服务器返回错误',
    errorDetail: 'HTTP 500',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'HTTP_500');
  assert.equal(result.errorReason, '服务器返回错误');
  assert.equal(result.errorDetail, 'HTTP 500');
});

test('activeUpdateJobFor picks the newest queued, downloading, or ready job for a version', () => {
  const jobs = new Map([
    ['old-ready', { id: 'old-ready', version: '1.2.0', status: 'ready', createdAt: 10 }],
    ['new-error', { id: 'new-error', version: '1.2.0', status: 'error', createdAt: 40 }],
    ['new-queued', { id: 'new-queued', version: '1.2.0', status: 'queued', createdAt: 30 }],
    ['other', { id: 'other', version: '1.3.0', status: 'ready', createdAt: 50 }],
  ]);

  assert.equal(activeUpdateJobFor(jobs, '1.2.0').id, 'new-queued');
  assert.equal(activeUpdateJobFor(jobs, '1.4.0'), undefined);
});

test('trimUpdateJobs keeps the eight newest jobs', () => {
  const jobs = new Map();
  for (let index = 0; index < 10; index += 1) {
    jobs.set('job-' + index, { id: 'job-' + index, createdAt: index });
  }

  trimUpdateJobs(jobs);

  assert.deepEqual(Array.from(jobs.keys()), [
    'job-2',
    'job-3',
    'job-4',
    'job-5',
    'job-6',
    'job-7',
    'job-8',
    'job-9',
  ]);
});

test('prepareUpdateJobAttempt sets downloading state and clears previous errors', () => {
  const job = {
    status: 'error',
    received: 42,
    speedBps: 10,
    etaSeconds: 3,
    error: 'HTTP_500',
    errorReason: 'old',
    errorDetail: 'old detail',
  };

  const before = Date.now();
  prepareUpdateJobAttempt(job, { label: '国内加速线路 1' }, 1, 3);

  assert.equal(job.status, 'downloading');
  assert.equal(job.sourceLabel, '国内加速线路 1');
  assert.equal(job.attempt, 2);
  assert.equal(job.attempts, 3);
  assert.equal(job.received, 0);
  assert.equal(job.speedBps, 0);
  assert.equal(job.etaSeconds, 0);
  assert.equal(job.error, '');
  assert.equal(job.errorReason, '');
  assert.equal(job.errorDetail, '');
  assert.equal(job.updatedAt >= before, true);
});

test('setUpdateJobError stores classified update errors', () => {
  const job = {};
  const before = Date.now();

  setUpdateJobError(job, Object.assign(new Error('HTTP 404'), { code: 'HTTP_404' }), '下载失败：HTTP 404');

  assert.equal(job.status, 'error');
  assert.equal(job.error, 'HTTP_404');
  assert.equal(job.errorReason, '更新文件不存在，可能 release 资源还没有同步完成。');
  assert.equal(job.errorDetail, 'HTTP 404');
  assert.equal(job.message, '下载失败：HTTP 404');
  assert.equal(job.updatedAt >= before, true);
});

test('ensureMirrorCanBeVerified preserves the legacy mirrored digest guard', () => {
  assert.doesNotThrow(() => ensureMirrorCanBeVerified({}, null));
  assert.doesNotThrow(() => ensureMirrorCanBeVerified({}, { mirrored: false }));
  assert.doesNotThrow(() => ensureMirrorCanBeVerified({ sha256: 'abc' }, { mirrored: true }));
  assert.doesNotThrow(() => ensureMirrorCanBeVerified({ sha512: 'abc' }, { mirrored: true }));

  assert.throws(
    () => ensureMirrorCanBeVerified({}, { mirrored: true }),
    err => err && err.code === 'MIRROR_HASH_MISSING' && /Mirror download skipped/.test(err.message)
  );
});
