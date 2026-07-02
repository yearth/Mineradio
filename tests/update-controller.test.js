const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handleUpdateRoutes,
} = require('../server-dist/server/controllers/update-controller');

function baseContext(overrides = {}) {
  const jobs = new Map([
    ['old', { id: 'old', mode: 'installer', createdAt: 10 }],
    ['new', { id: 'new', mode: 'installer', createdAt: 20 }],
    ['patch', { id: 'patch', mode: 'patch', createdAt: 30 }],
  ]);
  const calls = [];
  return {
    calls,
    jobs,
    ctx: {
      pathname: '/api/update/latest',
      url: new URL('http://localhost/api/update/latest'),
      res: 'res',
      sendJSON: (res, data, status) => calls.push({ res, data, status }),
      fetchLatestUpdateInfo: async () => ({ ok: true, version: '1.2.0' }),
      localUpdateFallback: (message, options) => ({ ok: true, fallback: true, message, options }),
      updateConfig: { configured: true },
      startUpdateDownloadJob: info => ({ ok: true, mode: 'installer', info }),
      startUpdatePatchJob: info => ({ ok: true, mode: 'patch', info }),
      updateDownloadJobs: jobs,
      publicUpdateJob: job => (job ? { ok: true, id: job.id, mode: job.mode } : { ok: false, error: 'UPDATE_JOB_NOT_FOUND' }),
      logger: { error: (...args) => calls.push({ log: args }) },
      ...overrides,
    },
  };
}

test('handleUpdateRoutes returns latest update info and fallback check payloads', async () => {
  const latest = baseContext();

  assert.equal(await handleUpdateRoutes(latest.ctx), true);
  assert.deepEqual(latest.calls, [{
    res: 'res',
    data: { ok: true, version: '1.2.0' },
    status: undefined,
  }]);

  const err = new Error('network down');
  const fallback = baseContext({
    fetchLatestUpdateInfo: async () => { throw err; },
  });

  assert.equal(await handleUpdateRoutes(fallback.ctx), true);
  assert.deepEqual(fallback.calls, [{
    res: 'res',
    data: {
      ok: true,
      fallback: true,
      message: 'network down',
      options: { configured: true },
      error: 'network down',
    },
    status: undefined,
  }]);
});

test('handleUpdateRoutes starts installer and patch jobs with legacy status codes', async () => {
  const download = baseContext({ pathname: '/api/update/download' });

  assert.equal(await handleUpdateRoutes(download.ctx), true);
  assert.deepEqual(download.calls, [{
    res: 'res',
    data: { ok: true, mode: 'installer', info: { ok: true, version: '1.2.0' } },
    status: 200,
  }]);

  const patch = baseContext({ pathname: '/api/update/patch' });

  assert.equal(await handleUpdateRoutes(patch.ctx), true);
  assert.deepEqual(patch.calls, [{
    res: 'res',
    data: { ok: true, mode: 'patch', info: { ok: true, version: '1.2.0' } },
    status: 200,
  }]);

  const rejected = baseContext({
    pathname: '/api/update/download',
    startUpdateDownloadJob: () => ({ ok: false, error: 'NO_UPDATE_AVAILABLE' }),
  });

  assert.equal(await handleUpdateRoutes(rejected.ctx), true);
  assert.deepEqual(rejected.calls[0], {
    res: 'res',
    data: { ok: false, error: 'NO_UPDATE_AVAILABLE' },
    status: 400,
  });
});

test('handleUpdateRoutes reports start failures for installer and patch jobs', async () => {
  const downloadErr = new Error('download failed');
  const download = baseContext({
    pathname: '/api/update/download',
    fetchLatestUpdateInfo: async () => { throw downloadErr; },
  });

  assert.equal(await handleUpdateRoutes(download.ctx), true);
  assert.deepEqual(download.calls, [
    { log: ['[UpdateDownload]', downloadErr] },
    { res: 'res', data: { ok: false, error: 'download failed' }, status: 500 },
  ]);

  const patchErr = new Error('patch failed');
  const patch = baseContext({
    pathname: '/api/update/patch',
    fetchLatestUpdateInfo: async () => { throw patchErr; },
  });

  assert.equal(await handleUpdateRoutes(patch.ctx), true);
  assert.deepEqual(patch.calls, [
    { log: ['[UpdatePatch]', patchErr] },
    { res: 'res', data: { ok: false, error: 'patch failed' }, status: 500 },
  ]);
});

test('handleUpdateRoutes returns installer and patch status by id or latest job fallback', async () => {
  const byId = baseContext({
    pathname: '/api/update/download/status',
    url: new URL('http://localhost/api/update/download/status?id=old'),
  });

  assert.equal(await handleUpdateRoutes(byId.ctx), true);
  assert.deepEqual(byId.calls, [{
    res: 'res',
    data: { ok: true, id: 'old', mode: 'installer' },
    status: 200,
  }]);

  const latest = baseContext({
    pathname: '/api/update/download/status',
    url: new URL('http://localhost/api/update/download/status'),
  });

  assert.equal(await handleUpdateRoutes(latest.ctx), true);
  assert.deepEqual(latest.calls[0], {
    res: 'res',
    data: { ok: true, id: 'patch', mode: 'patch' },
    status: 200,
  });

  const patch = baseContext({
    pathname: '/api/update/patch/status',
    url: new URL('http://localhost/api/update/patch/status'),
  });

  assert.equal(await handleUpdateRoutes(patch.ctx), true);
  assert.deepEqual(patch.calls[0], {
    res: 'res',
    data: { ok: true, id: 'patch', mode: 'patch' },
    status: 200,
  });
});

test('handleUpdateRoutes returns missing status and ignores unrelated paths', async () => {
  const missing = baseContext({
    pathname: '/api/update/download/status',
    url: new URL('http://localhost/api/update/download/status?id=missing'),
  });

  assert.equal(await handleUpdateRoutes(missing.ctx), true);
  assert.deepEqual(missing.calls, [{
    res: 'res',
    data: { ok: false, error: 'UPDATE_JOB_NOT_FOUND' },
    status: 404,
  }]);

  const unrelated = baseContext({ pathname: '/api/search' });

  assert.equal(await handleUpdateRoutes(unrelated.ctx), false);
  assert.deepEqual(unrelated.calls, []);
});
