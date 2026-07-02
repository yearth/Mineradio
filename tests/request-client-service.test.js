const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
  requestJson,
  requestText,
} = require('../server-dist/server/services/request-client');

test('requestText preserves method, headers, body, and HTTP error metadata', async () => {
  const received = [];
  const upstream = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      received.push({
        method: req.method,
        token: req.headers['x-test-token'],
        body,
      });
      if (req.url === '/fail') {
        res.writeHead(503, { 'content-type': 'text/plain' });
        res.end('temporarily unavailable');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok:' + body);
    });
  });

  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const { port } = upstream.address();
  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    const text = await requestText(baseUrl + '/echo', {
      method: 'POST',
      headers: { 'x-test-token': 'abc123' },
    }, 'payload');

    assert.equal(text, 'ok:payload');
    assert.deepEqual(received[0], {
      method: 'POST',
      token: 'abc123',
      body: 'payload',
    });

    await assert.rejects(
      requestText(baseUrl + '/fail'),
      err => {
        assert.equal(err.message, 'HTTP 503');
        assert.equal(err.statusCode, 503);
        assert.equal(err.body, 'temporarily unavailable');
        return true;
      }
    );
  } finally {
    await new Promise(resolve => upstream.close(resolve));
  }
});

test('requestJson preserves parsed JSON and invalid JSON errors', async () => {
  const upstream = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(req.url === '/bad' ? '{' : '{"ok":true}');
  });

  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const { port } = upstream.address();
  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    assert.deepEqual(await requestJson(baseUrl + '/ok'), { ok: true });
    await assert.rejects(
      requestJson(baseUrl + '/bad'),
      err => {
        assert.equal(err.message, 'Invalid JSON from ' + baseUrl + '/bad');
        assert.equal(err.cause instanceof Error, true);
        return true;
      }
    );
  } finally {
    await new Promise(resolve => upstream.close(resolve));
  }
});
