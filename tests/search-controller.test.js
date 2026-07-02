const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handleSearchRoutes,
} = require('../server-dist/server/controllers/search-controller');

function baseContext(overrides = {}) {
  const calls = [];
  return {
    calls,
    ctx: {
      pathname: '/api/search',
      url: new URL('http://localhost/api/search?keywords=rain&limit=7'),
      res: 'res',
      sendJSON: (res, data, status) => calls.push({ res, data, status }),
      handleSearch: async (keywords, limit) => [{ keywords, limit }],
      logger: { error: (...args) => calls.push({ log: args }) },
      ...overrides,
    },
  };
}

test('handleSearchRoutes handles legacy search query mapping', async () => {
  const { calls, ctx } = baseContext();

  assert.equal(await handleSearchRoutes(ctx), true);
  assert.deepEqual(calls, [{
    res: 'res',
    data: { songs: [{ keywords: 'rain', limit: 7 }] },
    status: undefined,
  }]);
});

test('handleSearchRoutes preserves default limit parsing and blank keywords', async () => {
  const { calls, ctx } = baseContext({
    url: new URL('http://localhost/api/search'),
  });

  assert.equal(await handleSearchRoutes(ctx), true);
  assert.deepEqual(calls[0].data, { songs: [{ keywords: '', limit: 20 }] });
});

test('handleSearchRoutes preserves legacy parseInt limit behavior', async () => {
  const { calls, ctx } = baseContext({
    url: new URL('http://localhost/api/search?keywords=rain&limit=0x10'),
  });

  assert.equal(await handleSearchRoutes(ctx), true);
  assert.deepEqual(calls[0].data, { songs: [{ keywords: 'rain', limit: 16 }] });
});

test('handleSearchRoutes reports search failures with legacy fallback', async () => {
  const err = new Error('search failed');
  const { calls, ctx } = baseContext({
    handleSearch: async () => { throw err; },
  });

  assert.equal(await handleSearchRoutes(ctx), true);
  assert.deepEqual(calls, [
    { log: ['[Search]', err] },
    { res: 'res', data: { error: 'search failed', songs: [] }, status: 500 },
  ]);
});

test('handleSearchRoutes ignores unrelated paths', async () => {
  const { calls, ctx } = baseContext({
    pathname: '/api/qq/search',
    handleSearch: async () => {
      throw new Error('unexpected');
    },
  });

  assert.equal(await handleSearchRoutes(ctx), false);
  assert.deepEqual(calls, []);
});
