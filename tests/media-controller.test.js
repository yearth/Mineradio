const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handleMediaRoutes,
} = require('../server-dist/server/controllers/media-controller');

function streamFrom(chunks) {
  return {
    getReader() {
      const queue = chunks.slice();
      return {
        async read() {
          if (!queue.length) return { done: true };
          return { done: false, value: queue.shift() };
        },
      };
    },
  };
}

function createResponseRecorder() {
  const calls = [];
  return {
    res: {
      writeHead: (status, headers) => calls.push(['writeHead', status, headers]),
      write: chunk => calls.push(['write', chunk]),
      end: chunk => calls.push(['end', chunk]),
    },
    calls,
  };
}

function baseContext(overrides = {}) {
  const response = createResponseRecorder();
  const logs = [];
  return {
    ctx: {
      pathname: '/api/cover',
      url: new URL('http://127.0.0.1/api/cover?url=https%3A%2F%2Fimg.example%2Fcover.jpg'),
      req: { headers: {} },
      res: response.res,
      fetch: async () => ({
        status: 200,
        headers: {
          get: name => ({ 'content-type': 'image/png', 'content-length': '3' })[name.toLowerCase()] || '',
        },
        body: streamFrom(['abc']),
      }),
      audioProxyHeadersFor: (audioUrl, range, userAgent) => ({ audioUrl, range, userAgent }),
      audioContentTypeForUrl: (audioUrl, upstreamType) => upstreamType || audioUrl,
      userAgent: 'MineradioTest/1.0',
      logger: {
        error: (...args) => logs.push(args),
      },
      ...overrides,
    },
    calls: response.calls,
    logs,
  };
}

test('handleMediaRoutes rejects invalid cover URLs before fetching', async () => {
  let fetched = false;
  const { ctx, calls } = baseContext({
    url: new URL('http://127.0.0.1/api/cover?url=file%3A%2F%2F%2Fetc%2Fpasswd'),
    fetch: async () => {
      fetched = true;
      return {};
    },
  });

  const handled = await handleMediaRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(calls, [
    ['writeHead', 400, { 'Access-Control-Allow-Origin': '*' }],
    ['end', 'Invalid cover url'],
  ]);
  assert.equal(fetched, false);
});

test('handleMediaRoutes streams cover responses with legacy headers', async () => {
  const fetchCalls = [];
  const { ctx, calls } = baseContext({
    fetch: async (targetUrl, opts) => {
      fetchCalls.push({ targetUrl, opts });
      return {
        status: 206,
        headers: {
          get: name => ({ 'content-type': 'image/webp', 'content-length': '6' })[name.toLowerCase()] || '',
        },
        body: streamFrom(['abc', 'def']),
      };
    },
  });

  const handled = await handleMediaRoutes(ctx);

  assert.equal(handled, true);
  assert.deepEqual(fetchCalls, [{
    targetUrl: 'https://img.example/cover.jpg',
    opts: { headers: { 'User-Agent': 'MineradioTest/1.0', Referer: 'https://music.163.com/' } },
  }]);
  assert.deepEqual(calls, [
    ['writeHead', 206, {
      'Content-Type': 'image/webp',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'public, max-age=86400',
      'Content-Length': '6',
    }],
    ['write', 'abc'],
    ['write', 'def'],
    ['end', undefined],
  ]);
});

test('handleMediaRoutes handles audio missing url and streams ranges', async () => {
  const missing = baseContext({
    pathname: '/api/audio',
    url: new URL('http://127.0.0.1/api/audio'),
  });
  const handledMissing = await handleMediaRoutes(missing.ctx);

  assert.equal(handledMissing, true);
  assert.deepEqual(missing.calls, [
    ['writeHead', 400, undefined],
    ['end', 'Missing url'],
  ]);

  const fetchCalls = [];
  const success = baseContext({
    pathname: '/api/audio',
    url: new URL('http://127.0.0.1/api/audio?url=https%3A%2F%2Faudio.example%2Fsong.flac'),
    req: { headers: { range: 'bytes=0-99' } },
    fetch: async (targetUrl, opts) => {
      fetchCalls.push({ targetUrl, opts });
      return {
        status: 206,
        headers: {
          get: name => ({
            'content-type': 'audio/x-flac',
            'content-length': '6',
            'content-range': 'bytes 0-5/6',
          })[name.toLowerCase()] || '',
        },
        body: streamFrom(['abc', 'def']),
      };
    },
    audioProxyHeadersFor: (audioUrl, range, userAgent) => ({ Range: range, UA: userAgent, Url: audioUrl }),
    audioContentTypeForUrl: (audioUrl, upstreamType) => `mapped:${audioUrl}:${upstreamType}`,
  });
  const handledSuccess = await handleMediaRoutes(success.ctx);

  assert.equal(handledSuccess, true);
  assert.deepEqual(fetchCalls, [{
    targetUrl: 'https://audio.example/song.flac',
    opts: { headers: { Range: 'bytes=0-99', UA: 'MineradioTest/1.0', Url: 'https://audio.example/song.flac' } },
  }]);
  assert.deepEqual(success.calls, [
    ['writeHead', 206, {
      'Content-Type': 'mapped:https://audio.example/song.flac:audio/x-flac',
      'Access-Control-Allow-Origin': '*',
      'Accept-Ranges': 'bytes',
      'Content-Length': '6',
      'Content-Range': 'bytes 0-5/6',
    }],
    ['write', 'abc'],
    ['write', 'def'],
    ['end', undefined],
  ]);
});

test('handleMediaRoutes reports cover and audio fetch failures', async () => {
  const cover = baseContext({
    fetch: async () => {
      throw new Error('cover failed');
    },
  });
  const handledCover = await handleMediaRoutes(cover.ctx);

  assert.equal(handledCover, true);
  assert.deepEqual(cover.calls, [
    ['writeHead', 500, undefined],
    ['end', undefined],
  ]);
  assert.equal(cover.logs[0][0], '[Cover]');

  const audio = baseContext({
    pathname: '/api/audio',
    url: new URL('http://127.0.0.1/api/audio?url=https%3A%2F%2Faudio.example%2Ffail.mp3'),
    fetch: async () => {
      throw new Error('audio failed');
    },
  });
  const handledAudio = await handleMediaRoutes(audio.ctx);

  assert.equal(handledAudio, true);
  assert.deepEqual(audio.calls, [
    ['writeHead', 500, undefined],
    ['end', undefined],
  ]);
  assert.equal(audio.logs[0][0], '[Audio]');
});

test('handleMediaRoutes ignores unrelated paths', async () => {
  const { ctx, calls } = baseContext({
    pathname: '/api/search',
  });

  const handled = await handleMediaRoutes(ctx);

  assert.equal(handled, false);
  assert.deepEqual(calls, []);
});
