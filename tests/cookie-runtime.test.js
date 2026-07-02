const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createCookieRuntime,
} = require('../server-dist/server/runtime/cookie-runtime');

function memoryFs(initial = {}) {
  const files = new Map(Object.entries(initial));
  const writes = [];
  return {
    writes,
    existsSync(filePath) {
      return files.has(filePath);
    },
    readFileSync(filePath) {
      return files.get(filePath);
    },
    writeFileSync(filePath, value) {
      writes.push([filePath, value]);
      files.set(filePath, value);
    },
  };
}

test('createCookieRuntime reads initial cookies and saves normalized values', () => {
  const fs = memoryFs({
    '/netease.cookie': '  MUSIC_U=old; __csrf=token  ',
    '/qq.cookie': ' uin=12345; qm_keyst=key ',
  });
  const runtime = createCookieRuntime({
    fs,
    userCookieFile: '/netease.cookie',
    qqCookieFile: '/qq.cookie',
    normalizeCookieHeader: value => String(value || '').trim().replace(/^raw:/, ''),
    rawCookieFallback: value => `fallback:${value}`,
  });

  assert.equal(runtime.userCookie(), 'MUSIC_U=old; __csrf=token');
  assert.equal(runtime.qqCookie(), 'uin=12345; qm_keyst=key');

  runtime.saveCookie(' MUSIC_U=new ');
  runtime.saveQQCookie(' uin=67890 ');

  assert.equal(runtime.userCookie(), 'MUSIC_U=new');
  assert.equal(runtime.qqCookie(), 'uin=67890');
  assert.deepEqual(fs.writes, [
    ['/netease.cookie', 'MUSIC_U=new'],
    ['/qq.cookie', 'uin=67890'],
  ]);
});

test('createCookieRuntime preserves raw fallback, reset, and silent IO failures', () => {
  const failingFs = {
    existsSync() { return true; },
    readFileSync() { throw new Error('read failed'); },
    writeFileSync() { throw new Error('write failed'); },
  };
  const runtime = createCookieRuntime({
    fs: failingFs,
    userCookieFile: '/netease.cookie',
    qqCookieFile: '/qq.cookie',
    normalizeCookieHeader: () => '',
    rawCookieFallback: value => String(value || '').trim(),
  });

  assert.equal(runtime.userCookie(), '');
  assert.equal(runtime.qqCookie(), '');

  runtime.saveCookie(' raw user ');
  runtime.saveQQCookie(' raw qq ');

  assert.equal(runtime.userCookie(), 'raw user');
  assert.equal(runtime.qqCookie(), 'raw qq');

  runtime.reset();

  assert.equal(runtime.userCookie(), '');
  assert.equal(runtime.qqCookie(), '');
});
