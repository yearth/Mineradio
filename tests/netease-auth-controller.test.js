const test = require('node:test');
const assert = require('node:assert/strict');

const {
  handleNeteaseAuthRoutes,
} = require('../server-dist/server/controllers/netease-auth-controller');

function baseContext(overrides = {}) {
  const calls = [];
  let userCookie = '';
  return {
    calls,
    setUserCookie: value => { userCookie = value; },
    ctx: {
      pathname: '/api/login/cookie',
      url: new URL('http://localhost/api/login/cookie'),
      req: { method: 'POST' },
      res: 'res',
      sendJSON: (res, data, status) => calls.push({ res, data, status }),
      readRequestBody: async () => ({ cookie: 'MUSIC_U=secret; __csrf=token' }),
      normalizeCookieHeader: raw => String(raw).trim(),
      parseCookieString: raw => Object.fromEntries(String(raw).split(';').map(part => part.trim().split('='))),
      saveCookie: cookie => {
        userCookie = cookie;
        calls.push({ saveCookie: cookie });
      },
      getUserCookie: () => userCookie,
      getLoginInfo: async () => ({ loggedIn: true, userId: 1 }),
      pendingNeteaseLoginInfo: body => ({ loggedIn: true, pendingProfile: true, body }),
      loginQrKey: async opts => ({ body: { data: { unikey: `key-${typeof opts.timestamp}` } } }),
      loginQrCreate: async opts => ({ body: { data: { qrimg: `img-${opts.key}`, qrurl: `url-${opts.qrimg}` } } }),
      loginQrCheck: async opts => ({ body: { code: 801, message: 'waiting', nickname: 'Nick', avatarUrl: 'avatar' } }),
      readCookieFromResponse: response => response.body && response.body.cookie,
      normalizeLoginInfo: (profile, account, data) => ({ loggedIn: true, profile, account, data }),
      logout: async opts => calls.push({ logout: opts }),
      now: () => 123,
      logger: { warn: (...args) => calls.push({ warn: args }), error: (...args) => calls.push({ error: args }) },
      ...overrides,
    },
  };
}

test('handleNeteaseAuthRoutes saves valid cookies and rejects missing MUSIC_U', async () => {
  const valid = baseContext();

  assert.equal(await handleNeteaseAuthRoutes(valid.ctx), true);
  assert.deepEqual(valid.calls, [
    { saveCookie: 'MUSIC_U=secret; __csrf=token' },
    { res: 'res', data: { loggedIn: true, userId: 1, saved: true, hasCookie: true }, status: undefined },
  ]);

  const invalid = baseContext({
    readRequestBody: async () => ({ cookie: 'NMTID=abc; __csrf=token' }),
  });

  assert.equal(await handleNeteaseAuthRoutes(invalid.ctx), true);
  assert.deepEqual(invalid.calls, [{
    res: 'res',
    data: {
      loggedIn: false,
      error: 'INVALID_NETEASE_COOKIE',
      message: '网易云 cookie 缺少 MUSIC_U',
    },
    status: 400,
  }]);
});

test('handleNeteaseAuthRoutes returns pending login info after saving a cookie when profile lookup is not logged in', async () => {
  const { calls, ctx } = baseContext({
    getLoginInfo: async () => ({ loggedIn: false }),
    pendingNeteaseLoginInfo: () => ({ loggedIn: true, pendingProfile: true }),
  });

  assert.equal(await handleNeteaseAuthRoutes(ctx), true);
  assert.deepEqual(calls, [
    { saveCookie: 'MUSIC_U=secret; __csrf=token' },
    { res: 'res', data: { loggedIn: true, pendingProfile: true, saved: true, hasCookie: true }, status: undefined },
  ]);
});

test('handleNeteaseAuthRoutes reports cookie read errors with legacy fallback', async () => {
  const err = new Error('bad body');
  const { calls, ctx } = baseContext({
    readRequestBody: async () => { throw err; },
  });

  assert.equal(await handleNeteaseAuthRoutes(ctx), true);
  assert.deepEqual(calls, [
    { error: ['[LoginCookie]', err] },
    { res: 'res', data: { loggedIn: false, error: 'bad body' }, status: 500 },
  ]);
});

test('handleNeteaseAuthRoutes handles QR key and QR create routes', async () => {
  const key = baseContext({ pathname: '/api/login/qr/key' });

  assert.equal(await handleNeteaseAuthRoutes(key.ctx), true);
  assert.deepEqual(key.calls, [{ res: 'res', data: { key: 'key-number' }, status: undefined }]);

  const create = baseContext({
    pathname: '/api/login/qr/create',
    url: new URL('http://localhost/api/login/qr/create?key=abc'),
  });

  assert.equal(await handleNeteaseAuthRoutes(create.ctx), true);
  assert.deepEqual(create.calls, [{
    res: 'res',
    data: { img: 'img-abc', url: 'url-true' },
    status: undefined,
  }]);
});

test('handleNeteaseAuthRoutes handles QR check waiting and success retry cookie flows', async () => {
  const waiting = baseContext({
    pathname: '/api/login/qr/check',
    url: new URL('http://localhost/api/login/qr/check?key=abc'),
  });

  assert.equal(await handleNeteaseAuthRoutes(waiting.ctx), true);
  assert.deepEqual(waiting.calls, [{
    res: 'res',
    data: { code: 801, message: 'waiting', nickname: 'Nick', avatar: 'avatar' },
    status: undefined,
  }]);

  const calls = [];
  const success = baseContext({
    pathname: '/api/login/qr/check',
    url: new URL('http://localhost/api/login/qr/check?key=abc'),
    loginQrCheck: async opts => {
      calls.push(opts);
      if (opts.noCookie) {
        return { body: { code: 803, message: 'ok', profile: { userId: 2 }, account: { id: 2 } } };
      }
      return { body: { code: 803, message: 'ok', cookie: 'MUSIC_U=qr; __csrf=csrf' } };
    },
    getLoginInfo: async () => ({ loggedIn: true, userId: 2 }),
  });

  assert.equal(await handleNeteaseAuthRoutes(success.ctx), true);
  assert.deepEqual(calls.map(call => call.noCookie), [true, undefined]);
  assert.deepEqual(success.calls, [
    { saveCookie: 'MUSIC_U=qr; __csrf=csrf' },
    { res: 'res', data: { code: 803, message: 'ok', loggedIn: true, userId: 2, hasCookie: true }, status: undefined },
  ]);
});

test('handleNeteaseAuthRoutes keeps QR profile data when retry fails and builds pending info for cookie-only success', async () => {
  const retryErr = new Error('retry failed');
  const retryFailed = baseContext({
    pathname: '/api/login/qr/check',
    loginQrCheck: async opts => {
      if (opts.noCookie) {
        return { body: { code: 803, message: 'ok', profile: { userId: 3 }, account: { id: 3 } } };
      }
      throw retryErr;
    },
    getLoginInfo: async () => ({ loggedIn: false }),
    normalizeLoginInfo: (profile, account, data) => ({ loggedIn: true, profile, account, data }),
  });

  assert.equal(await handleNeteaseAuthRoutes(retryFailed.ctx), true);
  assert.deepEqual(retryFailed.calls, [
    { warn: ['[Login] qr cookie retry failed:', 'retry failed'] },
    {
      res: 'res',
      data: {
        code: 803,
        message: 'ok',
        loggedIn: true,
        profile: { userId: 3 },
        account: { id: 3 },
        data: { code: 803, message: 'ok', profile: { userId: 3 }, account: { id: 3 } },
        hasCookie: false,
      },
      status: undefined,
    },
  ]);

  const pending = baseContext({
    pathname: '/api/login/qr/check',
    loginQrCheck: async () => ({ body: { code: 803, message: 'ok', cookie: 'MUSIC_U=pending', nickname: 'Pending' } }),
    getLoginInfo: async () => ({ loggedIn: false }),
    normalizeLoginInfo: () => ({ loggedIn: false }),
    pendingNeteaseLoginInfo: body => ({ loggedIn: true, pendingProfile: true, nickname: body.nickname }),
  });

  assert.equal(await handleNeteaseAuthRoutes(pending.ctx), true);
  assert.deepEqual(pending.calls, [
    { saveCookie: 'MUSIC_U=pending' },
    {
      res: 'res',
      data: { code: 803, message: 'ok', loggedIn: true, pendingProfile: true, nickname: 'Pending', hasCookie: true },
      status: undefined,
    },
  ]);
});

test('handleNeteaseAuthRoutes handles login status and logout', async () => {
  const status = baseContext({ pathname: '/api/login/status' });

  assert.equal(await handleNeteaseAuthRoutes(status.ctx), true);
  assert.deepEqual(status.calls, [{ res: 'res', data: { loggedIn: true, userId: 1 }, status: undefined }]);

  const logout = baseContext({ pathname: '/api/logout' });
  logout.setUserCookie('MUSIC_U=logout');

  assert.equal(await handleNeteaseAuthRoutes(logout.ctx), true);
  assert.deepEqual(logout.calls, [
    { logout: { cookie: 'MUSIC_U=logout' } },
    { saveCookie: '' },
    { res: 'res', data: { ok: true }, status: undefined },
  ]);
});

test('handleNeteaseAuthRoutes ignores logout provider failures and unrelated paths', async () => {
  const logout = baseContext({
    pathname: '/api/logout',
    logout: async () => { throw new Error('ignored'); },
  });
  logout.setUserCookie('MUSIC_U=logout');

  assert.equal(await handleNeteaseAuthRoutes(logout.ctx), true);
  assert.deepEqual(logout.calls, [
    { saveCookie: '' },
    { res: 'res', data: { ok: true }, status: undefined },
  ]);

  const unrelated = baseContext({ pathname: '/api/song/url' });

  assert.equal(await handleNeteaseAuthRoutes(unrelated.ctx), false);
  assert.deepEqual(unrelated.calls, []);
});

test('handleNeteaseAuthRoutes reports QR provider errors with legacy fallback', async () => {
  const keyErr = baseContext({
    pathname: '/api/login/qr/key',
    loginQrKey: async () => { throw new Error('key failed'); },
  });
  assert.equal(await handleNeteaseAuthRoutes(keyErr.ctx), true);
  assert.deepEqual(keyErr.calls, [{ res: 'res', data: { error: 'key failed' }, status: 500 }]);

  const createErr = baseContext({
    pathname: '/api/login/qr/create',
    loginQrCreate: async () => { throw new Error('create failed'); },
  });
  assert.equal(await handleNeteaseAuthRoutes(createErr.ctx), true);
  assert.deepEqual(createErr.calls, [{ res: 'res', data: { error: 'create failed' }, status: 500 }]);

  const checkErr = baseContext({
    pathname: '/api/login/qr/check',
    loginQrCheck: async () => { throw new Error('check failed'); },
  });
  assert.equal(await handleNeteaseAuthRoutes(checkErr.ctx), true);
  assert.deepEqual(checkErr.calls, [{ res: 'res', data: { error: 'check failed' }, status: 500 }]);
});
