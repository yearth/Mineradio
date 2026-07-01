const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const {
  createHttpServer,
  createRequestHandler,
  createRequestUrl,
  listenIfNeeded,
  readRequestBody,
  sendJson,
  shouldAutoListen,
  startupBannerLines
} = require('../server-dist/server/http-utils');

function createBodyRequest(chunks = []) {
  const req = new EventEmitter();
  req.destroyed = false;
  req.destroy = () => {
    req.destroyed = true;
  };

  queueMicrotask(() => {
    chunks.forEach(chunk => req.emit('data', chunk));
    req.emit('end');
  });

  return req;
}

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

test('createRequestHandler resolves the request URL before delegating', async () => {
  const calls = [];
  const req = { url: '/api/search?keywords=rain' };
  const res = {};
  const handler = createRequestHandler({
    port: 5000,
    handleRequest(context) {
      calls.push(context);
      return 'handled';
    }
  });

  const result = await handler(req, res);

  assert.equal(result, 'handled');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].req, req);
  assert.equal(calls[0].res, res);
  assert.equal(calls[0].url.href, 'http://localhost:5000/api/search?keywords=rain');
  assert.equal(calls[0].pathname, '/api/search');
});

test('sendJson writes legacy JSON headers and body', () => {
  const calls = [];
  const res = {
    writeHead(status, headers) {
      calls.push({ status, headers });
    },
    end(body) {
      calls.push({ body });
    }
  };

  sendJson(res, { ok: true }, 201);

  assert.equal(calls[0].status, 201);
  assert.equal(calls[0].headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(calls[0].headers['Access-Control-Allow-Origin'], '*');
  assert.equal(calls[0].headers['Cache-Control'], 'no-store, no-cache, must-revalidate, proxy-revalidate');
  assert.equal(calls[0].headers.Pragma, 'no-cache');
  assert.equal(calls[0].headers.Expires, '0');
  assert.equal(calls[1].body, '{"ok":true}');
});

test('readRequestBody parses JSON request bodies', async () => {
  const body = await readRequestBody(createBodyRequest(['{"cookie":"MUSIC_U=abc"}']));

  assert.deepEqual(body, { cookie: 'MUSIC_U=abc' });
});

test('readRequestBody falls back to form fields for non-JSON bodies', async () => {
  const body = await readRequestBody(createBodyRequest(['cookie=MUSIC_U%3Dabc&token=qq']));

  assert.deepEqual(body, { cookie: 'MUSIC_U=abc', token: 'qq' });
});

test('readRequestBody preserves empty and errored body fallbacks', async () => {
  const emptyBody = await readRequestBody(createBodyRequest());
  const errorReq = new EventEmitter();
  const errorBodyPromise = readRequestBody(errorReq);

  errorReq.emit('error', new Error('socket closed'));

  assert.deepEqual(emptyBody, {});
  assert.deepEqual(await errorBodyPromise, {});
});

test('readRequestBody destroys oversized request bodies', async () => {
  const req = createBodyRequest([Buffer.alloc(8 * 1024 * 1024 + 1, 'x')]);

  await readRequestBody(req);

  assert.equal(req.destroyed, true);
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
