const test = require('node:test');
const assert = require('node:assert/strict');

const {
  audioContentTypeForUrl,
  audioProxyHeadersFor,
  buildQQProfileUrl,
  mapQQComment,
  mapQQPlaylist,
  parseJSONText,
  requestQQGetJson,
  requestQQMusicJson,
  qqSingerAvatar,
} = require('../server-dist/server/services/qq-utils');

test('parseJSONText preserves JSON and callback wrapper parsing', () => {
  assert.deepEqual(parseJSONText(' {"code":0} '), { code: 0 });
  assert.deepEqual(parseJSONText('callback({"data":{"id":1}});'), { data: { id: 1 } });
});

test('audio proxy helpers preserve referer, range, and content type fallbacks', () => {
  assert.deepEqual(audioProxyHeadersFor('https://ws.stream.qqmusic.qq.com/file.m4a', 'bytes=0-99', 'UA'), {
    'User-Agent': 'UA',
    Referer: 'https://y.qq.com/',
    Range: 'bytes=0-99',
  });
  assert.deepEqual(audioProxyHeadersFor('https://music.163.com/song.mp3', '', 'UA'), {
    'User-Agent': 'UA',
    Referer: 'https://music.163.com/',
  });
  assert.equal(audioContentTypeForUrl('https://cdn.example/song.flac', 'audio/unknown'), 'audio/flac');
  assert.equal(audioContentTypeForUrl('bad-url', 'audio/aac'), 'audio/aac');
  assert.equal(audioContentTypeForUrl('bad-url', ''), 'audio/mpeg');
});

test('buildQQProfileUrl preserves QQ profile homepage query params', () => {
  assert.equal(
    buildQQProfileUrl('00123'),
    'https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?cid=205360838&userid=00123&reqfrom=1&g_tk=5381&loginUin=00123&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0',
  );
});

test('mapQQPlaylist preserves legacy created and collected playlist mapping', () => {
  assert.deepEqual(mapQQPlaylist({
    dissid: 123,
    diss_name: 'QQ List',
    diss_cover: 'https://img.example/list.jpg',
    songnum: 9,
    visitnum: 88,
    nick: 'Owner',
  }, 'collect'), {
    provider: 'qq',
    source: 'qq',
    id: '123',
    name: 'QQ List',
    cover: 'https://img.example/list.jpg',
    trackCount: 9,
    playCount: 88,
    creator: 'Owner',
    subscribed: true,
    specialType: 0,
  });
});

test('mapQQComment preserves content, user, likes, and timestamp mapping', () => {
  assert.deepEqual(mapQQComment({
    commentid: 'c1',
    rootcommentcontent: 'Nice rain',
    praisenum: 7,
    time: 1700000000,
    user: { uin: 'u1', nick: 'Nested User', avatar: 'nested.jpg' },
  }), {
    id: 'c1',
    content: 'Nice rain',
    likedCount: 7,
    time: 1700000000000,
    user: {
      id: 'u1',
      nickname: 'Nested User',
      avatar: 'nested.jpg',
    },
  });
});

test('qqSingerAvatar preserves legacy QQ singer avatar URL construction', () => {
  assert.equal(qqSingerAvatar(''), '');
  assert.equal(
    qqSingerAvatar('singer001'),
    'https://y.qq.com/music/photo_new/T001R300x300M000singer001.jpg?max_age=2592000',
  );
  assert.equal(
    qqSingerAvatar('singer001', 500),
    'https://y.qq.com/music/photo_new/T001R500x500M000singer001.jpg?max_age=2592000',
  );
});

test('requestQQMusicJson preserves musicu POST body, headers, cookie, and JSON parsing', async () => {
  const calls = [];
  const result = await requestQQMusicJson({
    payload: { comm: { uin: '123' }, req_0: { module: 'm' } },
    url: 'https://u.y.qq.com/cgi-bin/musicu.fcg',
    baseHeaders: { Referer: 'https://y.qq.com/', Origin: 'https://y.qq.com' },
    cookie: 'uin=o123; qm_keyst=key',
    includeCookie: true,
    requestText: async (url, opts, body) => {
      calls.push({ url, opts, body });
      return 'callback({"code":0,"data":{"ok":true}});';
    },
  });

  assert.deepEqual(result, { code: 0, data: { ok: true } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://u.y.qq.com/cgi-bin/musicu.fcg');
  assert.equal(calls[0].opts.method, 'POST');
  assert.deepEqual(calls[0].opts.headers, {
    Referer: 'https://y.qq.com/',
    Origin: 'https://y.qq.com',
    'Content-Type': 'application/json;charset=UTF-8',
    'Content-Length': Buffer.byteLength(calls[0].body),
    Cookie: 'uin=o123; qm_keyst=key',
  });
  assert.equal(calls[0].body, JSON.stringify({ comm: { uin: '123' }, req_0: { module: 'm' } }));

  await requestQQMusicJson({
    payload: { code: 0 },
    url: 'https://u.y.qq.com/cgi-bin/musicu.fcg',
    baseHeaders: {},
    cookie: 'uin=o123',
    includeCookie: false,
    requestText: async (url, opts) => {
      assert.equal(opts.headers.Cookie, undefined);
      return '{"code":0}';
    },
  });
});

test('requestQQGetJson preserves query params, headers, cookie gating, and JSON parsing', async () => {
  const calls = [];
  const result = await requestQQGetJson({
    url: 'https://c.y.qq.com/fcgi?a=keep',
    params: {
      page: 2,
      keyword: 'rain',
      ignored: null,
      skipped: undefined,
    },
    baseHeaders: { Referer: 'https://y.qq.com/' },
    headers: { Host: 'c.y.qq.com' },
    cookie: 'uin=o123; qm_keyst=key',
    includeCookie: true,
    requestText: async (url, opts) => {
      calls.push({ url, opts });
      return 'callback({"code":0,"list":[1,2]});';
    },
  });

  assert.deepEqual(result, { code: 0, list: [1, 2] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://c.y.qq.com/fcgi?a=keep&page=2&keyword=rain');
  assert.deepEqual(calls[0].opts.headers, {
    Referer: 'https://y.qq.com/',
    Host: 'c.y.qq.com',
    Cookie: 'uin=o123; qm_keyst=key',
  });

  await requestQQGetJson({
    url: 'https://c.y.qq.com/fcgi',
    params: { page: 1 },
    baseHeaders: {},
    cookie: 'uin=o123',
    includeCookie: false,
    requestText: async (url, opts) => {
      assert.equal(url, 'https://c.y.qq.com/fcgi?page=1');
      assert.equal(opts.headers.Cookie, undefined);
      return '{"code":0}';
    },
  });
});
