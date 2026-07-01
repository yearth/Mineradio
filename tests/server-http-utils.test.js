const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createHttpServer,
  createRequestUrl,
  listenIfNeeded,
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

test('createHttpServer delegates to the provided HTTP factory with the request handler', () => {
  const calls = [];
  const handler = async () => {};
  const expectedServer = { emit() {} };
  const server = createHttpServer({
    createServer(requestHandler) {
      calls.push(requestHandler);
      return expectedServer;
    },
    requestHandler: handler
  });

  assert.equal(server, expectedServer);
  assert.deepEqual(calls, [handler]);
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

test('listenIfNeeded skips server listen under node:test', () => {
  const calls = [];
  const server = {
    listen(port, host, callback) {
      calls.push({ port, host, callback });
    }
  };

  const didListen = listenIfNeeded({
    server,
    env: { NODE_ENV: 'test' },
    port: 3000,
    host: '0.0.0.0',
    hasUserCookie: false,
    logger: { log(message) { calls.push({ message }); } }
  });

  assert.equal(didListen, false);
  assert.deepEqual(calls, []);
});

test('listenIfNeeded starts the server and logs the legacy startup banner', () => {
  const listenCalls = [];
  const logs = [];
  const server = {
    listen(port, host, callback) {
      listenCalls.push({ port, host });
      callback();
    }
  };

  const didListen = listenIfNeeded({
    server,
    env: { NODE_ENV: 'production' },
    port: '3001',
    host: '127.0.0.1',
    hasUserCookie: true,
    logger: { log(message) { logs.push(message); } }
  });

  assert.equal(didListen, true);
  assert.deepEqual(listenCalls, [{ port: '3001', host: '127.0.0.1' }]);
  assert.deepEqual(logs, startupBannerLines({ port: '3001', hasUserCookie: true }));
});
