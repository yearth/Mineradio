const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const {
  downloadUpdateAssetWithMirrors,
} = require('../server-dist/server/services/update-installer-download');

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

function createWriter(calls, backpressure = false) {
  const writer = new EventEmitter();
  writer.write = buf => {
    calls.push(['write', buf.toString('utf8')]);
    if (backpressure) {
      queueMicrotask(() => writer.emit('drain'));
      backpressure = false;
      return false;
    }
    return true;
  };
  writer.end = () => {
    calls.push(['end']);
    queueMicrotask(() => writer.emit('finish'));
  };
  return writer;
}

function testDeps(overrides = {}) {
  const calls = [];
  const existing = new Set();
  return {
    calls,
    deps: Object.assign({
      downloadDir: '/updates/downloads',
      userAgent: 'Mineradio/1.1.1',
      fs: {
        mkdirSync(dir, opts) {
          calls.push(['mkdir', dir, opts && opts.recursive]);
        },
        existsSync(file) {
          calls.push(['exists', file]);
          return existing.has(file);
        },
        unlinkSync(file) {
          calls.push(['unlink', file]);
          existing.delete(file);
        },
        renameSync(from, to) {
          calls.push(['rename', from, to]);
          existing.add(to);
        },
        createWriteStream(file) {
          calls.push(['createWriteStream', file]);
          return createWriter(calls, overrides.backpressure);
        },
      },
      once: (emitter, event) => new Promise(resolve => emitter.once(event, resolve)),
      uniqueDownloadCandidates(url) {
        calls.push(['candidates', url]);
        return [{ url, label: '直连' }];
      },
      ensureMirrorCanBeVerified(job, candidate) {
        calls.push(['ensure', candidate.url]);
      },
      prepareUpdateJobAttempt(job, candidate, index, total) {
        calls.push(['prepare', candidate.url, index, total]);
        job.status = 'downloading';
      },
      async fetchWithTimeout(url, opts, timeoutMs) {
        calls.push(['fetch', url, opts.headers['User-Agent'], timeoutMs]);
        return streamResponse([Buffer.from('installer')], 9);
      },
      updateError(code, message) {
        calls.push(['error', code, message]);
        return Object.assign(new Error(message), { code });
      },
      updateSpeedBps(bytes, elapsedMs) {
        calls.push(['speed', bytes, elapsedMs]);
        return Math.round(bytes * 1000 / elapsedMs);
      },
      installerProgress(input) {
        calls.push(['progress', input.received, input.total, input.speedBps]);
        return { progress: input.total ? Math.round(input.received / input.total * 99) : 7, etaSeconds: 0 };
      },
      verifyUpdateFile(file, job) {
        calls.push(['verify', file, job.id]);
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
      Buffer,
    }, overrides),
    existing,
  };
}

test('downloadUpdateAssetWithMirrors downloads and verifies the first successful installer', async () => {
  const job = {
    id: 'job-1',
    filePath: '/updates/downloads/Mineradio.exe',
    downloadUrl: 'https://cdn.example.com/Mineradio.exe',
    expectedSize: 0,
    total: 0,
    received: 0,
  };
  const { calls, deps } = testDeps();

  await downloadUpdateAssetWithMirrors(job, deps);

  assert.equal(job.status, 'ready');
  assert.equal(job.progress, 100);
  assert.equal(job.etaSeconds, 0);
  assert.equal(job.message, '安装包已下载');
  assert.equal(job.total, 9);
  assert.equal(job.received, 9);
  assert.deepEqual(calls.filter(call => ['mkdir', 'fetch', 'verify', 'rename'].includes(call[0])), [
    ['mkdir', '/updates/downloads', true],
    ['fetch', 'https://cdn.example.com/Mineradio.exe', 'Mineradio/1.1.1', 14000],
    ['verify', '/updates/downloads/Mineradio.exe.download', 'job-1'],
    ['rename', '/updates/downloads/Mineradio.exe.download', '/updates/downloads/Mineradio.exe'],
  ]);
});

test('downloadUpdateAssetWithMirrors tracks speed and waits for writer backpressure', async () => {
  const job = {
    id: 'job-speed',
    filePath: '/updates/downloads/Mineradio.exe',
    downloadCandidates: [{ url: 'https://mirror.example.com/Mineradio.exe', label: '镜像' }],
    expectedSize: 0,
    total: 0,
    received: 0,
  };
  let now = 1900000000000;
  const { calls, deps } = testDeps({
    backpressure: true,
    now() {
      now += 1000;
      return now;
    },
    async fetchWithTimeout() {
      return streamResponse([Buffer.from('abc'), Buffer.from('def')], 6);
    },
  });

  await downloadUpdateAssetWithMirrors(job, deps);

  assert.equal(job.speedBps > 0, true);
  assert.equal(calls.some(call => call[0] === 'speed'), true);
  assert.equal(calls.filter(call => call[0] === 'write').length, 2);
});

test('downloadUpdateAssetWithMirrors switches candidates and reports final failure', async () => {
  const job = {
    id: 'job-fail',
    filePath: '/updates/downloads/Mineradio.exe',
    downloadCandidates: [
      { url: 'https://mirror.example.com/Mineradio.exe', label: '镜像' },
      { url: 'https://direct.example.com/Mineradio.exe', label: '直连' },
    ],
    expectedSize: 0,
    total: 0,
    received: 0,
  };
  const { calls, deps, existing } = testDeps({
    async fetchWithTimeout(url) {
      if (url.includes('mirror')) return { ok: false, status: 503, headers: { get() { return ''; } } };
      throw Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' });
    },
  });
  existing.add('/updates/downloads/Mineradio.exe.download');

  await downloadUpdateAssetWithMirrors(job, deps);

  assert.equal(job.status, 'error');
  assert.deepEqual(job.failedAttempts, [
    { source: '镜像', reason: 'HTTP 503', detail: 'HTTP_503' },
    { source: '直连', reason: 'socket hang up', detail: 'ECONNRESET' },
  ]);
  assert.equal(job.message, '下载失败：socket hang up');
  assert.equal(calls.some(call => call[0] === 'setError' && call[2] === '下载失败：socket hang up'), true);
});
