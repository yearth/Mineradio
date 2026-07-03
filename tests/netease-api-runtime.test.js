const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createNeteaseApiRuntime,
} = require('../server-dist/server/runtime/netease-api-runtime');

test('createNeteaseApiRuntime preserves defaults, overrides, and reset behavior', async () => {
  const calls = [];
  const defaults = {
    search: async opts => {
      calls.push(['default-search', opts]);
      return { source: 'default-search' };
    },
    cloudsearch: async opts => {
      calls.push(['default-cloudsearch', opts]);
      return { source: 'default-cloudsearch' };
    },
  };
  const runtime = createNeteaseApiRuntime(defaults);

  assert.equal(await runtime.current().search({ keywords: 'rain' }).then(r => r.source), 'default-search');

  runtime.apply({
    search: async opts => {
      calls.push(['override-search', opts]);
      return { source: 'override-search' };
    },
  });

  assert.equal(await runtime.current().search({ keywords: 'sun' }).then(r => r.source), 'override-search');
  assert.equal(await runtime.current().cloudsearch({ keywords: 'wind' }).then(r => r.source), 'default-cloudsearch');

  runtime.apply();

  assert.equal(await runtime.current().search({ keywords: 'reset' }).then(r => r.source), 'default-search');
  assert.deepEqual(calls.map(call => call[0]), [
    'default-search',
    'override-search',
    'default-cloudsearch',
    'default-search',
  ]);
});

test('createNeteaseApiRuntime treats null overrides like legacy reset', () => {
  const defaults = { logout: async () => ({ ok: true }) };
  const runtime = createNeteaseApiRuntime(defaults);

  runtime.apply({ logout: async () => ({ ok: false }) });
  assert.notEqual(runtime.current().logout, defaults.logout);

  runtime.apply(null);
  assert.equal(runtime.current().logout, defaults.logout);
});
