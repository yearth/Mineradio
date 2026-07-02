const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isNeteaseAuthInvalidPayload,
  normalizeLoginInfo,
  normalizeNeteaseVip,
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
