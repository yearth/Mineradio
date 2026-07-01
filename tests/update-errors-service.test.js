const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyUpdateError,
  updateError,
} = require('../server-dist/server/services/update-errors');

test('updateError preserves code, fallback message, and cause', () => {
  const cause = new Error('root cause');
  const err = updateError('UPDATE_TIMEOUT', '', cause);

  assert.equal(err.message, 'UPDATE_TIMEOUT');
  assert.equal(err.code, 'UPDATE_TIMEOUT');
  assert.equal(err.cause, cause);
});

test('classifyUpdateError maps checksum, size, timeout, DNS, and network failures', () => {
  assert.deepEqual(classifyUpdateError(updateError('UPDATE_SHA256_MISMATCH', 'Downloaded sha256 mismatch')), {
    code: 'UPDATE_SHA256_MISMATCH',
    reason: '文件校验失败，可能是线路缓存异常，已拦截该安装包。',
    detail: 'Downloaded sha256 mismatch',
  });
  assert.deepEqual(classifyUpdateError(updateError('UPDATE_SIZE_MISMATCH', 'Expected 10 bytes, got 9')), {
    code: 'UPDATE_SIZE_MISMATCH',
    reason: '下载文件大小不一致，可能是网络中断或线路缓存不完整。',
    detail: 'Expected 10 bytes, got 9',
  });
  assert.equal(classifyUpdateError(new Error('AbortError timeout')).code, 'UPDATE_TIMEOUT');
  assert.equal(classifyUpdateError(new Error('getaddrinfo ENOTFOUND example.com')).code, 'UPDATE_DNS_FAILED');
  assert.equal(classifyUpdateError(new Error('socket hang up')).code, 'UPDATE_NETWORK_FAILED');
});

test('classifyUpdateError preserves legacy HTTP and generic fallbacks', () => {
  assert.deepEqual(classifyUpdateError(updateError('HTTP_403', 'HTTP 403')), {
    code: 'HTTP_403',
    reason: '更新线路返回 403，可能被限流或拦截。',
    detail: 'HTTP 403',
  });
  assert.deepEqual(classifyUpdateError(new Error('HTTP 404')), {
    code: 'UPDATE_HTTP_404',
    reason: '更新文件不存在，可能 release 资源还没有同步完成。',
    detail: 'HTTP 404',
  });
  assert.deepEqual(classifyUpdateError(new Error('HTTP 502')), {
    code: 'UPDATE_HTTP_5XX',
    reason: '更新线路服务器异常，请稍后重试。',
    detail: 'HTTP 502',
  });
  assert.deepEqual(classifyUpdateError(new Error('HTTP 418')), {
    code: 'UPDATE_HTTP_418',
    reason: '更新线路返回 HTTP 418。',
    detail: 'HTTP 418',
  });
  assert.deepEqual(classifyUpdateError('plain failure'), {
    code: 'UPDATE_FAILED',
    reason: '更新失败：plain failure',
    detail: 'plain failure',
  });
  assert.deepEqual(classifyUpdateError(null), {
    code: 'UPDATE_FAILED',
    reason: '更新失败：未知错误',
    detail: '未知错误',
  });
});

test('classifyUpdateError preserves legacy object message fallback semantics', () => {
  assert.deepEqual(classifyUpdateError({ code: 'HTTP_403', message: '' }), {
    code: 'HTTP_403',
    reason: '更新失败：[object Object]',
    detail: '[object Object]',
  });
  assert.deepEqual(classifyUpdateError({ code: 'ETIMEDOUT', message: 'timeout' }), {
    code: 'ETIMEDOUT',
    reason: '连接超时，当前网络到更新线路不稳定。',
    detail: 'timeout',
  });
});
