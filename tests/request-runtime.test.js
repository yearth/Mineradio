const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createRequestRuntime,
} = require('../server-dist/server/runtime/request-runtime');

test('createRequestRuntime delegates to the base requester until an override is installed', async () => {
  const calls = [];
  const runtime = createRequestRuntime({
    requestText: async (targetUrl, opts, body) => {
      calls.push(['base', targetUrl, opts, body]);
      return 'base-response';
    },
  });

  assert.equal(await runtime.requestText('https://example.test/a', { header: 'x' }, 'body'), 'base-response');
  assert.deepEqual(calls, [
    ['base', 'https://example.test/a', { header: 'x' }, 'body'],
  ]);

  runtime.setRequestText(async (targetUrl, opts, body) => {
    calls.push(['override', targetUrl, opts, body]);
    return 'override-response';
  });

  assert.equal(await runtime.requestText('https://example.test/b'), 'override-response');
  assert.deepEqual(calls[1], ['override', 'https://example.test/b', {}, undefined]);
});

test('createRequestRuntime reset clears the override', async () => {
  const runtime = createRequestRuntime({
    requestText: async () => 'base',
  });

  runtime.setRequestText(async () => 'override');
  assert.equal(await runtime.requestText('https://example.test'), 'override');

  runtime.reset();

  assert.equal(await runtime.requestText('https://example.test'), 'base');
});
