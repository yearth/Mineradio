const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handleDiscoverRoutes,
} = require('../server-dist/server/controllers/discover-controller');

function baseContext(overrides = {}) {
  const calls = [];
  return {
    calls,
    ctx: {
      pathname: '/api/discover/home',
      res: 'res',
      sendJSON: (res, data, status) => calls.push({ res, data, status }),
      handleDiscoverHome: async () => ({ loggedIn: true, dailySongs: [{ id: 1 }] }),
      logger: { error: (...args) => calls.push({ log: args }) },
      ...overrides,
    },
  };
}

test('handleDiscoverRoutes handles discover home with legacy payload', async () => {
  const { calls, ctx } = baseContext();

  const handled = await handleDiscoverRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls, [{
    res: 'res',
    data: { loggedIn: true, dailySongs: [{ id: 1 }] },
    status: undefined,
  }]);
});

test('handleDiscoverRoutes reports discover home failures with legacy fallback', async () => {
  const err = new Error('discover failed');
  const { calls, ctx } = baseContext({
    handleDiscoverHome: async () => { throw err; },
  });

  const handled = await handleDiscoverRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls, [
    { log: ['[DiscoverHome]', err] },
    {
      res: 'res',
      data: {
        error: 'discover failed',
        loggedIn: false,
        dailySongs: [],
        playlists: [],
        podcasts: [],
      },
      status: 500,
    },
  ]);
});

test('handleDiscoverRoutes ignores unrelated paths', async () => {
  const { calls, ctx } = baseContext({
    pathname: '/api/search',
    handleDiscoverHome: async () => {
      throw new Error('unexpected');
    },
  });

  const handled = await handleDiscoverRoutes(ctx);

  assert.equal(handled, false);
  assert.deepEqual(calls, []);
});
