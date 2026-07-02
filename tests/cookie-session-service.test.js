const test = require('node:test');
const assert = require('node:assert/strict');

const {
  decodeQQCookieValue,
  normalizeCookieHeader,
  normalizeQQProfile,
  normalizeQQCookieInput,
  normalizeQQUin,
  parseCookieString,
  qqCookieAvatar,
  qqCookieMusicKey,
  qqCookieNickname,
  qqCookiePlaybackKey,
  qqCookieUin,
  rawCookieFallback,
  serializeCookieObject,
} = require('../server-dist/server/services/cookie-session');

test('normalizeCookieHeader preserves legacy cookie picking rules', () => {
  assert.equal(
    normalizeCookieHeader([
      { name: 'MUSIC_U', value: 'secret' },
      { Path: '/', Domain: 'music.163.com' },
      { __csrf: { value: 'csrf-token' }, ignored: { nested: true }, NMTID: 'abc' },
      'MUSIC_U=overridden; Secure; flag; os=mac',
      'empty=',
    ]),
    'MUSIC_U=overridden; __csrf=csrf-token; NMTID=abc; os=mac'
  );

  assert.equal(rawCookieFallback('  a=1; b=2  '), 'a=1; b=2');
  assert.equal(rawCookieFallback(['a=1', 'b=2']), 'a=1; b=2');
  assert.equal(rawCookieFallback(['a=1', { b: 2 }]), '');
});

test('parse and serialize cookie objects preserve simple key value behavior', () => {
  assert.deepEqual(parseCookieString(' a=1 ; flag ; b=two=2; c=  '), {
    a: '1',
    b: 'two=2',
    c: '',
  });
  assert.equal(serializeCookieObject({ a: 1, b: '', c: null, d: undefined, e: 'ok' }), 'a=1; e=ok');
});

test('QQ cookie helpers normalize uin and key precedence', () => {
  assert.equal(normalizeQQUin('o0012345'), '12345');
  assert.equal(normalizeQQUin('000'), '000');
  assert.equal(qqCookieUin({ login_type: 2, wxuin: 'wx-00098', uin: '12345' }), '98');
  assert.equal(qqCookieUin({ qqmusic_uin: '00123', wxuin: '999' }), '123');
  assert.equal(qqCookieMusicKey({ p_skey: 'ps', skey: 's', wxskey: 'wx' }), 'ps');
  assert.equal(qqCookieMusicKey({ psrf_qqaccess_token: 'access', wxskey: 'wx' }), 'access');
  assert.equal(qqCookiePlaybackKey({ music_key: 'music', wxskey: 'wx' }), 'music');
});

test('QQ cookie profile helpers decode names and derive avatars', () => {
  const obj = parseCookieString('uin=o12345; ptnick_12345=Full+QQ%20User; avatar=https%3A%2F%2Fimg.example%2Fa.png');

  assert.equal(decodeQQCookieValue('Full+QQ%20User'), 'Full QQ User');
  assert.equal(decodeQQCookieValue('%E0%A4%A'), '%E0%A4%A');
  assert.equal(qqCookieNickname(obj), 'Full QQ User');
  assert.equal(qqCookieAvatar(obj), 'https://img.example/a.png');
  assert.equal(qqCookieAvatar({ uin: 'o888' }), 'https://q1.qlogo.cn/g?b=qq&nk=888&s=100');
});

test('normalizeQQCookieInput maps alternate uin fields and preserves login fields', () => {
  assert.equal(
    normalizeQQCookieInput('login_type=2; wxuin=wx00077; qm_keyst=music-key; ptnick_77=QQ%20User'),
    'login_type=2; wxuin=wx00077; qm_keyst=music-key; ptnick_77=QQ%20User; uin=77'
  );
  assert.equal(
    normalizeQQCookieInput('qqmusic_uin=o00123; qqmusic_key=play-key'),
    'qqmusic_uin=o00123; qqmusic_key=play-key; uin=123'
  );
});

test('normalizeQQProfile preserves QQ profile, cookie fallback, and auth metadata', () => {
  const cookieObj = parseCookieString('uin=o12345; qm_keyst=music-key; music_key=play-key; ptnick_12345=Cookie%20User; vip_type=2');

  assert.deepEqual(normalizeQQProfile({
    data: {
      creator: {
        nickname: 'Profile User',
        avatarUrl: 'https://img.example/profile.jpg',
      },
    },
  }, cookieObj, true), {
    provider: 'qq',
    loggedIn: true,
    preview: false,
    userId: '12345',
    nickname: 'Profile User',
    avatar: 'https://img.example/profile.jpg',
    vipType: 2,
    hasCookie: true,
    playbackKeyReady: true,
    profileSource: 'qq-profile',
  });

  assert.deepEqual(normalizeQQProfile({
    result: {
      vipInfo: { isVip: true },
    },
  }, parseCookieString('uin=o888; qqmusic_key=key; ptnick_888=Cookie%20Only'), true), {
    provider: 'qq',
    loggedIn: true,
    preview: false,
    userId: '888',
    nickname: 'Cookie Only',
    avatar: 'https://q1.qlogo.cn/g?b=qq&nk=888&s=100',
    vipType: 1,
    hasCookie: true,
    playbackKeyReady: true,
    profileSource: 'cookie',
  });

  assert.deepEqual(normalizeQQProfile(null, {}, false), {
    provider: 'qq',
    loggedIn: false,
    preview: false,
    userId: '',
    nickname: 'QQ 音乐',
    avatar: '',
    vipType: 0,
    hasCookie: false,
    playbackKeyReady: false,
    profileSource: 'fallback',
  });
});
