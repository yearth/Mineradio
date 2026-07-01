const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createRequestUrl,
  shouldAutoListen,
  startupBannerLines
} = require('../server-dist/server/http-utils');

test('createRequestUrl resolves request URLs against the local server port', () => {
  const url = createRequestUrl('/api/search?keywords=rain', 5000);

  assert.equal(url.href, 'http://localhost:5000/api/search?keywords=rain');
  assert.equal(url.pathname, '/api/search');
  assert.equal(url.searchParams.get('keywords'), 'rain');
});

test('createRequestUrl preserves legacy URL coercion for empty and undefined request URLs', () => {
  assert.equal(createRequestUrl('', 5000).pathname, '/');
  assert.equal(createRequestUrl(undefined, 5000).pathname, '/undefined');
});

test('shouldAutoListen disables the server listener under node:test', () => {
  assert.equal(shouldAutoListen({ NODE_ENV: 'test' }), false);
  assert.equal(shouldAutoListen({ NODE_ENV: 'production' }), true);
  assert.equal(shouldAutoListen({}), true);
});

test('startupBannerLines keeps the legacy startup text stable', () => {
  assert.deepEqual(startupBannerLines({ port: 5000, hasUserCookie: true }), [
    '======================================================',
    ' 粒子音乐可视化 v2  →  http://localhost:5000',
    ' 登录态: 已登录(cookie已加载)',
    '======================================================'
  ]);

  assert.equal(startupBannerLines({ port: 5000, hasUserCookie: false })[2], ' 登录态: 未登录');
});
