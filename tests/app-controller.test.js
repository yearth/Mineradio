const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handleAppRoutes,
} = require('../server-dist/server/controllers/app-controller');

test('handleAppRoutes handles app version and sends legacy payload', async () => {
  const calls = [];
  const handled = await handleAppRoutes({
    pathname: '/api/app/version',
    res: 'res',
    sendJSON: (res, data, status) => calls.push({ res, data, status }),
    packageInfo: { name: 'mineradio', version: '1.1.1' },
    appVersion: '1.1.1',
    updateConfig: { provider: 'github' },
    buildAppVersionPayload: opts => ({ ok: true, opts }),
  });

  assert.equal(handled, true);
  assert.deepEqual(calls, [{
    res: 'res',
    data: {
      ok: true,
      opts: {
        packageInfo: { name: 'mineradio', version: '1.1.1' },
        appVersion: '1.1.1',
        updateConfig: { provider: 'github' },
      },
    },
    status: undefined,
  }]);
});

test('handleAppRoutes ignores unrelated paths', async () => {
  const calls = [];
  const handled = await handleAppRoutes({
    pathname: '/api/search',
    res: 'res',
    sendJSON: () => calls.push('unexpected'),
    packageInfo: {},
    appVersion: '1.1.1',
    updateConfig: {},
    buildAppVersionPayload: () => ({}),
  });

  assert.equal(handled, false);
  assert.deepEqual(calls, []);
});
