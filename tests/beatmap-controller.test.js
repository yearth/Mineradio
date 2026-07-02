const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handleBeatmapRoutes,
} = require('../server-dist/server/controllers/beatmap-controller');

function baseContext(overrides = {}) {
  const calls = [];
  return {
    calls,
    ctx: {
      pathname: '/api/beatmap/cache/status',
      url: new URL('http://localhost/api/beatmap/cache/status'),
      req: { method: 'GET' },
      res: 'res',
      sendJSON: (res, data, status) => calls.push({ res, data, status }),
      readRequestBody: async () => ({ key: 'song-key', map: { beats: [] } }),
      beatCacheRootInfo: () => ({
        allowed: true,
        available: true,
        dir: '/tmp/cache',
        drive: '/',
      }),
      readBeatMapCache: () => null,
      writeBeatMapCache: body => ({ ok: true, key: body.key, savedAt: 123 }),
      ...overrides,
    },
  };
}

test('handleBeatmapRoutes reports beatmap cache status', async () => {
  const { calls, ctx } = baseContext();

  const handled = await handleBeatmapRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls, [{
    res: 'res',
    data: {
      enabled: true,
      dir: '/tmp/cache',
      drive: '/',
      reason: '',
      mode: 'disk',
    },
    status: undefined,
  }]);
});

test('handleBeatmapRoutes reports disabled cache status reasons', async () => {
  const { calls, ctx } = baseContext({
    beatCacheRootInfo: () => ({
      allowed: false,
      available: false,
      dir: '/tmp/cache',
      drive: '/',
    }),
  });

  const handled = await handleBeatmapRoutes(ctx);

  assert.equal(handled, true);
  assert.equal(calls[0].data.enabled, false);
  assert.equal(calls[0].data.reason, 'C_DRIVE_DISABLED');
  assert.equal(calls[0].data.mode, 'memory-only');
});

test('handleBeatmapRoutes reads cache misses and hits', async () => {
  const miss = baseContext({
    pathname: '/api/beatmap/cache',
    url: new URL('http://localhost/api/beatmap/cache?key=missing'),
  });

  assert.equal(await handleBeatmapRoutes(miss.ctx), true);
  assert.deepEqual(miss.calls, [{
    res: 'res',
    data: { ok: true, hit: false, key: 'missing' },
    status: undefined,
  }]);

  const hit = baseContext({
    pathname: '/api/beatmap/cache',
    url: new URL('http://localhost/api/beatmap/cache?key=hit'),
    readBeatMapCache: key => ({ key, map: { beats: [1] } }),
  });

  assert.equal(await handleBeatmapRoutes(hit.ctx), true);
  assert.deepEqual(hit.calls, [{
    res: 'res',
    data: { ok: true, hit: true, key: 'hit', map: { beats: [1] }, meta: {}, savedAt: 0 },
    status: undefined,
  }]);
});

test('handleBeatmapRoutes reports cache read failures with legacy memory-only payload', async () => {
  const err = new Error('blocked');
  err.code = 'BEAT_CACHE_BLOCKED';
  err.info = { dir: '/blocked/cache' };
  const { calls, ctx } = baseContext({
    pathname: '/api/beatmap/cache',
    url: new URL('http://localhost/api/beatmap/cache?key=blocked'),
    readBeatMapCache: () => { throw err; },
  });

  const handled = await handleBeatmapRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls, [{
    res: 'res',
    data: {
      ok: false,
      hit: false,
      enabled: false,
      mode: 'memory-only',
      key: 'blocked',
      reason: 'BEAT_CACHE_BLOCKED',
      dir: '/blocked/cache',
    },
    status: undefined,
  }]);
});

test('handleBeatmapRoutes writes cache entries and reports write failures', async () => {
  const saved = baseContext({
    pathname: '/api/beatmap/cache',
    req: { method: 'POST' },
  });

  assert.equal(await handleBeatmapRoutes(saved.ctx), true);
  assert.deepEqual(saved.calls, [{
    res: 'res',
    data: { ok: true, key: 'song-key', savedAt: 123 },
    status: undefined,
  }]);

  const err = new Error('disk read-only');
  const failed = baseContext({
    pathname: '/api/beatmap/cache',
    req: { method: 'POST' },
    readRequestBody: async () => { throw err; },
  });

  assert.equal(await handleBeatmapRoutes(failed.ctx), true);
  assert.deepEqual(failed.calls, [{
    res: 'res',
    data: {
      ok: false,
      enabled: false,
      mode: 'memory-only',
      reason: 'disk read-only',
      dir: '/tmp/cache',
    },
    status: undefined,
  }]);
});

test('handleBeatmapRoutes handles unsupported methods and unrelated paths', async () => {
  const method = baseContext({
    pathname: '/api/beatmap/cache',
    req: { method: 'DELETE' },
  });

  assert.equal(await handleBeatmapRoutes(method.ctx), true);
  assert.deepEqual(method.calls, [{
    res: 'res',
    data: { ok: false, error: 'METHOD_NOT_ALLOWED' },
    status: 405,
  }]);

  const unrelated = baseContext({ pathname: '/api/search' });

  assert.equal(await handleBeatmapRoutes(unrelated.ctx), false);
  assert.deepEqual(unrelated.calls, []);
});
