const test = require('node:test');
const assert = require('node:assert/strict');

const {
  downloadPatchBufferFromCandidate,
} = require('../server-dist/server/services/update-patch-download');

function streamResponse(chunks, contentLength) {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return String(name || '').toLowerCase() === 'content-length' && contentLength != null
          ? String(contentLength)
          : '';
      },
    },
    body: new ReadableStream({
      start(controller) {
        chunks.forEach(chunk => controller.enqueue(new Uint8Array(chunk)));
        controller.close();
      },
    }),
  };
}

function testDeps(overrides = {}) {
  const calls = [];
  return {
    calls,
    deps: Object.assign({
      patchMaxBytes: 1024,
      userAgent: 'Mineradio/1.1.1',
      ensureMirrorCanBeVerified(job, candidate) {
        calls.push(['ensure', candidate.url]);
      },
      prepareUpdateJobAttempt(job, candidate, index, total) {
        calls.push(['prepare', candidate.url, index, total]);
        job.status = 'downloading';
      },
      async fetchWithTimeout(url, opts, timeoutMs) {
        calls.push(['fetch', url, opts.headers['User-Agent'], timeoutMs]);
        return streamResponse([Buffer.from('patch payload')], 13);
      },
      updateError(code, message) {
        calls.push(['error', code, message]);
        return Object.assign(new Error(message), { code });
      },
      updateSpeedBps(bytes, elapsedMs) {
        calls.push(['speed', bytes, elapsedMs]);
        return Math.round(bytes * 1000 / elapsedMs);
      },
      patchProgress(input) {
        calls.push(['progress', input.received, input.total, input.speedBps]);
        return { progress: input.total ? Math.round(input.received / input.total * 84) : 12, etaSeconds: 0 };
      },
      verifyUpdateBuffer(buffer, job) {
        calls.push(['verify', buffer.toString('utf8'), job.id]);
      },
      now: Date.now,
    }, overrides),
  };
}

test('downloadPatchBufferFromCandidate prepares a patch job and returns a verified buffer', async () => {
  const job = { id: 'patch-1', expectedSize: 0, total: 0, received: 99 };
  const { calls, deps } = testDeps();

  const raw = await downloadPatchBufferFromCandidate(job, { url: 'https://cdn.example.com/patch.json' }, 1, 3, deps);

  assert.equal(raw.toString('utf8'), 'patch payload');
  assert.equal(job.mode, 'patch');
  assert.equal(job.message, '正在下载快速补丁');
  assert.equal(job.total, 13);
  assert.equal(job.received, 13);
  assert.equal(job.progress, 84);
  assert.deepEqual(calls, [
    ['ensure', 'https://cdn.example.com/patch.json'],
    ['prepare', 'https://cdn.example.com/patch.json', 1, 3],
    ['fetch', 'https://cdn.example.com/patch.json', 'Mineradio/1.1.1', 12000],
    ['progress', 13, 13, undefined],
    ['verify', 'patch payload', 'patch-1'],
  ]);
});

test('downloadPatchBufferFromCandidate tracks speed windows for chunked patches', async () => {
  const job = { id: 'patch-speed', expectedSize: 0, total: 0 };
  let now = 2000000000000;
  const { calls, deps } = testDeps({
    now() {
      now += 1000;
      return now;
    },
    async fetchWithTimeout() {
      return streamResponse([Buffer.from('abc'), Buffer.from('def')], 6);
    },
  });

  const raw = await downloadPatchBufferFromCandidate(job, { url: 'https://cdn.example.com/patch.json' }, 0, 1, deps);

  assert.equal(raw.toString('utf8'), 'abcdef');
  assert.equal(job.speedBps > 0, true);
  assert.equal(calls.some(call => call[0] === 'speed'), true);
});

test('downloadPatchBufferFromCandidate preserves HTTP and oversized patch errors', async () => {
  await assert.rejects(
    downloadPatchBufferFromCandidate({ id: 'patch-http' }, { url: 'https://cdn.example.com/404.json' }, 0, 1, testDeps({
      async fetchWithTimeout() {
        return { ok: false, status: 404, headers: { get() { return ''; } } };
      },
    }).deps),
    err => err && err.code === 'HTTP_404' && err.message === 'HTTP 404'
  );

  await assert.rejects(
    downloadPatchBufferFromCandidate({ id: 'patch-large' }, { url: 'https://cdn.example.com/large.json' }, 0, 1, testDeps({
      patchMaxBytes: 4,
      async fetchWithTimeout() {
        return streamResponse([Buffer.from('123'), Buffer.from('45')], 5);
      },
    }).deps),
    err => err && err.code === 'PATCH_TOO_LARGE' && err.message === 'Patch package is too large'
  );
});
