const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createQQRequestAdapters,
} = require('../server-dist/server/composition/qq-request-adapters');

function createAdapters(overrides = {}) {
  const calls = [];
  const services = {
    requestText: async (targetUrl, opts, body) => {
      calls.push(['requestTextService', targetUrl, opts, body]);
      return 'base text';
    },
    requestJson: async (targetUrl, opts, body, deps) => {
      calls.push(['requestJsonService', targetUrl, opts, body, deps.requestText]);
      await deps.requestText(targetUrl, opts, body);
      return 'json';
    },
    requestQQMusicJson: async options => {
      calls.push(['requestQQMusicJson', options]);
      return { songinfo: { data: { track_info: { mid: 'detail-mid', title: 'Detail' } } } };
    },
    requestQQGetJson: async options => {
      calls.push(['requestQQGetJson', options]);
      return { get: true };
    },
    requestQQSmartboxSearch: async options => {
      calls.push(['requestQQSmartboxSearch', options]);
      return [{ mid: 'smart-mid' }];
    },
    fetchQQLoginInfo: async deps => {
      calls.push(['fetchQQLoginInfo', deps]);
      return deps.normalizeQQProfile({ nick: 'QQ' }, deps.qqCookieObject());
    },
    mapQQTrack: (track, fallback) => {
      calls.push(['mapQQTrack', track, fallback]);
      return { ...fallback, mapped: track && track.mid };
    },
    parseCookieString: value => {
      calls.push(['parseCookieString', value]);
      return Object.fromEntries(String(value || '').split(';').filter(Boolean).map(part => part.trim().split('=')));
    },
    qqCookieUin: cookie => cookie.uin || '',
    qqCookieMusicKey: cookie => cookie.qm_keyst || '',
    qqCookiePlaybackKey: cookie => cookie.qqmusic_key || '',
    normalizeQQProfile: (body, cookieObj, hasCookie) => ({
      provider: 'qq',
      nickname: body.nick,
      userId: cookieObj.uin,
      hasCookie,
    }),
    buildQQProfileUrl: uin => `https://profile.example/${uin}`,
    parseJSONText: text => JSON.parse(text),
  };
  let qqCookie = 'uin=o123; qm_keyst=music; qqmusic_key=playback';
  return {
    calls,
    setQQCookie(value) {
      qqCookie = value;
    },
    adapters: createQQRequestAdapters({
      http: { label: 'http' },
      https: { label: 'https' },
      userAgent: 'Mineradio/Test',
      getQQCookie: () => qqCookie,
      logger: { warn() {} },
      services,
      ...overrides,
    }),
  };
}

test('createQQRequestAdapters exposes request runtime and lazy QQ cookie helpers', async () => {
  const { adapters, calls, setQQCookie } = createAdapters();

  assert.deepEqual(Object.keys(adapters), [
    'requestRuntime',
    'requestText',
    'requestJson',
    'qqCookieObject',
    'qqCookieUin',
    'qqCookieMusicKey',
    'qqCookiePlaybackKey',
    'qqMusicRequest',
    'getQQLoginInfo',
    'qqGetJSON',
    'qqSmartboxSearch',
    'qqSongDetail',
    'qqHeaders',
  ]);
  assert.equal(adapters.qqCookieUin(), 'o123');
  assert.equal(adapters.qqCookieMusicKey(), 'music');
  assert.equal(adapters.qqCookiePlaybackKey(), 'playback');

  setQQCookie('uin=o456; qm_keyst=new; qqmusic_key=play-new');

  assert.equal(adapters.qqCookieUin(), 'o456');
  assert.equal(adapters.qqCookieMusicKey(), 'new');
  assert.equal(adapters.qqCookiePlaybackKey(), 'play-new');
  assert.equal(calls.filter(call => call[0] === 'parseCookieString').length, 6);
});

test('createQQRequestAdapters keeps requestText override semantics', async () => {
  const { adapters, calls } = createAdapters();

  assert.equal(await adapters.requestText('https://base.test', { method: 'GET' }, 'body'), 'base text');
  adapters.requestRuntime.setRequestText(async (targetUrl, opts, body) => {
    calls.push(['override', targetUrl, opts, body]);
    return 'override text';
  });

  assert.equal(await adapters.requestText('https://override.test'), 'override text');
  assert.equal(await adapters.requestJson('https://json.test'), 'json');
  assert.deepEqual(calls.map(call => call[0]), [
    'requestTextService',
    'override',
    'requestJsonService',
    'override',
  ]);
});

test('createQQRequestAdapters wires QQ provider requests with current cookie and headers', async () => {
  const { adapters, calls, setQQCookie } = createAdapters();

  assert.deepEqual(await adapters.qqMusicRequest({ req: true }), {
    songinfo: { data: { track_info: { mid: 'detail-mid', title: 'Detail' } } },
  });
  assert.equal(calls.at(-1)[1].includeCookie, false);
  assert.equal(calls.at(-1)[1].cookie, 'uin=o123; qm_keyst=music; qqmusic_key=playback');

  setQQCookie('uin=o789; qm_keyst=changed');
  await adapters.qqMusicRequest({ req: true }, { cookie: true });
  assert.equal(calls.at(-1)[1].includeCookie, true);
  assert.equal(calls.at(-1)[1].cookie, 'uin=o789; qm_keyst=changed');

  await adapters.qqGetJSON('https://get.test', { a: 1 }, { headers: { X: 'Y' }, cookie: false });
  assert.equal(calls.at(-1)[1].includeCookie, false);
  assert.deepEqual(calls.at(-1)[1].headers, { X: 'Y' });

  assert.deepEqual(await adapters.qqSmartboxSearch('rain', 5), [{ mid: 'smart-mid' }]);
  assert.equal(calls.at(-1)[1].keywords, 'rain');
});

test('createQQRequestAdapters wires QQ login info and song detail helpers', async () => {
  const { adapters, calls } = createAdapters();

  assert.deepEqual(await adapters.getQQLoginInfo(), {
    provider: 'qq',
    nickname: 'QQ',
    userId: 'o123',
    hasCookie: true,
  });
  assert.ok(calls.some(call => call[0] === 'fetchQQLoginInfo'));

  const fallback = { mid: 'fallback', name: 'Fallback' };
  assert.equal(await adapters.qqSongDetail('', fallback), fallback);
  assert.deepEqual(await adapters.qqSongDetail('song-mid', fallback), {
    mid: 'fallback',
    name: 'Fallback',
    mapped: 'detail-mid',
  });
  assert.deepEqual(calls.at(-1), ['mapQQTrack', { mid: 'detail-mid', title: 'Detail' }, fallback]);
});
