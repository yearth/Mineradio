const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getNeteaseLoginInfo,
  isNeteaseAuthInvalidPayload,
  isNeteaseLoginReady,
  neteaseLoginRequiredPayload,
  normalizeLoginInfo,
  normalizeNeteaseVip,
  pendingNeteaseLoginInfo,
  readCookieFromResponse,
} = require('../server-dist/server/services/netease-session');

test('normalizeNeteaseVip preserves numeric, boolean, and text VIP detection', () => {
  assert.deepEqual(normalizeNeteaseVip({}, {}, {}), {
    vipType: 0,
    vipLevel: 'none',
    isVip: false,
    isSvip: false,
    vipLabel: '无VIP',
  });

  assert.deepEqual(normalizeNeteaseVip({ vipInfo: { musicVipType: 1 } }, {}, {}), {
    vipType: 1,
    vipLevel: 'vip',
    isVip: true,
    isSvip: false,
    vipLabel: 'VIP',
  });

  assert.deepEqual(normalizeNeteaseVip({}, { vipType: 10 }, {}), {
    vipType: 10,
    vipLevel: 'svip',
    isVip: true,
    isSvip: true,
    vipLabel: 'SVIP',
  });

  assert.deepEqual(normalizeNeteaseVip({ vipInfo: { label: '黑胶SVIP会员' } }, {}, {}), {
    vipType: 0,
    vipLevel: 'svip',
    isVip: true,
    isSvip: true,
    vipLabel: 'SVIP',
  });
});

test('normalizeLoginInfo preserves user id, profile fallbacks, and zero ids', () => {
  assert.deepEqual(normalizeLoginInfo({}, {}, {}), { loggedIn: false });

  assert.deepEqual(normalizeLoginInfo({
    userId: '0',
    userName: 'Zero User',
    avatar: 'https://img.example/avatar.jpg',
  }, {}, { vipInfo: { label: '会员' } }), {
    loggedIn: true,
    userId: '0',
    nickname: 'Zero User',
    avatar: 'https://img.example/avatar.jpg',
    vipType: 0,
    vipLevel: 'vip',
    isVip: true,
    isSvip: false,
    vipLabel: 'VIP',
  });

  assert.deepEqual(normalizeLoginInfo({ user_id: 123, nickname: 'Snake User' }, {}, {}), {
    loggedIn: true,
    userId: 123,
    nickname: 'Snake User',
    avatar: '',
    vipType: 0,
    vipLevel: 'none',
    isVip: false,
    isSvip: false,
    vipLabel: '无VIP',
  });
});

test('isNeteaseAuthInvalidPayload preserves auth failure rules', () => {
  assert.equal(isNeteaseAuthInvalidPayload({ body: { code: 301 } }), true);
  assert.equal(isNeteaseAuthInvalidPayload({ body: { code: 401 } }), true);
  assert.equal(isNeteaseAuthInvalidPayload({ body: { code: 403, message: '请先登录后再访问' } }), true);
  assert.equal(isNeteaseAuthInvalidPayload({ status: 500, body: { msg: 'server unavailable' } }), false);
});

test('netease login requirement helpers preserve route auth semantics', () => {
  assert.equal(isNeteaseLoginReady({ loggedIn: true, userId: 123 }), true);
  assert.equal(isNeteaseLoginReady({ loggedIn: true, userId: '0' }), true);
  assert.equal(isNeteaseLoginReady({ loggedIn: true }), false);
  assert.equal(isNeteaseLoginReady({ loggedIn: false, userId: 123 }), false);
  assert.equal(isNeteaseLoginReady(null), false);
  assert.deepEqual(neteaseLoginRequiredPayload(), { error: 'LOGIN_REQUIRED', loggedIn: false });
});

test('readCookieFromResponse preserves Netease cookie extraction precedence', () => {
  assert.equal(readCookieFromResponse({
    cookie: ['MUSIC_U=direct;', 'NMTID=direct-token;'],
    body: { cookie: 'MUSIC_U=body;' },
  }), 'MUSIC_U=direct; NMTID=direct-token');

  assert.equal(readCookieFromResponse({
    body: { data: { cookies: [{ name: 'MUSIC_U', value: 'nested' }, { name: 'os', value: 'pc' }] } },
  }), 'MUSIC_U=nested; os=pc');

  assert.equal(readCookieFromResponse({
    body: { cookie: { MUSIC_U: 'object-cookie', __csrf: 'csrf-token' } },
  }), 'MUSIC_U=object-cookie; __csrf=csrf-token');

  assert.equal(readCookieFromResponse({ body: { data: {} } }), '');
});

test('getNeteaseLoginInfo preserves login_status success and account fallback behavior', async () => {
  const calls = [];
  const info = await getNeteaseLoginInfo('MUSIC_U=abc', {
    now: () => 12345,
    loginStatus: async opts => {
      calls.push(['login_status', opts]);
      return { body: { data: { profile: { userId: 7, nickname: 'Status User' }, account: { vipType: 10 } } } };
    },
    userAccount: async opts => {
      calls.push(['user_account', opts]);
      return { body: {} };
    },
    saveCookie: cookie => calls.push(['saveCookie', cookie]),
    warn: (...args) => calls.push(['warn', args]),
  });

  assert.deepEqual(calls, [['login_status', { cookie: 'MUSIC_U=abc', timestamp: 12345 }]]);
  assert.equal(info.loggedIn, true);
  assert.equal(info.userId, 7);
  assert.equal(info.nickname, 'Status User');
  assert.equal(info.vipLevel, 'svip');

  const fallbackCalls = [];
  const fallbackInfo = await getNeteaseLoginInfo('MUSIC_U=abc', {
    now: () => 22222,
    loginStatus: async () => {
      fallbackCalls.push(['login_status']);
      throw new Error('status down');
    },
    userAccount: async opts => {
      fallbackCalls.push(['user_account', opts]);
      return { body: { profile: { user_id: 9, userName: 'Account User' } } };
    },
    saveCookie: cookie => fallbackCalls.push(['saveCookie', cookie]),
    warn: (...args) => fallbackCalls.push(['warn', args]),
  });

  assert.deepEqual(fallbackCalls, [
    ['login_status'],
    ['warn', ['[Login] login_status failed:', 'status down']],
    ['user_account', { cookie: 'MUSIC_U=abc', timestamp: 22222 }],
  ]);
  assert.equal(fallbackInfo.loggedIn, true);
  assert.equal(fallbackInfo.userId, 9);
  assert.equal(fallbackInfo.nickname, 'Account User');
});

test('getNeteaseLoginInfo preserves logged-out, auth-invalid clearing, and account failure fallbacks', async () => {
  const loggedOut = await getNeteaseLoginInfo('', {
    loginStatus: async () => {
      throw new Error('should not call login_status');
    },
    userAccount: async () => {
      throw new Error('should not call user_account');
    },
  });
  assert.deepEqual(loggedOut, {
    loggedIn: false,
    vipType: 0,
    vipLevel: 'none',
    isVip: false,
    isSvip: false,
    vipLabel: '无VIP',
  });

  const cleared = [];
  const invalid = await getNeteaseLoginInfo('MUSIC_U=bad', {
    now: () => 33333,
    loginStatus: async () => {
      throw new Error('status down');
    },
    userAccount: async () => ({ body: { code: 401, message: '需要登录' } }),
    saveCookie: cookie => cleared.push(cookie),
    warn: () => {},
  });
  assert.deepEqual(cleared, ['']);
  assert.equal(invalid.loggedIn, false);
  assert.equal(invalid.hasCookie, true);
  assert.equal(invalid.vipLabel, '无VIP');

  const warnings = [];
  const failed = await getNeteaseLoginInfo('MUSIC_U=broken', {
    loginStatus: async () => {
      throw new Error('status down');
    },
    userAccount: async () => {
      throw new Error('account down');
    },
    warn: (...args) => warnings.push(args),
  });
  assert.deepEqual(warnings, [
    ['[Login] login_status failed:', 'status down'],
    ['[Login] account check failed:', 'account down'],
  ]);
  assert.equal(failed.loggedIn, false);
  assert.equal(failed.hasCookie, true);
});

test('pendingNeteaseLoginInfo preserves pending profile fallbacks', () => {
  assert.deepEqual(pendingNeteaseLoginInfo(), {
    loggedIn: true,
    pendingProfile: true,
    nickname: '网易云用户',
    avatar: '',
    vipType: 0,
    vipLevel: 'none',
    isVip: false,
    isSvip: false,
    vipLabel: '无VIP',
  });

  assert.deepEqual(pendingNeteaseLoginInfo({
    nickname: 'QR User',
    avatarUrl: 'https://img.example/qr.jpg',
    profile: {
      nickname: 'Profile User',
      avatarUrl: 'https://img.example/profile.jpg',
    },
  }), {
    loggedIn: true,
    pendingProfile: true,
    nickname: 'QR User',
    avatar: 'https://img.example/qr.jpg',
    vipType: 0,
    vipLevel: 'none',
    isVip: false,
    isSvip: false,
    vipLabel: '无VIP',
  });

  assert.equal(pendingNeteaseLoginInfo({
    profile: { nickname: 'Profile User', avatarUrl: 'https://img.example/profile.jpg' },
  }).nickname, 'Profile User');
});
