const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeApiCode,
  normalizeApiMessage,
} = require('../server-dist/server/services/provider-response');

test('normalizeApiCode preserves provider response code precedence', () => {
  assert.equal(normalizeApiCode({ body: { code: 200 }, status: 500 }), 200);
  assert.equal(normalizeApiCode({ body: { body: { code: 401 } }, status: 500 }), 401);
  assert.equal(normalizeApiCode({ code: 409 }), 409);
  assert.equal(normalizeApiCode({ status: 503 }), 503);
  assert.equal(normalizeApiCode(null), 0);
});

test('normalizeApiMessage preserves provider message precedence and fallback', () => {
  assert.equal(normalizeApiMessage({ body: { message: 'message wins', msg: 'msg' } }), 'message wins');
  assert.equal(normalizeApiMessage({ body: { msg: 'msg wins', error: 'error' } }), 'msg wins');
  assert.equal(normalizeApiMessage({ body: { error: 'error wins' } }), 'error wins');
  assert.equal(normalizeApiMessage({ body: { body: { msg: 'nested msg' } } }), 'nested msg');
  assert.equal(normalizeApiMessage({ body: { body: { error: 'nested error' } } }), 'nested error');
  assert.equal(normalizeApiMessage(null), '');
});
