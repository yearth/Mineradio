const test = require('node:test');
const assert = require('node:assert/strict');

const {
  checkNeteaseQrLogin,
  loginWithNeteaseCookie,
} = require('../server-dist/server/services/netease-auth-orchestration');

test('loginWithNeteaseCookie normalizes and saves valid cookies before resolving login info', async () => {
  const calls = [];
  let cookie = '';

  const result = await loginWithNeteaseCookie(' MUSIC_U=secret; __csrf=token ', {
    normalizeCookieHeader: raw => String(raw).trim(),
    parseCookieString: raw => Object.fromEntries(String(raw).split(';').map(part => part.trim().split('='))),
    saveCookie: value => {
      cookie = value;
      calls.push(['saveCookie', value]);
    },
    getUserCookie: () => cookie,
    getLoginInfo: async () => {
      calls.push(['getLoginInfo']);
      return { loggedIn: true, userId: 7 };
    },
    pendingNeteaseLoginInfo: () => ({ loggedIn: true, pendingProfile: true }),
  });

  assert.deepEqual(result, {
    loggedIn: true,
    userId: 7,
    saved: true,
    hasCookie: true,
  });
  assert.deepEqual(calls, [
    ['saveCookie', 'MUSIC_U=secret; __csrf=token'],
    ['getLoginInfo'],
  ]);
});

test('loginWithNeteaseCookie rejects cookie payloads without MUSIC_U', async () => {
  await assert.rejects(
    loginWithNeteaseCookie('NMTID=token', {
      normalizeCookieHeader: raw => String(raw).trim(),
      parseCookieString: raw => Object.fromEntries(String(raw).split(';').map(part => part.trim().split('='))),
      saveCookie: () => {
        throw new Error('saveCookie should not be called');
      },
      getUserCookie: () => '',
      getLoginInfo: async () => ({ loggedIn: false }),
      pendingNeteaseLoginInfo: () => ({ loggedIn: true }),
    }),
    Object.assign(new Error('网易云 cookie 缺少 MUSIC_U'), {
      code: 'INVALID_NETEASE_COOKIE',
      status: 400,
    })
  );
});

test('checkNeteaseQrLogin retries for cookie, saves it, and returns refreshed login info', async () => {
  const calls = [];
  let cookie = '';

  const result = await checkNeteaseQrLogin('qr-key', {
    loginQrCheck: async opts => {
      calls.push(['loginQrCheck', opts]);
      if (opts.noCookie) {
        return { body: { code: 803, message: 'ok' } };
      }
      return { body: { code: 803, message: 'ok', cookie: 'MUSIC_U=qr; __csrf=csrf' } };
    },
    readCookieFromResponse: response => response.body && response.body.cookie,
    saveCookie: value => {
      cookie = value;
      calls.push(['saveCookie', value]);
    },
    getLoginInfo: async () => {
      calls.push(['getLoginInfo']);
      return { loggedIn: true, userId: 8 };
    },
    normalizeLoginInfo: () => ({ loggedIn: false }),
    pendingNeteaseLoginInfo: () => ({ loggedIn: true, pendingProfile: true }),
    now: () => 123,
    logger: { warn: (...args) => calls.push(['warn', args]) },
  });

  assert.deepEqual(result, {
    code: 803,
    message: 'ok',
    loggedIn: true,
    userId: 8,
    hasCookie: true,
  });
  assert.equal(cookie, 'MUSIC_U=qr; __csrf=csrf');
  assert.deepEqual(calls, [
    ['loginQrCheck', { key: 'qr-key', noCookie: true, timestamp: 123 }],
    ['loginQrCheck', { key: 'qr-key', timestamp: 123 }],
    ['saveCookie', 'MUSIC_U=qr; __csrf=csrf'],
    ['getLoginInfo'],
  ]);
});

test('checkNeteaseQrLogin returns waiting payloads without saving cookies', async () => {
  const result = await checkNeteaseQrLogin('qr-key', {
    loginQrCheck: async () => ({ body: { code: 801, message: 'waiting', nickname: 'Nick', avatarUrl: 'avatar' } }),
    readCookieFromResponse: () => '',
    saveCookie: () => {
      throw new Error('saveCookie should not be called');
    },
    getLoginInfo: async () => ({ loggedIn: false }),
    normalizeLoginInfo: () => ({ loggedIn: false }),
    pendingNeteaseLoginInfo: () => ({ loggedIn: true }),
    now: () => 123,
    logger: { warn() {} },
  });

  assert.deepEqual(result, {
    code: 801,
    message: 'waiting',
    nickname: 'Nick',
    avatar: 'avatar',
  });
});
