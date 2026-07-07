const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createApiJson,
  createAbortControllerStub,
} = require('../public/renderer/core/api-client');

test('apiJson returns parsed JSON and forwards fetch options without timeoutMs', async () => {
  const calls = [];
  const apiJson = createApiJson({
    fetch: async (url, opts) => {
      calls.push({ url, opts });
      return { json: async () => ({ ok: true, url, method: opts.method }) };
    },
  });

  const data = await apiJson('/api/search', { method: 'POST', timeoutMs: 1200, headers: { accept: 'json' } });

  assert.deepEqual(data, { ok: true, url: '/api/search', method: 'POST' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].opts.method, 'POST');
  assert.equal(calls[0].opts.timeoutMs, undefined);
  assert.deepEqual(calls[0].opts.headers, { accept: 'json' });
});

test('apiJson attaches an abort signal only when timeout is requested and no signal exists', async () => {
  const AbortController = createAbortControllerStub();
  let timeoutCallback;
  let cleared = false;
  let receivedSignal;
  const apiJson = createApiJson({
    AbortController,
    setTimeout(fn, ms) {
      timeoutCallback = { fn, ms };
      return 'timer-1';
    },
    clearTimeout(timer) {
      if (timer === 'timer-1') cleared = true;
    },
    fetch: async (url, opts) => {
      receivedSignal = opts.signal;
      return { json: async () => ({ ok: true }) };
    },
  });

  await apiJson('/api/version', { timeoutMs: 250 });
  timeoutCallback.fn();

  assert.equal(timeoutCallback.ms, 250);
  assert.equal(receivedSignal.aborted, true);
  assert.equal(cleared, true);
});

test('apiJson keeps caller-provided signal and clears timeout after failures', async () => {
  const callerSignal = { caller: true };
  let cleared = false;
  const apiJson = createApiJson({
    AbortController: createAbortControllerStub(),
    setTimeout() {
      throw new Error('timer should not be created');
    },
    clearTimeout() {
      cleared = true;
    },
    fetch: async (url, opts) => {
      assert.equal(opts.signal, callerSignal);
      throw new Error('network down');
    },
  });

  await assert.rejects(
    () => apiJson('/api/fail', { timeoutMs: 500, signal: callerSignal }),
    /network down/
  );
  assert.equal(cleared, false);
});
