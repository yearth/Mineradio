const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-music-routes-'));
process.env.PORT = '0';
process.env.HOST = '127.0.0.1';
process.env.NODE_ENV = 'test';
process.env.COOKIE_FILE = path.join(testDir, '.cookie');
process.env.QQ_COOKIE_FILE = path.join(testDir, '.qq-cookie');
[
  'GITHUB_REPOSITORY',
  'MINERADIO_VERSION',
  'MINERADIO_UPDATE_MANIFEST',
  'MINERADIO_UPDATE_MANIFEST_FILE',
  'MINERADIO_UPDATE_MANIFEST_URL',
  'MINERADIO_UPDATE_OWNER',
  'MINERADIO_UPDATE_REPOSITORY',
  'MINERADIO_UPDATE_REPO',
].forEach(name => {
  delete process.env[name];
});

const server = require('../server');

test.afterEach(() => {
  if (server.__test) server.__test.resetMusicRuntime();
  if (fs.existsSync(process.env.COOKIE_FILE)) fs.unlinkSync(process.env.COOKIE_FILE);
  if (fs.existsSync(process.env.QQ_COOKIE_FILE)) fs.unlinkSync(process.env.QQ_COOKIE_FILE);
});

async function requestJson(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? '' : JSON.stringify(body);
    const req = new Readable({
      read() {
        this.push(payload);
        this.push(null);
      },
    });
    req.url = pathname;
    req.method = method;
    req.headers = payload ? {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
    } : {};
    const res = {
      statusCode: 200,
      headers: {},
      writeHead(status, headers) {
        this.statusCode = status;
        this.headers = headers || {};
      },
      end(body) {
        try {
          resolve({ status: this.statusCode, body: JSON.parse(String(body || '{}')) });
        } catch (err) {
          reject(err);
        }
      },
    };
    server.emit('request', req, res);
  });
}

async function requestRaw(method, pathname, headers) {
  return new Promise(resolve => {
    const req = new Readable({
      read() {
        this.push(null);
      },
    });
    req.url = pathname;
    req.method = method;
    req.headers = headers || {};
    const chunks = [];
    const res = {
      statusCode: 200,
      headers: {},
      writeHead(status, headers) {
        this.statusCode = status;
        this.headers = headers || {};
      },
      write(chunk) {
        chunks.push(Buffer.from(chunk));
      },
      end(body) {
        if (body) chunks.push(Buffer.from(body));
        resolve({
          status: this.statusCode,
          headers: this.headers,
          body: Buffer.concat(chunks),
        });
      },
    };
    server.emit('request', req, res);
  });
}

async function getJson(pathname) {
  return requestJson('GET', pathname);
}

async function postJson(pathname, body) {
  return requestJson('POST', pathname, body);
}

async function postForm(pathname, data) {
  return new Promise((resolve, reject) => {
    const payload = new URLSearchParams(data).toString();
    const req = new Readable({
      read() {
        this.push(payload);
        this.push(null);
      },
    });
    req.url = pathname;
    req.method = 'POST';
    req.headers = {
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': Buffer.byteLength(payload),
    };
    const res = {
      statusCode: 200,
      headers: {},
      writeHead(status, headers) {
        this.statusCode = status;
        this.headers = headers || {};
      },
      end(body) {
        try {
          resolve({ status: this.statusCode, body: JSON.parse(String(body || '{}')) });
        } catch (err) {
          reject(err);
        }
      },
    };
    server.emit('request', req, res);
  });
}

function setRequestTextResponder(responder) {
  server.__test.setRequestText(async (targetUrl, opts, requestBody) => {
    const value = await responder(targetUrl, opts, requestBody);
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
}

async function loginAs(overrides) {
  const profile = Object.assign({
    userId: 9001,
    nickname: 'Rain User',
  }, overrides && overrides.profile);
  const account = Object.assign({ id: profile.userId }, overrides && overrides.account);
  server.__test.setNeteaseApi(Object.assign({
    login_status: async () => ({
      body: {
        data: { profile, account },
      },
    }),
  }, overrides && overrides.api));
  await postJson('/api/login/cookie', { cookie: 'MUSIC_U=test-user; __csrf=test-csrf' });
  return { profile, account };
}

test('/api/app/version returns package and update metadata', async () => {
  const pkg = require('../package.json');

  const { status, body } = await getJson('/api/app/version');

  assert.equal(status, 200);
  assert.equal(body.name, pkg.name);
  assert.equal(body.productName, pkg.productName);
  assert.equal(body.version, pkg.version);
  assert.equal(body.update.provider, pkg.mineradio.update.provider);
  assert.equal(body.update.owner, pkg.mineradio.update.owner);
  assert.equal(body.update.repo, pkg.mineradio.update.repo);
  assert.equal(body.update.preview, pkg.mineradio.update.preview);
  assert.equal(body.update.manifestOverride, false);
  assert.equal(typeof body.update.configured, 'boolean');
});

test('/api/search maps cloudsearch songs and backfills missing covers', async () => {
  const calls = [];
  assert.equal(typeof server.__test.setNeteaseApi, 'function');
  server.__test.setNeteaseApi({
    cloudsearch: async opts => {
      calls.push(['cloudsearch', opts]);
      return {
        body: {
          result: {
            songs: [
              {
                id: 101,
                name: 'Rain Loop',
                ar: [{ id: 7, name: 'Nova' }],
                al: { name: 'Weather Beats', picUrl: '' },
                dt: 188000,
                fee: 0,
              },
            ],
          },
        },
      };
    },
    song_detail: async opts => {
      calls.push(['song_detail', opts]);
      return {
        body: {
          songs: [
            { id: 101, al: { picUrl: 'https://img.example/rain.jpg' } },
          ],
        },
      };
    },
  });

  const { status, body } = await getJson('/api/search?keywords=rain&limit=3');

  assert.equal(status, 200);
  assert.deepEqual(body.songs, [
    {
      provider: 'netease',
      source: 'netease',
      type: 'song',
      id: 101,
      name: 'Rain Loop',
      artist: 'Nova',
      artists: [{ id: 7, name: 'Nova' }],
      artistId: 7,
      album: 'Weather Beats',
      cover: 'https://img.example/rain.jpg',
      duration: 188000,
      fee: 0,
    },
  ]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'cloudsearch');
  assert.equal(calls[0][1].keywords, 'rain');
  assert.equal(calls[0][1].limit, 3);
  assert.equal(calls[1][0], 'song_detail');
  assert.equal(calls[1][1].ids, '101');
});

test('/api/search returns empty songs with a 500 status when cloudsearch fails', async () => {
  const originalError = console.error;
  console.error = () => {};
  server.__test.setNeteaseApi({
    cloudsearch: async () => {
      throw new Error('search unavailable');
    },
  });

  try {
    const { status, body } = await getJson('/api/search?keywords=rain&limit=3');

    assert.equal(status, 500);
    assert.equal(body.error, 'search unavailable');
    assert.deepEqual(body.songs, []);
  } finally {
    console.error = originalError;
  }
});

test('/api/lyric requires a song id', async () => {
  const { status, body } = await getJson('/api/lyric');

  assert.equal(status, 400);
  assert.equal(body.error, 'Missing song id');
  assert.equal(body.lyric, '');
});

test('/api/lyric returns lyric_new data when it includes lyrics', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    lyric_new: async opts => {
      calls.push(['lyric_new', opts]);
      return {
        body: {
          lrc: { lyric: '[00:00.00]Rain Loop' },
          tlyric: { lyric: '[00:00.00]雨循环' },
          yrc: { lyric: '[0,1000]Rain Loop' },
        },
      };
    },
    lyric: async opts => {
      calls.push(['lyric', opts]);
      return { body: {} };
    },
  });

  const { status, body } = await getJson('/api/lyric?id=101');

  assert.equal(status, 200);
  assert.equal(body.source, 'lyric_new');
  assert.equal(body.lyric, '[00:00.00]Rain Loop');
  assert.equal(body.tlyric, '[00:00.00]雨循环');
  assert.equal(body.yrc, '[0,1000]Rain Loop');
  assert.deepEqual(calls.map(call => call[0]), ['lyric_new']);
  assert.equal(calls[0][1].id, '101');
});

test('/api/lyric falls back to lyric when lyric_new has no timed lyrics', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    lyric_new: async opts => {
      calls.push(['lyric_new', opts]);
      return { body: {} };
    },
    lyric: async opts => {
      calls.push(['lyric', opts]);
      return {
        body: {
          lrc: { lyric: '[00:00.00]Fallback Rain' },
          tlyric: { lyric: '' },
          yrc: { lyric: '' },
        },
      };
    },
  });

  const { status, body } = await getJson('/api/lyric?id=102');

  assert.equal(status, 200);
  assert.equal(body.source, 'lyric');
  assert.equal(body.lyric, '[00:00.00]Fallback Rain');
  assert.deepEqual(calls.map(call => call[0]), ['lyric_new', 'lyric']);
  assert.equal(calls[1][1].id, '102');
});

test('/api/lyric falls back when lyric_new throws', async () => {
  const calls = [];
  const originalWarn = console.warn;
  console.warn = () => {};
  server.__test.setNeteaseApi({
    lyric_new: async opts => {
      calls.push(['lyric_new', opts]);
      throw new Error('lyric_new unavailable');
    },
    lyric: async opts => {
      calls.push(['lyric', opts]);
      return {
        body: {
          lrc: { lyric: '[00:00.00]Classic lyric' },
        },
      };
    },
  });

  try {
    const { status, body } = await getJson('/api/lyric?id=103');

    assert.equal(status, 200);
    assert.equal(body.source, 'lyric');
    assert.equal(body.lyric, '[00:00.00]Classic lyric');
    assert.deepEqual(calls.map(call => call[0]), ['lyric_new', 'lyric']);
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/lyric reports provider failures after fallback lookup fails', async () => {
  const originalError = console.error;
  console.error = () => {};
  server.__test.setNeteaseApi({
    lyric_new: async () => ({ body: {} }),
    lyric: async () => {
      throw new Error('lyric unavailable');
    },
  });

  try {
    const { status, body } = await getJson('/api/lyric?id=104');

    assert.equal(status, 500);
    assert.deepEqual(body, { error: 'lyric unavailable', lyric: '' });
  } finally {
    console.error = originalError;
  }
});

test('/api/song/url returns the first playable Netease URL', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    song_url_v1: async opts => {
      calls.push(['song_url_v1', opts]);
      return {
        body: {
          data: [
            { id: 101, url: 'https://audio.example/rain.mp3', br: 320000, code: 200 },
          ],
        },
      };
    },
    song_url: async opts => {
      calls.push(['song_url', opts]);
      return { body: { data: [] } };
    },
  });

  const { status, body } = await getJson('/api/song/url?id=101&quality=exhigh');

  assert.equal(status, 200);
  assert.equal(body.url, 'https://audio.example/rain.mp3');
  assert.equal(body.playable, true);
  assert.equal(body.trial, false);
  assert.equal(body.level, 'exhigh');
  assert.equal(body.quality, '极高');
  assert.equal(body.br, 320000);
  assert.equal(body.loggedIn, false);
  assert.deepEqual(calls.map(call => call[0]), ['song_url_v1']);
  assert.equal(calls[0][1].id, '101');
  assert.equal(calls[0][1].level, 'exhigh');
});

test('/api/song/url falls back to legacy Netease URL lookup when v1 fails', async () => {
  const calls = [];
  const originalLog = console.log;
  console.log = () => {};
  try {
    server.__test.setNeteaseApi({
      song_url_v1: async opts => {
        calls.push(['song_url_v1', opts]);
        throw new Error('v1 unavailable');
      },
      song_url: async opts => {
        calls.push(['song_url', opts]);
        return {
          body: {
            data: [
              { id: opts.id, url: 'https://audio.example/legacy.mp3', br: opts.br, code: 200 },
            ],
          },
        };
      },
    });

    const { status, body } = await getJson('/api/song/url?id=102&quality=exhigh');

    assert.equal(status, 200);
    assert.equal(body.url, 'https://audio.example/legacy.mp3');
    assert.equal(body.playable, true);
    assert.equal(body.trial, false);
    assert.equal(body.level, 'exhigh');
    assert.equal(body.br, 999000);
    assert.deepEqual(calls.map(call => call[0]), ['song_url_v1', 'song_url']);
    assert.equal(calls[1][1].br, 999000);
  } finally {
    console.log = originalLog;
  }
});

test('/api/song/url reports the last provider error when all Netease lookups fail', async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    server.__test.setNeteaseApi({
      song_url_v1: async () => {
        throw new Error('v1 unavailable');
      },
      song_url: async () => {
        throw new Error('legacy unavailable');
      },
    });

    const { status, body } = await getJson('/api/song/url?id=103&quality=standard');

    assert.equal(status, 200);
    assert.equal(body.url, null);
    assert.equal(body.playable, false);
    assert.equal(body.reason, 'login_required');
    assert.equal(body.error, 'legacy unavailable');
    assert.equal(body.lastCode, null);
    assert.equal(body.fee, null);
  } finally {
    console.log = originalLog;
  }
});

test('/api/song/url reports login_required when Netease returns no playable URL for a logged-out user', async () => {
  server.__test.setNeteaseApi({
    song_url_v1: async opts => ({
      body: {
        data: [
          { id: opts.id, url: null, fee: 1, code: 401 },
        ],
      },
    }),
    song_url: async () => ({ body: { data: [] } }),
  });

  const { status, body } = await getJson('/api/song/url?id=101&quality=standard');

  assert.equal(status, 200);
  assert.equal(body.url, null);
  assert.equal(body.playable, false);
  assert.equal(body.reason, 'login_required');
  assert.equal(body.loggedIn, false);
  assert.equal(body.restriction.provider, 'netease');
  assert.equal(body.restriction.action, 'login');
  assert.match(body.message, /需要登录/);
});

test('/api/song/url returns trial-only restriction metadata for logged-in Netease users', async () => {
  const calls = [];
  await loginAs({
    profile: { userId: 9304, nickname: 'Trial User', vipType: 0 },
  });
  server.__test.setNeteaseApi({
    login_status: async () => ({
      body: {
        data: {
          profile: { userId: 9304, nickname: 'Trial User', vipType: 0 },
          account: { id: 9304 },
        },
      },
    }),
    song_url_v1: async opts => {
      calls.push(['song_url_v1', opts]);
      return {
        body: {
          data: [
            {
              id: opts.id,
              url: 'https://audio.example/trial.mp3',
              br: 128000,
              code: 200,
              fee: 1,
              freeTrialInfo: { start: 0, end: 30 },
            },
          ],
        },
      };
    },
    song_url: async () => ({ body: { data: [] } }),
  });

  const { status, body } = await getJson('/api/song/url?id=101&quality=standard');

  assert.equal(status, 200);
  assert.equal(body.url, 'https://audio.example/trial.mp3');
  assert.equal(body.playable, true);
  assert.equal(body.trial, true);
  assert.equal(body.level, 'standard');
  assert.equal(body.loggedIn, true);
  assert.equal(body.restriction.category, 'trial_only');
  assert.equal(body.restriction.action, 'upgrade');
  assert.equal(body.restriction.fee, 1);
  assert.deepEqual(body.trialInfo, { start: 0, end: 30 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].cookie, 'MUSIC_U=test-user; __csrf=test-csrf');
});

test('/api/song/url classifies logged-in Netease playback restrictions', async () => {
  await loginAs({
    profile: { userId: 9305, nickname: 'Restricted User', vipType: 0 },
  });
  const cases = [
    {
      query: '/api/song/url?id=201&quality=standard',
      upstream: { id: '201', url: null, fee: 1, code: 200 },
      reason: 'vip_required',
      action: 'upgrade',
    },
    {
      query: '/api/song/url?id=202&quality=standard',
      upstream: { id: '202', url: null, fee: 4, code: 200 },
      reason: 'paid_required',
      action: 'purchase',
    },
    {
      query: '/api/song/url?id=203&quality=standard',
      upstream: { id: '203', url: null, fee: 0, code: 404 },
      reason: 'copyright_unavailable',
      action: 'switch_source',
    },
  ];

  for (const item of cases) {
    server.__test.setNeteaseApi({
      login_status: async () => ({
        body: {
          data: {
            profile: { userId: 9305, nickname: 'Restricted User', vipType: 0 },
            account: { id: 9305 },
          },
        },
      }),
      song_url_v1: async () => ({ body: { data: [item.upstream] } }),
      song_url: async () => ({ body: { data: [] } }),
    });

    const { status, body } = await getJson(item.query);

    assert.equal(status, 200);
    assert.equal(body.url, null);
    assert.equal(body.playable, false);
    assert.equal(body.loggedIn, true);
    assert.equal(body.reason, item.reason);
    assert.equal(body.restriction.category, item.reason);
    assert.equal(body.restriction.action, item.action);
    assert.equal(body.restriction.provider, 'netease');
  }
});

test('/api/qq/search maps smartbox results with song detail enrichment', async () => {
  const calls = [];
  const originalLog = console.log;
  console.log = () => {};
  setRequestTextResponder((targetUrl, opts, requestBody) => {
    calls.push({ targetUrl, method: opts.method || 'GET', requestBody });
    if (targetUrl.includes('smartbox_new.fcg')) {
      return {
        data: {
          song: {
            itemlist: [
              { id: '12001', mid: 'qqmid001', name: 'QQ Rain', singer: 'QQ Artist' },
            ],
          },
        },
      };
    }
    if (targetUrl.includes('musicu.fcg')) {
      return {
        songinfo: {
          data: {
            track_info: {
              id: 12001,
              mid: 'qqmid001',
              name: 'QQ Rain Detail',
              singer: [{ id: 66, mid: 'singer001', name: 'QQ Artist' }],
              album: { mid: 'album001', name: 'QQ Album' },
              interval: 188,
              pay: { pay_play: 0 },
              file: { media_mid: 'media001' },
            },
          },
        },
      };
    }
    throw new Error('unexpected request ' + targetUrl);
  });

  try {
    const { status, body } = await getJson('/api/qq/search?keywords=rain&limit=1');

    assert.equal(status, 200);
    assert.equal(body.provider, 'qq');
    assert.deepEqual(body.songs, [
      {
        provider: 'qq',
        source: 'qq',
        type: 'qq',
        id: 'qqmid001',
        qqId: 12001,
        mid: 'qqmid001',
        songmid: 'qqmid001',
        mediaMid: 'media001',
        name: 'QQ Rain Detail',
        artist: 'QQ Artist',
        artists: [{ id: 66, mid: 'singer001', name: 'QQ Artist' }],
        artistId: 66,
        artistMid: 'singer001',
        album: 'QQ Album',
        albumMid: 'album001',
        cover: 'https://y.qq.com/music/photo_new/T002R300x300M000album001.jpg?max_age=2592000',
        duration: 188000,
        fee: 0,
        playable: false,
      },
    ]);
    assert.equal(calls.length, 2);
    assert.match(calls[0].targetUrl, /smartbox_new\.fcg/);
    assert.match(calls[1].targetUrl, /musicu\.fcg/);
  } finally {
    console.log = originalLog;
  }
});

test('/api/qq/search keeps smartbox results when detail enrichment fails', async () => {
  const calls = [];
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};
  setRequestTextResponder((targetUrl, opts, requestBody) => {
    calls.push({ targetUrl, method: opts.method || 'GET', requestBody });
    if (targetUrl.includes('smartbox_new.fcg')) {
      return {
        data: {
          song: {
            itemlist: [
              { id: '12002', mid: 'qqmid002', name: 'QQ Fallback', singer: 'Fallback Artist' },
            ],
          },
        },
      };
    }
    if (targetUrl.includes('musicu.fcg')) {
      throw new Error('detail unavailable');
    }
    throw new Error('unexpected request ' + targetUrl);
  });

  try {
    const { status, body } = await getJson('/api/qq/search?keywords=fallback&limit=1');

    assert.equal(status, 200);
    assert.equal(body.provider, 'qq');
    assert.deepEqual(body.songs, [
      {
        provider: 'qq',
        source: 'qq',
        type: 'qq',
        id: 'qqmid002',
        qqId: '12002',
        mid: 'qqmid002',
        songmid: 'qqmid002',
        name: 'QQ Fallback',
        artist: 'Fallback Artist',
        artists: [{ name: 'Fallback Artist' }],
        album: '',
        cover: '',
        duration: 0,
        fee: 0,
        playable: false,
      },
    ]);
    assert.equal(calls.length, 2);
    assert.match(calls[0].targetUrl, /smartbox_new\.fcg/);
    assert.match(calls[1].targetUrl, /musicu\.fcg/);
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
});

test('/api/qq/search returns an empty list for blank keywords', async () => {
  let requested = false;
  setRequestTextResponder(() => {
    requested = true;
    return {};
  });

  const { status, body } = await getJson('/api/qq/search?keywords=%20%20');

  assert.equal(status, 200);
  assert.equal(body.provider, 'qq');
  assert.deepEqual(body.songs, []);
  assert.equal(requested, false);
});

test('/api/qq/search returns a provider error when smartbox search fails', async () => {
  const originalError = console.error;
  console.error = () => {};
  setRequestTextResponder(() => {
    throw new Error('qq search unavailable');
  });

  try {
    const { status, body } = await getJson('/api/qq/search?keywords=rain');

    assert.equal(status, 500);
    assert.deepEqual(body, { provider: 'qq', error: 'qq search unavailable', songs: [] });
  } finally {
    console.error = originalError;
  }
});

test('/api/qq/song/url returns the first playable QQ vkey URL', async () => {
  const calls = [];
  setRequestTextResponder((targetUrl, opts, requestBody) => {
    calls.push({ targetUrl, opts, payload: JSON.parse(requestBody) });
    return {
      req_0: {
        data: {
          sip: ['https://audio.qq.example/'],
          midurlinfo: [
            { filename: 'M800media001.mp3', purl: 'M800media001.mp3?vkey=abc' },
            { filename: 'C400media001.m4a', purl: 'C400media001.m4a?p=0' },
          ],
        },
      },
    };
  });

  const { status, body } = await getJson('/api/qq/song/url?mid=qqmid001&mediaMid=media001&quality=exhigh');

  assert.equal(status, 200);
  assert.equal(body.provider, 'qq');
  assert.equal(body.url, 'https://audio.qq.example/M800media001.mp3?vkey=abc');
  assert.equal(body.playable, true);
  assert.equal(body.trial, false);
  assert.equal(body.level, 'exhigh');
  assert.equal(body.quality, '320k MP3');
  assert.equal(body.requestedQuality, 'exhigh');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.req_0.param.songmid[0], 'qqmid001');
  assert.ok(calls[0].payload.req_0.param.filename.includes('M800media001.mp3'));
});

test('/api/qq/song/url reports a missing QQ mid without an upstream request', async () => {
  let requested = false;
  setRequestTextResponder(() => {
    requested = true;
    return {};
  });

  const { status, body } = await getJson('/api/qq/song/url');

  assert.equal(status, 200);
  assert.equal(body.provider, 'qq');
  assert.equal(body.url, '');
  assert.equal(body.error, 'MISSING_MID');
  assert.match(body.message, /Missing QQ song mid/);
  assert.equal(requested, false);
});

test('/api/qq/song/url returns a provider error when vkey lookup fails', async () => {
  const originalError = console.error;
  console.error = () => {};
  setRequestTextResponder(() => {
    throw new Error('vkey unavailable');
  });

  try {
    const { status, body } = await getJson('/api/qq/song/url?mid=qqmid001');

    assert.equal(status, 500);
    assert.deepEqual(body, {
      provider: 'qq',
      url: '',
      playable: false,
      error: 'vkey unavailable',
    });
  } finally {
    console.error = originalError;
  }
});

test('/api/qq/song/url reports login_required when QQ returns no URL for a logged-out user', async () => {
  const calls = [];
  setRequestTextResponder((targetUrl, opts, requestBody) => {
    calls.push({ targetUrl, payload: JSON.parse(requestBody) });
    return {
      req_0: {
        data: {
          midurlinfo: [
            { filename: 'M800media001.mp3', purl: '', result: 104003, msg: 'need login' },
          ],
        },
      },
    };
  });

  const { status, body } = await getJson('/api/qq/song/url?mid=qqmid001&mediaMid=media001&quality=exhigh');

  assert.equal(status, 200);
  assert.equal(body.provider, 'qq');
  assert.equal(body.playable, false);
  assert.equal(body.reason, 'login_required');
  assert.equal(body.loggedIn, false);
  assert.equal(body.playbackKeyReady, false);
  assert.equal(body.restriction.action, 'login');
  assert.equal(body.restriction.rawMessage, 'need login');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.comm.uin, '0');
});

test('/api/qq/song/url reports missing playback authorization for partial QQ sessions', async () => {
  const calls = [];
  setRequestTextResponder((targetUrl, opts, requestBody) => {
    if (targetUrl.includes('fcg_get_profile_homepage')) {
      return { data: { creator: { nick: 'Partial QQ User' } } };
    }
    calls.push({ targetUrl, payload: JSON.parse(requestBody) });
    return {
      req_0: {
        data: {
          midurlinfo: [
            { filename: 'M800media001.mp3', purl: '', result: 104003, msg: 'missing vkey' },
          ],
        },
      },
    };
  });
  await postJson('/api/qq/login/cookie', {
    cookie: 'uin=o12345; p_skey=web-session-key; ptnick_12345=Partial%20QQ%20User',
  });

  const { status, body } = await getJson('/api/qq/song/url?mid=qqmid001&mediaMid=media001&quality=exhigh');

  assert.equal(status, 200);
  assert.equal(body.provider, 'qq');
  assert.equal(body.playable, false);
  assert.equal(body.reason, 'login_required');
  assert.equal(body.loggedIn, true);
  assert.equal(body.playbackKeyReady, false);
  assert.equal(body.restriction.missingPlaybackKey, true);
  assert.match(body.message, /播放授权/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.comm.uin, '12345');
  assert.equal(calls[0].payload.comm.authst, 'web-session-key');
});

test('/api/qq/song/url classifies logged-in QQ playback restrictions', async () => {
  setRequestTextResponder(targetUrl => {
    if (targetUrl.includes('fcg_get_profile_homepage')) {
      return { data: { creator: { nick: 'Full QQ User' } } };
    }
    throw new Error('unexpected QQ request during login');
  });
  await postJson('/api/qq/login/cookie', {
    cookie: 'uin=o12345; qm_keyst=music-key; qqmusic_key=play-key; ptnick_12345=Full%20QQ%20User',
  });

  const cases = [
    {
      info: { filename: 'M800media001.mp3', purl: '', result: 104003, msg: 'copyright limited' },
      reason: 'copyright_unavailable',
      action: 'switch_source',
    },
    {
      info: { filename: 'M800media001.mp3', purl: '', result: 0, msg: 'VIP 会员付费歌曲' },
      reason: 'paid_required',
      action: 'upgrade',
    },
    {
      info: { filename: 'M800media001.mp3', purl: '', result: 5001, msg: 'only official client' },
      reason: 'copyright_unavailable',
      action: 'switch_source',
    },
    {
      info: { filename: 'M800media001.mp3', purl: '', result: 0, msg: '' },
      reason: 'url_unavailable',
      action: 'switch_source',
    },
  ];

  for (const item of cases) {
    const calls = [];
    setRequestTextResponder((targetUrl, opts, requestBody) => {
      calls.push({ targetUrl, payload: JSON.parse(requestBody) });
      return {
        req_0: {
          data: {
            midurlinfo: [item.info],
          },
        },
      };
    });

    const { status, body } = await getJson('/api/qq/song/url?mid=qqmid001&mediaMid=media001&quality=exhigh');

    assert.equal(status, 200);
    assert.equal(body.provider, 'qq');
    assert.equal(body.playable, false);
    assert.equal(body.loggedIn, true);
    assert.equal(body.playbackKeyReady, true);
    assert.equal(body.reason, item.reason);
    assert.equal(body.restriction.category, item.reason);
    assert.equal(body.restriction.action, item.action);
    assert.equal(body.restriction.provider, 'qq');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].payload.comm.uin, '12345');
    assert.equal(calls[0].payload.comm.authst, 'music-key');
  }
});

test('/api/qq/lyric requires a QQ song mid or id', async () => {
  const { status, body } = await getJson('/api/qq/lyric');

  assert.equal(status, 400);
  assert.equal(body.provider, 'qq');
  assert.equal(body.error, 'Missing QQ song mid or id');
  assert.equal(body.lyric, '');
});

test('/api/qq/lyric returns decoded musicu lyric data', async () => {
  const calls = [];
  setRequestTextResponder((targetUrl, opts, requestBody) => {
    calls.push({ targetUrl, payload: JSON.parse(requestBody) });
    return {
      lyric: {
        data: {
          lyric: Buffer.from('[00:00.00]QQ Rain').toString('base64'),
          trans: '[00:00.00]QQ 雨',
          qrc: '[0,1000]QQ Rain',
          roma: '[00:00.00]Q Q Rain',
        },
      },
    };
  });

  const { status, body } = await getJson('/api/qq/lyric?mid=qqmid001&id=12001');

  assert.equal(status, 200);
  assert.equal(body.provider, 'qq');
  assert.equal(body.id, 12001);
  assert.equal(body.mid, 'qqmid001');
  assert.equal(body.lyric, '[00:00.00]QQ Rain');
  assert.equal(body.tlyric, '[00:00.00]QQ 雨');
  assert.equal(body.qrc, '[0,1000]QQ Rain');
  assert.equal(body.roma, '[00:00.00]Q Q Rain');
  assert.equal(body.source, 'qq-musicu');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.lyric.param.songMID, 'qqmid001');
  assert.equal(calls[0].payload.lyric.param.songID, 12001);
});

test('/api/qq/lyric returns an empty lyric payload when all QQ lyric lookups fail', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  setRequestTextResponder(() => {
    throw new Error('qq lyric unavailable');
  });

  try {
    const { status, body } = await getJson('/api/qq/lyric?mid=qqmid001');

    assert.equal(status, 200);
    assert.deepEqual(body, {
      provider: 'qq',
      id: '',
      mid: 'qqmid001',
      lyric: '',
      tlyric: '',
      yrc: '',
      qrc: '',
      roma: '',
      source: 'qq-empty',
    });
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/qq/login/cookie rejects invalid QQ cookies', async () => {
  const { status, body } = await postJson('/api/qq/login/cookie', {
    cookie: 'uin=o12345; ptnick=QQ%20User',
  });

  assert.equal(status, 400);
  assert.equal(body.provider, 'qq');
  assert.equal(body.loggedIn, false);
  assert.equal(body.error, 'INVALID_QQ_COOKIE');
  assert.match(body.message, /uin/);
});

test('/api/qq/login/cookie saves a valid QQ cookie and falls back when profile lookup fails', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  setRequestTextResponder(() => {
    throw new Error('profile unavailable');
  });

  try {
    const { status, body } = await postJson('/api/qq/login/cookie', {
      cookie: 'uin=o12345; qm_keyst=music-key; ptnick_12345=QQ%20User; qqmusic_key=play-key',
    });

    assert.equal(status, 200);
    assert.equal(body.provider, 'qq');
    assert.equal(body.loggedIn, true);
    assert.equal(body.saved, true);
    assert.equal(body.hasCookie, true);
    assert.equal(body.userId, '12345');
    assert.equal(body.nickname, 'QQ User');
    assert.equal(body.playbackKeyReady, true);
    assert.equal(body.profileUnavailable, true);
    assert.equal(fs.readFileSync(process.env.QQ_COOKIE_FILE, 'utf8'), 'uin=12345; qm_keyst=music-key; ptnick_12345=QQ%20User; qqmusic_key=play-key');
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/qq/login/cookie falls back when QQ profile reports auth unavailable', async () => {
  setRequestTextResponder(() => ({ code: 1000, message: 'login expired' }));

  const { status, body } = await postJson('/api/qq/login/cookie', {
    cookie: 'uin=o67890; qm_keyst=music-key; qqmusic_key=play-key; ptnick_67890=Expired%20QQ',
  });

  assert.equal(status, 200);
  assert.equal(body.provider, 'qq');
  assert.equal(body.loggedIn, true);
  assert.equal(body.saved, true);
  assert.equal(body.userId, '67890');
  assert.equal(body.nickname, 'Expired QQ');
  assert.equal(body.profileSource, 'cookie');
  assert.equal(body.profileUnavailable, true);
  assert.equal(body.playbackKeyReady, true);
});

test('/api/qq/login/cookie maps QQ profile data from a successful lookup', async () => {
  const calls = [];
  setRequestTextResponder((targetUrl, opts) => {
    calls.push({ targetUrl, cookie: opts.headers.Cookie });
    return {
      data: {
        creator: {
          nick: 'Profile QQ User',
          headpic: 'https://img.example/qq-profile.jpg',
          green_vip_level: 3,
        },
      },
    };
  });

  const { status, body } = await postJson('/api/qq/login/cookie', {
    cookie: 'uin=o12345; qm_keyst=music-key; qqmusic_key=play-key; ptnick_12345=Cookie%20QQ%20User',
  });

  assert.equal(status, 200);
  assert.equal(body.provider, 'qq');
  assert.equal(body.loggedIn, true);
  assert.equal(body.saved, true);
  assert.equal(body.userId, '12345');
  assert.equal(body.nickname, 'Profile QQ User');
  assert.equal(body.avatar, 'https://img.example/qq-profile.jpg');
  assert.equal(body.vipType, 3);
  assert.equal(body.playbackKeyReady, true);
  assert.equal(body.profileSource, 'qq-profile');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].targetUrl.includes('userid=12345'), true);
  assert.equal(calls[0].cookie, 'uin=12345; qm_keyst=music-key; qqmusic_key=play-key; ptnick_12345=Cookie%20QQ%20User');
});

test('/api/qq/login/cookie accepts web sessions without playback authorization', async () => {
  setRequestTextResponder(() => ({
    data: { creator: { nick: 'Web QQ User' } },
  }));

  const { status, body } = await postJson('/api/qq/login/cookie', {
    cookie: 'uin=o12345; p_skey=web-session-key; ptnick_12345=Web%20QQ%20User',
  });

  assert.equal(status, 200);
  assert.equal(body.provider, 'qq');
  assert.equal(body.loggedIn, true);
  assert.equal(body.saved, true);
  assert.equal(body.userId, '12345');
  assert.equal(body.nickname, 'Web QQ User');
  assert.equal(body.hasCookie, true);
  assert.equal(body.playbackKeyReady, false);
  assert.equal(fs.readFileSync(process.env.QQ_COOKIE_FILE, 'utf8'), 'uin=12345; p_skey=web-session-key; ptnick_12345=Web%20QQ%20User');
});

test('/api/qq/login/status returns logged-out defaults without a saved QQ cookie', async () => {
  let requested = false;
  setRequestTextResponder(() => {
    requested = true;
    return {};
  });

  const { status, body } = await getJson('/api/qq/login/status');

  assert.equal(status, 200);
  assert.deepEqual(body, { provider: 'qq', loggedIn: false, hasCookie: false });
  assert.equal(requested, false);
});

test('/api/qq/logout clears the saved QQ cookie', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  setRequestTextResponder(() => {
    throw new Error('profile unavailable');
  });

  try {
    await postJson('/api/qq/login/cookie', {
      cookie: 'uin=o12345; qm_keyst=music-key; qqmusic_key=play-key',
    });

    const { status, body } = await getJson('/api/qq/logout');

    assert.equal(status, 200);
    assert.deepEqual(body, { provider: 'qq', ok: true, loggedIn: false });
    assert.equal(fs.readFileSync(process.env.QQ_COOKIE_FILE, 'utf8'), '');

    const lookup = await getJson('/api/qq/login/status');
    assert.equal(lookup.body.loggedIn, false);
    assert.equal(lookup.body.hasCookie, false);
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/qq/user/playlists returns an empty list when logged out', async () => {
  let requested = false;
  setRequestTextResponder(() => {
    requested = true;
    return {};
  });

  const { status, body } = await getJson('/api/qq/user/playlists');

  assert.equal(status, 200);
  assert.deepEqual(body, { loggedIn: false, provider: 'qq', playlists: [] });
  assert.equal(requested, false);
});

test('/api/qq/user/playlists maps created and collected QQ playlists', async () => {
  const calls = [];
  setRequestTextResponder(targetUrl => {
    calls.push(targetUrl);
    if (targetUrl.includes('fcg_get_profile_homepage.fcg')) {
      return { data: { creator: { nick: 'QQ Profile', headpic: 'https://img.example/qq-profile.jpg' } } };
    }
    if (targetUrl.includes('fcg_user_created_diss')) {
      return {
        data: {
          disslist: [
            {
              dissid: 'created-1',
              diss_name: 'QQ Created',
              diss_cover: 'https://img.example/created.jpg',
              song_cnt: 12,
              listen_num: 345,
              hostname: 'QQ Profile',
            },
            {
              dissid: 'qzone-1',
              diss_name: 'Qzone 背景音乐',
              hostname: '空间',
            },
          ],
        },
      };
    }
    if (targetUrl.includes('fcg_get_profile_order_asset.fcg')) {
      return {
        data: {
          cdlist: [
            {
              dissid: 'created-1',
              diss_name: 'Duplicate Collected',
            },
            {
              dissid: 'fav-1',
              diss_name: '我喜欢的音乐',
              diss_cover: 'https://img.example/favorite.jpg',
              songnum: 21,
              visitnum: 678,
              nick: 'QQ Profile',
            },
          ],
        },
      };
    }
    throw new Error('unexpected request ' + targetUrl);
  });
  await postJson('/api/qq/login/cookie', {
    cookie: 'uin=o12345; qm_keyst=music-key; qqmusic_key=play-key',
  });

  const { status, body } = await getJson('/api/qq/user/playlists');

  assert.equal(status, 200);
  assert.equal(body.provider, 'qq');
  assert.equal(body.loggedIn, true);
  assert.equal(body.userId, '12345');
  assert.deepEqual(body.playlists, [
    {
      provider: 'qq',
      source: 'qq',
      id: 'fav-1',
      name: '我喜欢的音乐',
      cover: 'https://img.example/favorite.jpg',
      trackCount: 21,
      playCount: 678,
      creator: 'QQ Profile',
      subscribed: true,
      specialType: 0,
    },
    {
      provider: 'qq',
      source: 'qq',
      id: 'created-1',
      name: 'QQ Created',
      cover: 'https://img.example/created.jpg',
      trackCount: 12,
      playCount: 345,
      creator: 'QQ Profile',
      subscribed: false,
      specialType: 0,
    },
  ]);
  assert.equal(calls.filter(url => url.includes('fcg_get_profile_homepage.fcg')).length, 2);
  assert.equal(calls.some(url => url.includes('hostuin=12345')), true);
  assert.equal(calls.some(url => url.includes('userid=12345')), true);
});

test('/api/qq/user/playlists keeps collected playlists when created list fails', async () => {
  const calls = [];
  setRequestTextResponder(targetUrl => {
    calls.push(targetUrl);
    if (targetUrl.includes('fcg_get_profile_homepage.fcg')) {
      return { data: { creator: { nick: 'QQ Profile' } } };
    }
    if (targetUrl.includes('fcg_user_created_diss')) {
      throw new Error('created list unavailable');
    }
    if (targetUrl.includes('fcg_get_profile_order_asset.fcg')) {
      return {
        data: {
          cdlist: [
            {
              dissid: 'collect-1',
              diss_name: 'Collected Only',
              diss_cover: 'https://img.example/collected-only.jpg',
              songnum: 9,
              visitnum: 88,
              nick: 'QQ Profile',
            },
          ],
        },
      };
    }
    throw new Error('unexpected request ' + targetUrl);
  });
  await postJson('/api/qq/login/cookie', {
    cookie: 'uin=o12345; qm_keyst=music-key; qqmusic_key=play-key',
  });

  const { status, body } = await getJson('/api/qq/user/playlists');

  assert.equal(status, 200);
  assert.equal(body.provider, 'qq');
  assert.equal(body.loggedIn, true);
  assert.deepEqual(body.playlists, [
    {
      provider: 'qq',
      source: 'qq',
      id: 'collect-1',
      name: 'Collected Only',
      cover: 'https://img.example/collected-only.jpg',
      trackCount: 9,
      playCount: 88,
      creator: 'QQ Profile',
      subscribed: true,
      specialType: 0,
    },
  ]);
  assert.equal(calls.some(url => url.includes('fcg_user_created_diss')), true);
  assert.equal(calls.some(url => url.includes('fcg_get_profile_order_asset.fcg')), true);
});

test('/api/qq/playlist/tracks returns an empty list when logged out', async () => {
  let requested = false;
  setRequestTextResponder(() => {
    requested = true;
    return {};
  });

  const { status, body } = await getJson('/api/qq/playlist/tracks?id=77');

  assert.equal(status, 200);
  assert.deepEqual(body, { loggedIn: false, provider: 'qq', tracks: [] });
  assert.equal(requested, false);
});

test('/api/qq/playlist/tracks maps QQ playlist detail tracks', async () => {
  const calls = [];
  setRequestTextResponder(targetUrl => {
    calls.push(targetUrl);
    if (targetUrl.includes('fcg_get_profile_homepage.fcg')) {
      return { data: { creator: { nick: 'QQ Profile' } } };
    }
    if (targetUrl.includes('fcg_ucc_getcdinfo_byids_cp.fcg')) {
      return {
        cdlist: [
          {
            dissname: 'QQ Track List',
            logo: 'https://img.example/qq-playlist.jpg',
            songlist: [
              {
                id: 22001,
                mid: 'trackmid001',
                name: 'QQ Track',
                singer: [{ id: 66, mid: 'singer001', name: 'QQ Artist' }],
                album: { mid: 'albummid001', name: 'QQ Album' },
                interval: 201,
                file: { media_mid: 'media-track-001' },
                pay: { pay_play: 1 },
              },
            ],
          },
        ],
      };
    }
    throw new Error('unexpected request ' + targetUrl);
  });
  await postJson('/api/qq/login/cookie', {
    cookie: 'uin=o12345; qm_keyst=music-key; qqmusic_key=play-key',
  });

  const { status, body } = await getJson('/api/qq/playlist/tracks?id=77');

  assert.equal(status, 200);
  assert.equal(body.provider, 'qq');
  assert.equal(body.loggedIn, true);
  assert.deepEqual(body.playlist, {
    provider: 'qq',
    id: '77',
    name: 'QQ Track List',
    cover: 'https://img.example/qq-playlist.jpg',
    trackCount: 1,
  });
  assert.equal(body.tracks.length, 1);
  assert.equal(body.tracks[0].id, 'trackmid001');
  assert.equal(body.tracks[0].qqId, 22001);
  assert.equal(body.tracks[0].artist, 'QQ Artist');
  assert.equal(body.tracks[0].album, 'QQ Album');
  assert.equal(body.tracks[0].cover, 'https://y.qq.com/music/photo_new/T002R300x300M000albummid001.jpg?max_age=2592000');
  assert.equal(body.tracks[0].duration, 201000);
  assert.equal(body.tracks[0].fee, 1);
  assert.equal(calls.some(url => url.includes('disstid=77')), true);
  assert.equal(calls.some(url => url.includes('loginUin=12345')), true);
});

test('/api/qq/playlist/tracks returns a provider error when detail lookup fails', async () => {
  const originalError = console.error;
  console.error = () => {};
  setRequestTextResponder(targetUrl => {
    if (targetUrl.includes('fcg_get_profile_homepage.fcg')) {
      return { data: { creator: { nick: 'QQ Profile' } } };
    }
    if (targetUrl.includes('fcg_ucc_getcdinfo_byids_cp.fcg')) {
      throw new Error('playlist detail unavailable');
    }
    throw new Error('unexpected request ' + targetUrl);
  });

  try {
    await postJson('/api/qq/login/cookie', {
      cookie: 'uin=o12345; qm_keyst=music-key; qqmusic_key=play-key',
    });
    const { status, body } = await getJson('/api/qq/playlist/tracks?id=77');

    assert.equal(status, 500);
    assert.deepEqual(body, {
      provider: 'qq',
      error: 'playlist detail unavailable',
      tracks: [],
    });
  } finally {
    console.error = originalError;
  }
});

test('/api/qq/artist/detail requires a singer mid', async () => {
  const { status, body } = await getJson('/api/qq/artist/detail');

  assert.equal(status, 400);
  assert.deepEqual(body, { provider: 'qq', error: 'MISSING_SINGER_MID', artist: null, songs: [] });
});

test('/api/qq/artist/detail maps QQ artist and hot songs', async () => {
  const calls = [];
  setRequestTextResponder((targetUrl, opts, requestBody) => {
    calls.push({ targetUrl, payload: JSON.parse(requestBody) });
    return {
      singer: {
        code: 0,
        data: {
          singer_info: {
            id: 66,
            mid: 'singer001',
            name: 'QQ Artist',
            pic: 'https://img.example/singer.jpg',
            fans: 1234,
          },
          total_song: 42,
          total_album: 5,
          total_mv: 3,
          songlist: [
            {
              track_info: {
                id: 33001,
                mid: 'artisttrack001',
                name: 'Artist Track',
                singer: [{ id: 66, mid: 'singer001', name: 'QQ Artist' }],
                album: { mid: 'artistalbum001', name: 'Artist Album' },
                interval: 199,
                pay: { pay_play: 0 },
                file: { media_mid: 'artist-media-001' },
              },
            },
          ],
        },
      },
    };
  });

  const { status, body } = await getJson('/api/qq/artist/detail?mid=singer001&limit=4');

  assert.equal(status, 200);
  assert.equal(body.provider, 'qq');
  assert.deepEqual(body.artist, {
    provider: 'qq',
    id: 66,
    mid: 'singer001',
    name: 'QQ Artist',
    avatar: 'https://img.example/singer.jpg',
    fans: 1234,
    musicSize: 42,
    albumSize: 5,
    mvSize: 3,
  });
  assert.equal(body.total, 42);
  assert.equal(body.songs.length, 1);
  assert.equal(body.songs[0].id, 'artisttrack001');
  assert.equal(body.songs[0].artist, 'QQ Artist');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.singer.param.singermid, 'singer001');
  assert.equal(calls[0].payload.singer.param.num, 10);
});

test('/api/qq/artist/detail falls back to song artist names and generated avatars', async () => {
  setRequestTextResponder((targetUrl, opts, requestBody) => {
    assert.equal(JSON.parse(requestBody).singer.param.singermid, 'fallbackSinger');
    return {
      singer: {
        code: 0,
        data: {
          singer_info: {},
          song_count: 1,
          songlist: [
            {
              track_info: {
                id: 33002,
                mid: 'fallback-track',
                name: 'Fallback Track',
                singer: [{ id: 77, mid: 'fallbackSinger', name: 'Fallback Artist' }],
                album: { name: 'Fallback Album' },
                interval: 201,
              },
            },
          ],
        },
      },
    };
  });

  const { status, body } = await getJson('/api/qq/artist/detail?mid=fallbackSinger');

  assert.equal(status, 200);
  assert.equal(body.artist.mid, 'fallbackSinger');
  assert.equal(body.artist.name, 'Fallback Artist');
  assert.equal(body.artist.avatar, 'https://y.qq.com/music/photo_new/T001R300x300M000fallbackSinger.jpg?max_age=2592000');
  assert.equal(body.artist.musicSize, 1);
  assert.equal(body.songs[0].artistMid, 'fallbackSinger');
});

test('/api/qq/artist/detail returns a provider error when singer lookup fails', async () => {
  const originalError = console.error;
  console.error = () => {};
  setRequestTextResponder(() => {
    throw new Error('artist detail unavailable');
  });

  try {
    const { status, body } = await getJson('/api/qq/artist/detail?mid=singer001');

    assert.equal(status, 500);
    assert.deepEqual(body, {
      provider: 'qq',
      error: 'artist detail unavailable',
      artist: null,
      songs: [],
    });
  } finally {
    console.error = originalError;
  }
});

test('/api/artist/detail requires an artist id', async () => {
  const { status, body } = await getJson('/api/artist/detail');

  assert.equal(status, 400);
  assert.deepEqual(body, { error: 'Missing artist id', songs: [] });
});

test('/api/artist/detail maps artist metadata and hot songs', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    artist_detail: async opts => {
      calls.push(['artist_detail', opts]);
      return {
        body: {
          artist: {
            id: 66,
            name: 'Netease Artist',
            picUrl: 'https://img.example/artist.jpg',
            briefDesc: 'A test artist',
            musicSize: 42,
            albumSize: 5,
          },
        },
      };
    },
    artist_songs: async opts => {
      calls.push(['artist_songs', opts]);
      return {
        body: {
          songs: [
            {
              id: 33001,
              name: 'Artist Hot Song',
              ar: [{ id: 66, name: 'Netease Artist' }],
              al: { name: 'Artist Album', picUrl: 'https://img.example/song.jpg' },
              dt: 199000,
              fee: 0,
            },
          ],
        },
      };
    },
    artist_top_song: async opts => {
      calls.push(['artist_top_song', opts]);
      return { body: { songs: [] } };
    },
  });

  const { status, body } = await getJson('/api/artist/detail?id=66&limit=4');

  assert.equal(status, 200);
  assert.deepEqual(body.artist, {
    id: 66,
    name: 'Netease Artist',
    avatar: 'https://img.example/artist.jpg',
    brief: 'A test artist',
    musicSize: 42,
    albumSize: 5,
  });
  assert.equal(body.songs.length, 1);
  assert.equal(body.songs[0].id, 33001);
  assert.equal(body.songs[0].artist, 'Netease Artist');
  assert.equal(body.songs[0].album, 'Artist Album');
  assert.equal(body.songs[0].cover, 'https://img.example/song.jpg');
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'artist_detail');
  assert.equal(calls[0][1].id, '66');
  assert.equal(calls[1][0], 'artist_songs');
  assert.equal(calls[1][1].limit, 10);
});

test('/api/artist/detail falls back to top songs when hot songs are empty', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    artist_detail: async opts => {
      calls.push(['artist_detail', opts]);
      return {
        body: {
          data: {
            artist: {
              id: 77,
              artistName: 'Fallback Artist',
              img1v1Url: 'https://img.example/fallback.jpg',
              description: 'Fallback bio',
              songSize: 9,
              albumSize: 2,
            },
          },
        },
      };
    },
    artist_songs: async opts => {
      calls.push(['artist_songs', opts]);
      return { body: { data: { songs: [] } } };
    },
    artist_top_song: async opts => {
      calls.push(['artist_top_song', opts]);
      return {
        body: {
          songs: [
            {
              id: 44001,
              name: 'Top Song',
              artists: [{ id: 77, name: 'Fallback Artist' }],
              album: { name: 'Top Album', coverUrl: 'https://img.example/top.jpg' },
              duration: 201000,
              fee: 1,
            },
          ],
        },
      };
    },
  });

  const { status, body } = await getJson('/api/artist/detail?id=77&limit=80');

  assert.equal(status, 200);
  assert.deepEqual(body.artist, {
    id: 77,
    name: 'Fallback Artist',
    avatar: 'https://img.example/fallback.jpg',
    brief: 'Fallback bio',
    musicSize: 9,
    albumSize: 2,
  });
  assert.equal(body.songs.length, 1);
  assert.equal(body.songs[0].id, 44001);
  assert.equal(body.songs[0].duration, 201000);
  assert.deepEqual(calls.map(call => call[0]), ['artist_detail', 'artist_songs', 'artist_top_song']);
  assert.equal(calls[1][1].limit, 80);
});

test('/api/artist/detail falls back when detail and hot songs fail', async () => {
  const calls = [];
  const originalWarn = console.warn;
  console.warn = () => {};
  server.__test.setNeteaseApi({
    artist_detail: async opts => {
      calls.push(['artist_detail', opts]);
      throw new Error('detail unavailable');
    },
    artist_songs: async opts => {
      calls.push(['artist_songs', opts]);
      throw new Error('hot songs unavailable');
    },
    artist_top_song: async opts => {
      calls.push(['artist_top_song', opts]);
      return {
        body: {
          songs: [
            {
              id: 44002,
              name: 'Recovered Top Song',
              artists: [{ id: 78, name: 'Recovered Artist' }],
              album: { name: 'Recovered Album', coverUrl: 'https://img.example/recovered.jpg' },
              duration: 177000,
            },
          ],
        },
      };
    },
  });

  try {
    const { status, body } = await getJson('/api/artist/detail?id=78&limit=20');

    assert.equal(status, 200);
    assert.deepEqual(body.artist, {
      id: '78',
      name: '',
      avatar: '',
      brief: '',
      musicSize: 0,
      albumSize: 0,
    });
    assert.equal(body.songs.length, 1);
    assert.equal(body.songs[0].id, 44002);
    assert.deepEqual(calls.map(call => call[0]), ['artist_detail', 'artist_songs', 'artist_top_song']);
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/artist/detail reports errors when all song lookups fail', async () => {
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = () => {};
  console.error = () => {};
  server.__test.setNeteaseApi({
    artist_detail: async () => ({ body: {} }),
    artist_songs: async () => ({ body: { songs: [] } }),
    artist_top_song: async () => {
      throw new Error('top songs unavailable');
    },
  });

  try {
    const { status, body } = await getJson('/api/artist/detail?id=79');

    assert.equal(status, 500);
    assert.deepEqual(body, { error: 'top songs unavailable', songs: [] });
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }
});

test('/api/qq/song/comments requires a QQ song id when detail lookup cannot resolve one', async () => {
  let requested = false;
  setRequestTextResponder(() => {
    requested = true;
    return {};
  });

  const { status, body } = await getJson('/api/qq/song/comments');

  assert.equal(status, 200);
  assert.deepEqual(body, { provider: 'qq', error: 'Missing QQ song id', comments: [] });
  assert.equal(requested, false);
});

test('/api/qq/song/comments returns missing id when detail fallback fails', async () => {
  const calls = [];
  const originalWarn = console.warn;
  console.warn = () => {};
  setRequestTextResponder((targetUrl, opts, requestBody) => {
    calls.push({ targetUrl, requestBody });
    if (targetUrl.includes('musicu.fcg')) {
      throw new Error('detail unavailable');
    }
    throw new Error('unexpected request ' + targetUrl);
  });

  try {
    const { status, body } = await getJson('/api/qq/song/comments?mid=qqmid-missing-id');

    assert.equal(status, 200);
    assert.equal(body.provider, 'qq');
    assert.equal(body.error, 'Missing QQ song id');
    assert.deepEqual(body.comments, []);
    assert.equal(calls.length, 1);
    assert.match(calls[0].targetUrl, /musicu\.fcg/);
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/qq/song/comments maps first-page hot QQ comments', async () => {
  const calls = [];
  setRequestTextResponder(targetUrl => {
    calls.push(targetUrl);
    if (targetUrl.includes('fcg_global_comment_h5.fcg')) {
      return {
        comment: { commenttotal: 7, commentlist: [] },
        hot_comment: {
          commentlist: [
            {
              commentid: 'comment-1',
              rootcommentcontent: 'QQ hot comment',
              praisenum: 8,
              time: 1710000000,
              encrypt_uin: 'encrypted-user',
              nick: 'QQ Listener',
              avatarurl: 'https://img.example/commenter.jpg',
            },
            {
              commentid: 'comment-empty',
              rootcommentcontent: '',
            },
          ],
        },
      };
    }
    throw new Error('unexpected request ' + targetUrl);
  });

  const { status, body } = await getJson('/api/qq/song/comments?id=22001&mid=trackmid001&limit=6&offset=0');

  assert.equal(status, 200);
  assert.equal(body.provider, 'qq');
  assert.equal(body.id, '22001');
  assert.equal(body.total, 7);
  assert.equal(body.hot, true);
  assert.deepEqual(body.comments, [
    {
      id: 'comment-1',
      content: 'QQ hot comment',
      likedCount: 8,
      time: 1710000000000,
      user: {
        id: 'encrypted-user',
        nickname: 'QQ Listener',
        avatar: 'https://img.example/commenter.jpg',
      },
    },
  ]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].includes('topid=22001'), true);
  assert.equal(calls[0].includes('pagesize=6'), true);
  assert.equal(calls[0].includes('pagenum=0'), true);
});

test('/api/qq/song/comments returns a provider error when comments lookup fails', async () => {
  const originalError = console.error;
  console.error = () => {};
  setRequestTextResponder(() => {
    throw new Error('comments unavailable');
  });

  try {
    const { status, body } = await getJson('/api/qq/song/comments?id=22001&limit=6');

    assert.equal(status, 500);
    assert.deepEqual(body, {
      provider: 'qq',
      error: 'comments unavailable',
      comments: [],
    });
  } finally {
    console.error = originalError;
  }
});

test('/api/login/status returns logged-out defaults without a saved cookie', async () => {
  const { status, body } = await getJson('/api/login/status');

  assert.equal(status, 200);
  assert.equal(body.loggedIn, false);
  assert.equal(body.vipType, 0);
  assert.equal(body.vipLevel, 'none');
  assert.equal(body.isVip, false);
  assert.equal(body.isSvip, false);
  assert.equal(body.vipLabel, '无VIP');
});

test('/api/login/cookie rejects cookies without MUSIC_U', async () => {
  const { status, body } = await postJson('/api/login/cookie', {
    cookie: 'NMTID=abc; __csrf=token',
  });

  assert.equal(status, 400);
  assert.equal(body.loggedIn, false);
  assert.equal(body.error, 'INVALID_NETEASE_COOKIE');
  assert.match(body.message, /MUSIC_U/);
});

test('/api/login/cookie saves a valid Netease cookie and returns profile info', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    login_status: async opts => {
      calls.push(['login_status', opts]);
      return {
        body: {
          data: {
            profile: {
              userId: 9001,
              nickname: 'Rain User',
              avatarUrl: 'https://img.example/avatar.jpg',
              vipType: 11,
            },
            account: { id: 9001 },
          },
        },
      };
    },
  });

  const { status, body } = await postJson('/api/login/cookie', {
    cookie: 'MUSIC_U=secret; __csrf=token; ignoredFlag',
  });

  assert.equal(status, 200);
  assert.equal(body.loggedIn, true);
  assert.equal(body.saved, true);
  assert.equal(body.hasCookie, true);
  assert.equal(body.userId, 9001);
  assert.equal(body.nickname, 'Rain User');
  assert.equal(body.avatar, 'https://img.example/avatar.jpg');
  assert.equal(body.vipLevel, 'svip');
  assert.equal(body.isSvip, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].cookie, 'MUSIC_U=secret; __csrf=token');
  assert.equal(fs.readFileSync(process.env.COOKIE_FILE, 'utf8'), 'MUSIC_U=secret; __csrf=token');
});

test('/api/login/status falls back to account lookup when login_status fails', async () => {
  const calls = [];
  const originalWarn = console.warn;
  console.warn = () => {};
  server.__test.setNeteaseApi({
    login_status: async opts => {
      calls.push(['login_status', opts]);
      throw new Error('status unavailable');
    },
    user_account: async opts => {
      calls.push(['user_account', opts]);
      return {
        body: {
          profile: {
            userId: 9204,
            nickname: 'Fallback User',
            avatarUrl: 'https://img.example/fallback.jpg',
          },
          account: { id: 9204, vipFlag: 1 },
        },
      };
    },
  });

  try {
    await postJson('/api/login/cookie', { cookie: 'MUSIC_U=fallback-secret; __csrf=fallback-token' });
    const { status, body } = await getJson('/api/login/status');

    assert.equal(status, 200);
    assert.equal(body.loggedIn, true);
    assert.equal(body.userId, 9204);
    assert.equal(body.nickname, 'Fallback User');
    assert.equal(body.avatar, 'https://img.example/fallback.jpg');
    assert.equal(body.vipLevel, 'vip');
    assert.equal(body.isVip, true);
    assert.equal(body.isSvip, false);
    assert.deepEqual(calls.map(item => item[0]), ['login_status', 'user_account', 'login_status', 'user_account']);
    assert.equal(calls[0][1].cookie, 'MUSIC_U=fallback-secret; __csrf=fallback-token');
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/login/status clears cookies when account lookup reports invalid auth', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    server.__test.setNeteaseApi({
      login_status: async () => {
        throw new Error('status unavailable');
      },
      user_account: async () => ({ body: { code: 401, message: '需要登录' } }),
    });
    const invalid = await postJson('/api/login/cookie', { cookie: 'MUSIC_U=expired-secret; __csrf=expired-token' });

    assert.equal(invalid.status, 200);
    assert.equal(invalid.body.loggedIn, false);
    assert.equal(invalid.body.hasCookie, false);
    assert.equal(fs.readFileSync(process.env.COOKIE_FILE, 'utf8'), '');
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/login/status clears cookies when account lookup message reports invalid auth', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    server.__test.setNeteaseApi({
      login_status: async () => {
        throw new Error('status unavailable');
      },
      user_account: async () => ({ body: { code: 403, message: '请先登录后再访问' } }),
    });
    const invalid = await postJson('/api/login/cookie', { cookie: 'MUSIC_U=message-expired; __csrf=message-token' });

    assert.equal(invalid.status, 200);
    assert.equal(invalid.body.loggedIn, false);
    assert.equal(invalid.body.hasCookie, false);
    assert.equal(fs.readFileSync(process.env.COOKIE_FILE, 'utf8'), '');
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/login/status keeps cookies when account lookup fails unexpectedly', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    server.__test.setNeteaseApi({
      login_status: async () => {
        throw new Error('status unavailable');
      },
      user_account: async () => {
        throw new Error('account unavailable');
      },
    });
    const failed = await postJson('/api/login/cookie', { cookie: 'MUSIC_U=kept-secret; __csrf=kept-token' });

    assert.equal(failed.status, 200);
    assert.equal(failed.body.loggedIn, true);
    assert.equal(failed.body.pendingProfile, true);
    assert.equal(failed.body.hasCookie, true);
    assert.equal(fs.readFileSync(process.env.COOKIE_FILE, 'utf8'), 'MUSIC_U=kept-secret; __csrf=kept-token');

    const lookup = await getJson('/api/login/status');
    assert.equal(lookup.status, 200);
    assert.equal(lookup.body.loggedIn, false);
    assert.equal(lookup.body.hasCookie, true);
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/login/cookie accepts form-encoded cookie submissions', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    login_status: async opts => {
      calls.push(['login_status', opts]);
      return {
        body: {
          data: {
            profile: {
              userId: 9203,
              nickname: 'Form User',
            },
            account: { id: 9203 },
          },
        },
      };
    },
  });

  const { status, body } = await postForm('/api/login/cookie', {
    cookie: 'MUSIC_U=form-secret; __csrf=form-token',
  });

  assert.equal(status, 200);
  assert.equal(body.loggedIn, true);
  assert.equal(body.saved, true);
  assert.equal(body.userId, 9203);
  assert.equal(body.nickname, 'Form User');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].cookie, 'MUSIC_U=form-secret; __csrf=form-token');
  assert.equal(fs.readFileSync(process.env.COOKIE_FILE, 'utf8'), 'MUSIC_U=form-secret; __csrf=form-token');
});

test('/api/login/cookie normalizes structured Netease cookie input', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    login_status: async opts => {
      calls.push(['login_status', opts]);
      return {
        body: {
          data: {
            profile: {
              userId: 9102,
              nickname: 'Structured User',
            },
            account: { id: 9102 },
            metadata: [
              {
                title: '黑胶SVIP',
              },
            ],
            associator: {
              rights: [
                { label: 'standard listener' },
              ],
            },
          },
        },
      };
    },
  });

  const { status, body } = await postJson('/api/login/cookie', {
    cookie: [
      { name: 'MUSIC_U', value: 'structured-secret' },
      { __csrf: { value: 'structured-token' }, Path: '/', HttpOnly: true },
      'NMTID=abc; Secure; max-age=3600',
    ],
  });

  assert.equal(status, 200);
  assert.equal(body.loggedIn, true);
  assert.equal(body.userId, 9102);
  assert.equal(body.nickname, 'Structured User');
  assert.equal(body.vipLevel, 'svip');
  assert.equal(body.isVip, true);
  assert.equal(body.isSvip, true);
  assert.equal(body.vipLabel, 'SVIP');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].cookie, 'MUSIC_U=structured-secret; __csrf=structured-token; NMTID=abc');
  assert.equal(fs.readFileSync(process.env.COOKIE_FILE, 'utf8'), 'MUSIC_U=structured-secret; __csrf=structured-token; NMTID=abc');
});

test('/api/logout calls Netease logout and clears the saved cookie', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    login_status: async () => ({
      body: {
        data: {
          profile: { userId: 9002, nickname: 'Logout User' },
          account: { id: 9002 },
        },
      },
    }),
    logout: async opts => {
      calls.push(['logout', opts]);
      return { body: { code: 200 } };
    },
  });
  await postJson('/api/login/cookie', { cookie: 'MUSIC_U=logout-secret; __csrf=logout-token' });

  const { status, body } = await getJson('/api/logout');

  assert.equal(status, 200);
  assert.deepEqual(body, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].cookie, 'MUSIC_U=logout-secret; __csrf=logout-token');
  assert.equal(fs.readFileSync(process.env.COOKIE_FILE, 'utf8'), '');

  const lookup = await getJson('/api/login/status');
  assert.equal(lookup.body.loggedIn, false);
});

test('/api/user/playlists returns an empty list when logged out', async () => {
  const { status, body } = await getJson('/api/user/playlists');

  assert.equal(status, 200);
  assert.equal(body.loggedIn, false);
  assert.deepEqual(body.playlists, []);
});

test('/api/user/playlists maps logged-in user playlists', async () => {
  const calls = [];
  await loginAs({
    profile: { userId: 9100, nickname: 'Playlist User' },
    api: {
      user_playlist: async opts => {
        calls.push(['user_playlist', opts]);
        return {
          body: {
            playlist: [
              {
                id: 33,
                name: 'Rain Picks',
                coverImgUrl: 'https://img.example/playlist.jpg',
                trackCount: 12,
                playCount: 345,
                creator: { nickname: 'Playlist User' },
                subscribed: true,
                specialType: 5,
              },
            ],
          },
        };
      },
    },
  });

  const { status, body } = await getJson('/api/user/playlists?limit=8');

  assert.equal(status, 200);
  assert.equal(body.loggedIn, true);
  assert.equal(body.userId, 9100);
  assert.deepEqual(body.playlists, [
    {
      id: 33,
      name: 'Rain Picks',
      cover: 'https://img.example/playlist.jpg',
      trackCount: 12,
      playCount: 345,
      creator: 'Playlist User',
      subscribed: true,
      specialType: 5,
    },
  ]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].uid, 9100);
  assert.equal(calls[0][1].limit, 12);
});

test('/api/user/playlists reports provider failures for logged-in users', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    await loginAs({
      profile: { userId: 9101, nickname: 'Playlist Failure User' },
      api: {
        user_playlist: async () => {
          throw new Error('playlist unavailable');
        },
      },
    });

    const { status, body } = await getJson('/api/user/playlists');

    assert.equal(status, 500);
    assert.deepEqual(body, { error: 'playlist unavailable', loggedIn: false, playlists: [] });
  } finally {
    console.error = originalError;
  }
});

test('/api/song/like/check requires login', async () => {
  const { status, body } = await getJson('/api/song/like/check?ids=101,102');

  assert.equal(status, 401);
  assert.equal(body.error, 'LOGIN_REQUIRED');
  assert.equal(body.loggedIn, false);
});

test('/api/song/like/check validates song ids and reports provider errors', async () => {
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  await loginAs({
    profile: { userId: 9201, nickname: 'Like Error User' },
    api: {
      song_like_check: async () => {
        throw new Error('direct check unavailable');
      },
      likelist: async () => {
        throw new Error('likelist unavailable');
      },
    },
  });

  try {
    const missing = await getJson('/api/song/like/check');

    assert.equal(missing.status, 400);
    assert.deepEqual(missing.body, { error: 'Missing song id', liked: {}, ids: [] });

    const failed = await getJson('/api/song/like/check?ids=abc');

    assert.equal(failed.status, 500);
    assert.deepEqual(failed.body, { error: 'likelist unavailable' });
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
});

test('/api/song/like/check returns direct liked status for logged-in users', async () => {
  const calls = [];
  await loginAs({
    profile: { userId: 9200, nickname: 'Like User' },
    api: {
      song_like_check: async opts => {
        calls.push(['song_like_check', opts]);
        return {
          body: {
            data: { 101: true, 102: false },
          },
        };
      },
      likelist: async opts => {
        calls.push(['likelist', opts]);
        return { body: { ids: [] } };
      },
    },
  });

  const { status, body } = await getJson('/api/song/like/check?ids=101,102');

  assert.equal(status, 200);
  assert.equal(body.loggedIn, true);
  assert.deepEqual(body.ids, ['101', '102']);
  assert.deepEqual(body.liked, { 101: true, 102: false });
  assert.deepEqual(calls.map(call => call[0]), ['song_like_check']);
  assert.equal(calls[0][1].ids, '[101,102]');
});

test('/api/song/like/check falls back to likelist when direct check has no matches', async () => {
  const calls = [];
  await loginAs({
    profile: { userId: 9300, nickname: 'Fallback Like User' },
    api: {
      song_like_check: async opts => {
        calls.push(['song_like_check', opts]);
        return { body: { data: {} } };
      },
      likelist: async opts => {
        calls.push(['likelist', opts]);
        return { body: { ids: [102] } };
      },
    },
  });

  const { status, body } = await getJson('/api/song/like/check?ids=101,102');

  assert.equal(status, 200);
  assert.deepEqual(body.ids, ['101', '102']);
  assert.deepEqual(body.liked, { 101: false, 102: true });
  assert.deepEqual(calls.map(call => call[0]), ['song_like_check', 'likelist']);
  assert.equal(calls[1][1].uid, 9300);
});

test('/api/login/qr/key returns the Netease QR unikey', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    login_qr_key: async opts => {
      calls.push(opts);
      return { body: { data: { unikey: 'qr-key-123' } } };
    },
  });

  const { status, body } = await getJson('/api/login/qr/key');

  assert.equal(status, 200);
  assert.equal(body.key, 'qr-key-123');
  assert.equal(calls.length, 1);
  assert.equal(typeof calls[0].timestamp, 'number');
});

test('/api/login/qr/create returns QR image and URL for a key', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    login_qr_create: async opts => {
      calls.push(opts);
      return {
        body: {
          data: {
            qrimg: 'data:image/png;base64,abc',
            qrurl: 'https://music.example/qr',
          },
        },
      };
    },
  });

  const { status, body } = await getJson('/api/login/qr/create?key=qr-key-123');

  assert.equal(status, 200);
  assert.equal(body.img, 'data:image/png;base64,abc');
  assert.equal(body.url, 'https://music.example/qr');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].key, 'qr-key-123');
  assert.equal(calls[0].qrimg, true);
});

test('/api/login/qr/check returns waiting scan status without saving a cookie', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    login_qr_check: async opts => {
      calls.push(opts);
      return {
        body: {
          code: 801,
          message: '等待扫码',
          nickname: 'Waiting User',
          avatarUrl: 'https://img.example/waiting.jpg',
        },
      };
    },
  });

  const { status, body } = await getJson('/api/login/qr/check?key=qr-key-123');

  assert.equal(status, 200);
  assert.equal(body.code, 801);
  assert.equal(body.message, '等待扫码');
  assert.equal(body.nickname, 'Waiting User');
  assert.equal(body.avatar, 'https://img.example/waiting.jpg');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].key, 'qr-key-123');
  assert.equal(calls[0].noCookie, true);
  assert.equal(fs.existsSync(process.env.COOKIE_FILE), false);
});

test('/api/login/qr/check retries and saves cookie when QR auth succeeds without an initial cookie', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    login_qr_check: async opts => {
      calls.push(opts);
      if (opts.noCookie) {
        return {
          body: {
            code: 803,
            message: '授权登录成功',
            profile: { userId: 9400, nickname: 'QR User', avatarUrl: 'https://img.example/qr.jpg' },
            account: { id: 9400 },
          },
        };
      }
      return {
        body: {
          code: 803,
          message: '授权登录成功',
          cookie: 'MUSIC_U=qr-secret; __csrf=qr-csrf',
          profile: { userId: 9400, nickname: 'QR User', avatarUrl: 'https://img.example/qr.jpg' },
          account: { id: 9400 },
        },
      };
    },
    login_status: async () => ({
      body: {
        data: {
          profile: { userId: 9400, nickname: 'QR User', avatarUrl: 'https://img.example/qr.jpg' },
          account: { id: 9400 },
        },
      },
    }),
  });

  const { status, body } = await getJson('/api/login/qr/check?key=qr-key-123');

  assert.equal(status, 200);
  assert.equal(body.code, 803);
  assert.equal(body.loggedIn, true);
  assert.equal(body.userId, 9400);
  assert.equal(body.nickname, 'QR User');
  assert.equal(body.avatar, 'https://img.example/qr.jpg');
  assert.equal(body.hasCookie, true);
  assert.deepEqual(calls.map(call => call.noCookie), [true, undefined]);
  assert.equal(fs.readFileSync(process.env.COOKIE_FILE, 'utf8'), 'MUSIC_U=qr-secret; __csrf=qr-csrf');
});

test('/api/login/qr/check keeps profile data when cookie retry fails', async () => {
  const calls = [];
  const originalWarn = console.warn;
  console.warn = () => {};
  server.__test.setNeteaseApi({
    login_qr_check: async opts => {
      calls.push(opts);
      if (opts.noCookie) {
        return {
          body: {
            code: 803,
            message: '授权登录成功',
            profile: { userId: 9401, nickname: 'QR Retry User', avatarUrl: 'https://img.example/qr-retry.jpg' },
            account: { id: 9401 },
          },
        };
      }
      throw new Error('qr retry unavailable');
    },
  });

  try {
    const { status, body } = await getJson('/api/login/qr/check?key=qr-key-retry');

    assert.equal(status, 200);
    assert.equal(body.code, 803);
    assert.equal(body.loggedIn, true);
    assert.equal(body.userId, 9401);
    assert.equal(body.nickname, 'QR Retry User');
    assert.equal(body.hasCookie, false);
    assert.deepEqual(calls.map(call => call.noCookie), [true, undefined]);
    assert.equal(fs.existsSync(process.env.COOKIE_FILE), false);
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/login/qr/check returns pending profile when QR cookie lacks account info', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  server.__test.setNeteaseApi({
    login_qr_check: async () => ({
      body: {
        code: 803,
        message: '授权登录成功',
        cookie: 'MUSIC_U=qr-pending; __csrf=qr-pending-csrf',
        nickname: 'Pending QR User',
        avatarUrl: 'https://img.example/qr-pending.jpg',
      },
    }),
    login_status: async () => {
      throw new Error('status unavailable');
    },
    user_account: async () => {
      throw new Error('account unavailable');
    },
  });

  try {
    const { status, body } = await getJson('/api/login/qr/check?key=qr-key-pending');

    assert.equal(status, 200);
    assert.equal(body.code, 803);
    assert.equal(body.loggedIn, true);
    assert.equal(body.pendingProfile, true);
    assert.equal(body.nickname, 'Pending QR User');
    assert.equal(body.avatar, 'https://img.example/qr-pending.jpg');
    assert.equal(body.hasCookie, true);
    assert.equal(fs.readFileSync(process.env.COOKIE_FILE, 'utf8'), 'MUSIC_U=qr-pending; __csrf=qr-pending-csrf');
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/login/qr/check reports provider errors', async () => {
  server.__test.setNeteaseApi({
    login_qr_check: async () => {
      throw new Error('qr unavailable');
    },
  });

  const { status, body } = await getJson('/api/login/qr/check?key=qr-key-error');

  assert.equal(status, 500);
  assert.deepEqual(body, { error: 'qr unavailable' });
});

test('/api/song/like toggles liked state for logged-in users', async () => {
  const calls = [];
  await loginAs({
    profile: { userId: 9500, nickname: 'Toggle Like User' },
    api: {
      like: async opts => {
        calls.push(opts);
        return { body: { code: 200 } };
      },
    },
  });

  const { status, body } = await postJson('/api/song/like', { id: '101', like: false });

  assert.equal(status, 200);
  assert.equal(body.loggedIn, true);
  assert.equal(body.id, '101');
  assert.equal(body.liked, false);
  assert.equal(body.code, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, '101');
  assert.equal(calls[0].like, 'false');
});

test('/api/song/like validates song id and reports provider errors', async () => {
  const originalError = console.error;
  console.error = () => {};
  await loginAs({
    profile: { userId: 9501, nickname: 'Toggle Error User' },
    api: {
      like: async () => {
        throw new Error('like unavailable');
      },
    },
  });

  try {
    const missing = await postJson('/api/song/like', { like: true });

    assert.equal(missing.status, 400);
    assert.deepEqual(missing.body, { error: 'Missing song id' });

    const failed = await postJson('/api/song/like', { id: '101', like: true });

    assert.equal(failed.status, 500);
    assert.deepEqual(failed.body, { error: 'like unavailable' });
  } finally {
    console.error = originalError;
  }
});

test('/api/playlist/create creates a playlist for logged-in users', async () => {
  const calls = [];
  await loginAs({
    profile: { userId: 9600, nickname: 'Playlist Creator' },
    api: {
      playlist_create: async opts => {
        calls.push(opts);
        return {
          body: {
            code: 200,
            playlist: { id: 77, name: 'Night Rain' },
          },
        };
      },
    },
  });

  const { status, body } = await postJson('/api/playlist/create', { name: ' Night Rain ', privacy: '10' });

  assert.equal(status, 200);
  assert.equal(body.loggedIn, true);
  assert.deepEqual(body.playlist, { id: 77, name: 'Night Rain' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'Night Rain');
  assert.equal(calls[0].privacy, '10');
});

test('/api/playlist/create validates names and reports provider errors', async () => {
  const originalError = console.error;
  console.error = () => {};
  await loginAs({
    profile: { userId: 9601, nickname: 'Playlist Error User' },
    api: {
      playlist_create: async () => {
        throw new Error('create unavailable');
      },
    },
  });

  try {
    const missing = await postJson('/api/playlist/create', { name: '   ' });

    assert.equal(missing.status, 400);
    assert.deepEqual(missing.body, { error: 'Missing playlist name' });

    const failed = await postJson('/api/playlist/create', { name: 'Broken List' });

    assert.equal(failed.status, 500);
    assert.deepEqual(failed.body, { error: 'create unavailable' });
  } finally {
    console.error = originalError;
  }
});

test('/api/playlist/add-song reports success from playlist_tracks', async () => {
  const calls = [];
  await loginAs({
    profile: { userId: 9700, nickname: 'Playlist Add User' },
    api: {
      playlist_tracks: async opts => {
        calls.push(['playlist_tracks', opts]);
        return { body: { code: 200, message: 'ok' } };
      },
      playlist_track_add: async opts => {
        calls.push(['playlist_track_add', opts]);
        return { body: { code: 200 } };
      },
    },
  });

  const { status, body } = await postJson('/api/playlist/add-song', { pid: '77', id: '101' });

  assert.equal(status, 200);
  assert.equal(body.loggedIn, true);
  assert.equal(body.success, true);
  assert.equal(body.pid, '77');
  assert.equal(body.id, '101');
  assert.deepEqual(body.attempts.map(item => item.api), ['playlist_tracks']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].op, 'add');
  assert.equal(calls[0][1].pid, '77');
  assert.equal(calls[0][1].tracks, '101');
});

test('/api/playlist/add-song falls back to playlist_track_add when playlist_tracks fails', async () => {
  const calls = [];
  await loginAs({
    profile: { userId: 9800, nickname: 'Playlist Fallback User' },
    api: {
      playlist_tracks: async opts => {
        calls.push(['playlist_tracks', opts]);
        return { body: { code: 500, message: 'primary failed', error: 'PRIMARY_FAILED' } };
      },
      playlist_track_add: async opts => {
        calls.push(['playlist_track_add', opts]);
        return { body: { code: 200, message: 'fallback ok' } };
      },
    },
  });

  const { status, body } = await postJson('/api/playlist/add-song', { pid: '77', ids: '101,102' });

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.id, '101,102');
  assert.deepEqual(body.attempts.map(item => item.api), ['playlist_tracks', 'playlist_track_add']);
  assert.deepEqual(calls.map(call => call[0]), ['playlist_tracks', 'playlist_track_add']);
  assert.equal(calls[1][1].ids, '101,102');
});

test('/api/playlist/add-song validates playlist and song ids before provider calls', async () => {
  const calls = [];
  await loginAs({
    profile: { userId: 9702, nickname: 'Playlist Add Validation User' },
    api: {
      playlist_tracks: async opts => {
        calls.push(['playlist_tracks', opts]);
        return { body: { code: 200 } };
      },
      playlist_track_add: async opts => {
        calls.push(['playlist_track_add', opts]);
        return { body: { code: 200 } };
      },
    },
  });

  const missingSong = await postJson('/api/playlist/add-song', { pid: '77' });
  const missingPlaylist = await postJson('/api/playlist/add-song', { id: '101' });

  assert.equal(missingSong.status, 400);
  assert.deepEqual(missingSong.body, { error: 'Missing playlist id or song id' });
  assert.equal(missingPlaylist.status, 400);
  assert.deepEqual(missingPlaylist.body, { error: 'Missing playlist id or song id' });
  assert.deepEqual(calls, []);
});

test('/api/playlist/add-song reports failed provider attempts', async () => {
  const calls = [];
  await loginAs({
    profile: { userId: 9703, nickname: 'Playlist Add Failure User' },
    api: {
      playlist_tracks: async opts => {
        calls.push(['playlist_tracks', opts]);
        return { body: { code: 500, message: 'primary failed' } };
      },
      playlist_track_add: async opts => {
        calls.push(['playlist_track_add', opts]);
        return { body: { code: 401, message: 'login expired' } };
      },
    },
  });

  const { status, body } = await postJson('/api/playlist/add-song', { pid: '77', ids: '101,102' });

  assert.equal(status, 401);
  assert.equal(body.loggedIn, true);
  assert.equal(body.success, false);
  assert.equal(body.code, 401);
  assert.equal(body.error, 'login expired');
  assert.deepEqual(body.attempts.map(item => item.api), ['playlist_tracks', 'playlist_track_add']);
  assert.equal(body.attempts[0].code, 500);
  assert.equal(body.attempts[1].code, 401);
  assert.deepEqual(calls.map(call => call[0]), ['playlist_tracks', 'playlist_track_add']);
});

test('/api/playlist/add-song records fallback exceptions', async () => {
  await loginAs({
    profile: { userId: 9704, nickname: 'Playlist Add Fallback Error User' },
    api: {
      playlist_tracks: async () => ({ body: { code: 500, message: 'primary failed' } }),
      playlist_track_add: async () => {
        throw new Error('fallback unavailable');
      },
    },
  });

  const { status, body } = await postJson('/api/playlist/add-song', { pid: '77', id: '101' });

  assert.equal(status, 409);
  assert.equal(body.loggedIn, true);
  assert.equal(body.success, false);
  assert.equal(body.code, 0);
  assert.equal(body.error, 'fallback unavailable');
  assert.deepEqual(body.attempts.map(item => item.api), ['playlist_tracks', 'playlist_track_add']);
  assert.equal(body.attempts[1].message, 'fallback unavailable');
});

test('/api/playlist/add-song reports primary provider exceptions', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    await loginAs({
      profile: { userId: 9705, nickname: 'Playlist Add Primary Error User' },
      api: {
        playlist_tracks: async () => {
          throw new Error('primary unavailable');
        },
        playlist_track_add: async () => ({ body: { code: 200 } }),
      },
    });

    const { status, body } = await postJson('/api/playlist/add-song', { pid: '77', id: '101' });

    assert.equal(status, 500);
    assert.deepEqual(body, { error: 'primary unavailable' });
  } finally {
    console.error = originalError;
  }
});

test('/api/song/comments requires a song id', async () => {
  const { status, body } = await getJson('/api/song/comments');

  assert.equal(status, 400);
  assert.equal(body.error, 'Missing song id');
  assert.deepEqual(body.comments, []);
});

test('/api/song/comments maps hot comments on the first page', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    comment_music: async opts => {
      calls.push(opts);
      return {
        body: {
          total: 2,
          hotComments: [
            {
              commentId: 501,
              content: 'Great rain groove',
              likedCount: 42,
              time: 1710000000000,
              user: {
                userId: 88,
                nickname: 'Comment User',
                avatarUrl: 'https://img.example/comment.jpg',
              },
            },
            {
              commentId: 502,
              content: '',
              likedCount: 0,
              time: 1710000001000,
              user: null,
            },
          ],
          comments: [
            { commentId: 601, content: 'regular comment' },
          ],
        },
      };
    },
  });

  const { status, body } = await getJson('/api/song/comments?id=101&limit=3&offset=0');

  assert.equal(status, 200);
  assert.equal(body.id, '101');
  assert.equal(body.total, 2);
  assert.equal(body.hot, true);
  assert.deepEqual(body.comments, [
    {
      id: 501,
      content: 'Great rain groove',
      likedCount: 42,
      time: 1710000000000,
      user: {
        id: 88,
        nickname: 'Comment User',
        avatar: 'https://img.example/comment.jpg',
      },
    },
  ]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, '101');
  assert.equal(calls[0].limit, 6);
  assert.equal(calls[0].offset, 0);
});

test('/api/song/comments maps regular comments after the first page', async () => {
  server.__test.setNeteaseApi({
    comment_music: async () => ({
      body: {
        total: 9,
        hotComments: [
          { commentId: 501, content: 'hot comment' },
        ],
        comments: [
          {
            commentId: 701,
            content: 'Later page comment',
            likedCount: 7,
            time: 1710000002000,
            user: { userId: 91, nickname: 'Later User', avatarUrl: '' },
          },
        ],
      },
    }),
  });

  const { status, body } = await getJson('/api/song/comments?id=101&limit=12&offset=12');

  assert.equal(status, 200);
  assert.equal(body.hot, false);
  assert.deepEqual(body.comments, [
    {
      id: 701,
      content: 'Later page comment',
      likedCount: 7,
      time: 1710000002000,
      user: { id: 91, nickname: 'Later User', avatar: '' },
    },
  ]);
});

test('/api/song/comments reports provider failures', async () => {
  const originalError = console.error;
  console.error = () => {};
  server.__test.setNeteaseApi({
    comment_music: async () => {
      throw new Error('comments unavailable');
    },
  });

  try {
    const { status, body } = await getJson('/api/song/comments?id=101');

    assert.equal(status, 500);
    assert.deepEqual(body, { error: 'comments unavailable', comments: [] });
  } finally {
    console.error = originalError;
  }
});

test('/api/playlist/tracks requires a playlist id', async () => {
  const { status, body } = await getJson('/api/playlist/tracks');

  assert.equal(status, 400);
  assert.equal(body.error, 'Missing playlist id');
  assert.deepEqual(body.tracks, []);
});

test('/api/playlist/tracks maps songs from playlist_track_all', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    playlist_track_all: async opts => {
      calls.push(['playlist_track_all', opts]);
      return {
        body: {
          songs: [
            {
              id: 801,
              name: 'All Track',
              ar: [{ id: 12, name: 'Track Artist' }],
              al: { name: 'Track Album', picUrl: 'https://img.example/track.jpg' },
              dt: 201000,
              fee: 0,
            },
          ],
        },
      };
    },
    playlist_detail: async opts => {
      calls.push(['playlist_detail', opts]);
      return { body: { playlist: { tracks: [] } } };
    },
  });

  const { status, body } = await getJson('/api/playlist/tracks?id=77');

  assert.equal(status, 200);
  assert.deepEqual(body.playlist, { id: '77', name: '', cover: '', trackCount: 1 });
  assert.deepEqual(body.tracks, [
    {
      provider: 'netease',
      source: 'netease',
      type: 'song',
      id: 801,
      name: 'All Track',
      artist: 'Track Artist',
      artists: [{ id: 12, name: 'Track Artist' }],
      artistId: 12,
      album: 'Track Album',
      cover: 'https://img.example/track.jpg',
      duration: 201000,
      fee: 0,
    },
  ]);
  assert.deepEqual(calls.map(call => call[0]), ['playlist_track_all']);
  assert.equal(calls[0][1].id, '77');
  assert.equal(calls[0][1].limit, 500);
});

test('/api/playlist/tracks accepts tracks from playlist_track_all', async () => {
  server.__test.setNeteaseApi({
    playlist_track_all: async () => ({
      body: {
        tracks: [
          {
            id: 803,
            name: 'Track Field Song',
            ar: [{ id: 14, name: 'Track Field Artist' }],
            al: { name: 'Track Field Album', coverUrl: 'https://img.example/track-field.jpg' },
            dt: 203000,
            fee: 0,
          },
        ],
      },
    }),
    playlist_detail: async () => {
      throw new Error('playlist_detail should not be called');
    },
  });

  const { status, body } = await getJson('/api/playlist/tracks?id=79');

  assert.equal(status, 200);
  assert.deepEqual(body.playlist, { id: '79', name: '', cover: '', trackCount: 1 });
  assert.equal(body.tracks.length, 1);
  assert.equal(body.tracks[0].id, 803);
  assert.equal(body.tracks[0].cover, 'https://img.example/track-field.jpg');
});

test('/api/playlist/tracks falls back to playlist_detail when playlist_track_all fails', async () => {
  const calls = [];
  const originalWarn = console.warn;
  console.warn = () => {};
  server.__test.setNeteaseApi({
    playlist_track_all: async opts => {
      calls.push(['playlist_track_all', opts]);
      throw new Error('track all unavailable');
    },
    playlist_detail: async opts => {
      calls.push(['playlist_detail', opts]);
      return {
        body: {
          playlist: {
            id: 78,
            name: 'Fallback Playlist',
            coverImgUrl: 'https://img.example/fallback-playlist.jpg',
            trackCount: 1,
            tracks: [
              {
                id: 802,
                name: 'Fallback Track',
                artists: [{ id: 13, name: 'Fallback Artist' }],
                album: { name: 'Fallback Album', picUrl: 'https://img.example/fallback-track.jpg' },
                duration: 202000,
                fee: 8,
              },
            ],
          },
        },
      };
    },
  });

  try {
    const { status, body } = await getJson('/api/playlist/tracks?id=78');

    assert.equal(status, 200);
    assert.deepEqual(body.playlist, {
      id: 78,
      name: 'Fallback Playlist',
      cover: 'https://img.example/fallback-playlist.jpg',
      trackCount: 1,
    });
    assert.equal(body.tracks.length, 1);
    assert.equal(body.tracks[0].id, 802);
    assert.equal(body.tracks[0].artist, 'Fallback Artist');
    assert.equal(body.tracks[0].fee, 8);
    assert.deepEqual(calls.map(call => call[0]), ['playlist_track_all', 'playlist_detail']);
    assert.equal(calls[1][1].s, 0);
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/playlist/tracks returns an error when fallback detail fails', async () => {
  const calls = [];
  const originalWarn = console.warn;
  const originalError = console.error;
  console.warn = () => {};
  console.error = () => {};
  server.__test.setNeteaseApi({
    playlist_track_all: async opts => {
      calls.push(['playlist_track_all', opts]);
      throw new Error('track all unavailable');
    },
    playlist_detail: async opts => {
      calls.push(['playlist_detail', opts]);
      throw new Error('detail unavailable');
    },
  });

  try {
    const { status, body } = await getJson('/api/playlist/tracks?id=80');

    assert.equal(status, 500);
    assert.equal(body.error, 'detail unavailable');
    assert.deepEqual(body.tracks, []);
    assert.deepEqual(calls.map(call => call[0]), ['playlist_track_all', 'playlist_detail']);
  } finally {
    console.warn = originalWarn;
    console.error = originalError;
  }
});

test('/api/discover/home returns starter data when logged out', async () => {
  let upstreamCalled = false;
  server.__test.setNeteaseApi({
    personalized: async () => {
      upstreamCalled = true;
      return { body: {} };
    },
    dj_hot: async () => {
      upstreamCalled = true;
      return { body: {} };
    },
    recommend_resource: async () => {
      upstreamCalled = true;
      return { body: {} };
    },
    recommend_songs: async () => {
      upstreamCalled = true;
      return { body: {} };
    },
  });

  const { status, body } = await getJson('/api/discover/home');

  assert.equal(status, 200);
  assert.equal(body.loggedIn, false);
  assert.equal(body.user, null);
  assert.deepEqual(body.dailySongs, []);
  assert.deepEqual(body.playlists, []);
  assert.deepEqual(body.podcasts, []);
  assert.equal(body.mode, 'starter');
  assert.equal(typeof body.updatedAt, 'number');
  assert.equal(upstreamCalled, false);
});

test('/api/discover/home combines personalized playlists, private recommendations, podcasts, and daily songs', async () => {
  const calls = [];
  await loginAs({
    profile: {
      userId: 9600,
      nickname: 'Discover User',
      avatarUrl: 'https://img.example/discover-avatar.jpg',
    },
    api: {
      personalized: async opts => {
        calls.push(['personalized', opts]);
        return {
          body: {
            result: [
              {
                id: 510,
                name: 'Public Picks',
                picUrl: 'https://img.example/public.jpg',
                trackCount: 42,
                playCount: 1200,
                creator: { nickname: 'Public Curator' },
              },
            ],
          },
        };
      },
      dj_hot: async opts => {
        calls.push(['dj_hot', opts]);
        return {
          body: {
            djRadios: [
              {
                id: 610,
                name: 'Clean Podcast',
                picUrl: 'https://img.example/podcast-clean.jpg',
                desc: 'Good signal',
                category: '音乐',
                programCount: 11,
                subCount: 200,
                dj: { nickname: 'Podcast DJ' },
              },
              {
                id: 611,
                name: 'Qzone 背景音乐',
                picUrl: 'https://img.example/low-signal.jpg',
              },
            ],
          },
        };
      },
      recommend_resource: async opts => {
        calls.push(['recommend_resource', opts]);
        return {
          body: {
            recommend: [
              {
                id: 520,
                name: 'Private Picks',
                coverImgUrl: 'https://img.example/private.jpg',
                trackCount: 7,
                playCount: 99,
                creator: { nickname: 'Private Curator' },
              },
            ],
          },
        };
      },
      recommend_songs: async opts => {
        calls.push(['recommend_songs', opts]);
        return {
          body: {
            data: {
              dailySongs: [
                {
                  id: 710,
                  name: 'Daily Track',
                  ar: [{ id: 81, name: 'Daily Artist' }],
                  al: { name: 'Daily Album', picUrl: 'https://img.example/daily.jpg' },
                  dt: 203000,
                  fee: 0,
                },
              ],
            },
          },
        };
      },
    },
  });

  const { status, body } = await getJson('/api/discover/home');

  assert.equal(status, 200);
  assert.equal(body.loggedIn, true);
  assert.deepEqual(body.user, {
    userId: 9600,
    nickname: 'Discover User',
    avatar: 'https://img.example/discover-avatar.jpg',
  });
  assert.deepEqual(body.playlists, [
    {
      provider: 'netease',
      source: 'netease',
      type: 'playlist',
      id: 520,
      name: 'Private Picks',
      cover: 'https://img.example/private.jpg',
      trackCount: 7,
      playCount: 99,
      creator: 'Private Curator',
      tag: '私人推荐',
    },
    {
      provider: 'netease',
      source: 'netease',
      type: 'playlist',
      id: 510,
      name: 'Public Picks',
      cover: 'https://img.example/public.jpg',
      trackCount: 42,
      playCount: 1200,
      creator: 'Public Curator',
      tag: '推荐歌单',
    },
  ]);
  assert.deepEqual(body.podcasts, [
    {
      id: 610,
      rid: 610,
      name: 'Clean Podcast',
      cover: 'https://img.example/podcast-clean.jpg',
      desc: 'Good signal',
      djName: 'Podcast DJ',
      category: '音乐',
      programCount: 11,
      subCount: 200,
    },
  ]);
  assert.deepEqual(body.dailySongs, [
    {
      provider: 'netease',
      source: 'netease',
      type: 'song',
      id: 710,
      name: 'Daily Track',
      artist: 'Daily Artist',
      artists: [{ id: 81, name: 'Daily Artist' }],
      artistId: 81,
      album: 'Daily Album',
      cover: 'https://img.example/daily.jpg',
      duration: 203000,
      fee: 0,
    },
  ]);
  assert.equal(typeof body.updatedAt, 'number');
  assert.deepEqual(calls.map(call => call[0]), ['personalized', 'dj_hot', 'recommend_resource', 'recommend_songs']);
  assert.equal(calls.every(call => call[1].cookie === 'MUSIC_U=test-user; __csrf=test-csrf'), true);
});

test('/api/discover/home returns a fallback payload when discovery setup fails', async () => {
  const originalError = console.error;
  console.error = () => {};

  try {
    server.__test.setNeteaseApi({
      login_status: async () => ({
        body: {
          data: {
            profile: { userId: 9610, nickname: 'Broken Discover User' },
            account: { id: 9610 },
          },
        },
      }),
      personalized: null,
    });
    const login = await postJson('/api/login/cookie', { cookie: 'MUSIC_U=discover-broken; __csrf=discover-csrf' });
    assert.equal(login.body.loggedIn, true);

    const { status, body } = await getJson('/api/discover/home');

    assert.equal(status, 500);
    assert.match(body.error, /personalized is not a function/);
    assert.equal(body.loggedIn, false);
    assert.deepEqual(body.dailySongs, []);
    assert.deepEqual(body.playlists, []);
    assert.deepEqual(body.podcasts, []);
  } finally {
    console.error = originalError;
  }
});

test('/api/podcast/search returns an empty list for blank keywords', async () => {
  let called = false;
  server.__test.setNeteaseApi({
    cloudsearch: async () => {
      called = true;
      return { body: {} };
    },
  });

  const { status, body } = await getJson('/api/podcast/search?keywords=%20');

  assert.equal(status, 200);
  assert.deepEqual(body, { podcasts: [] });
  assert.equal(called, false);
});

test('/api/podcast/search maps Netease podcast radios', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    cloudsearch: async opts => {
      calls.push(opts);
      return {
        body: {
          result: {
            djRadiosCount: 2,
            djRadios: [
              {
                id: 901,
                name: 'Late Talk',
                picUrl: 'https://img.example/podcast.jpg',
                desc: 'Night words',
                category: '情感',
                programCount: 12,
                subCount: 345,
                dj: { nickname: 'DJ User' },
              },
            ],
          },
        },
      };
    },
  });

  const { status, body } = await getJson('/api/podcast/search?keywords=talk&limit=3');

  assert.equal(status, 200);
  assert.equal(body.total, 2);
  assert.deepEqual(body.podcasts, [
    {
      id: 901,
      rid: 901,
      name: 'Late Talk',
      cover: 'https://img.example/podcast.jpg',
      desc: 'Night words',
      djName: 'DJ User',
      category: '情感',
      programCount: 12,
      subCount: 345,
    },
  ]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].keywords, 'talk');
  assert.equal(calls[0].type, 1009);
  assert.equal(calls[0].limit, 6);
});

test('/api/podcast/search returns an error when upstream search fails', async () => {
  const originalError = console.error;
  console.error = () => {};
  server.__test.setNeteaseApi({
    cloudsearch: async () => {
      throw new Error('podcast search unavailable');
    },
  });

  try {
    const { status, body } = await getJson('/api/podcast/search?keywords=talk');

    assert.equal(status, 500);
    assert.equal(body.error, 'podcast search unavailable');
    assert.deepEqual(body.podcasts, []);
  } finally {
    console.error = originalError;
  }
});

test('/api/podcast/hot maps hot podcast radios and pagination', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    dj_hot: async opts => {
      calls.push(opts);
      return {
        body: {
          hasMore: true,
          djRadios: [
            {
              rid: 902,
              radioName: 'Hot Radio',
              coverUrl: 'https://img.example/hot.jpg',
              description: 'Hot desc',
              categoryName: '音乐',
              programNum: 8,
              subedCount: 90,
              djName: 'Hot DJ',
            },
          ],
        },
      };
    },
  });

  const { status, body } = await getJson('/api/podcast/hot?limit=4&offset=6');

  assert.equal(status, 200);
  assert.equal(body.more, true);
  assert.deepEqual(body.podcasts, [
    {
      id: 902,
      rid: 902,
      name: 'Hot Radio',
      cover: 'https://img.example/hot.jpg',
      desc: 'Hot desc',
      djName: 'Hot DJ',
      category: '音乐',
      programCount: 8,
      subCount: 90,
    },
  ]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].limit, 6);
  assert.equal(calls[0].offset, 6);
});

test('/api/podcast/hot returns an error when upstream hot list fails', async () => {
  const originalError = console.error;
  console.error = () => {};
  server.__test.setNeteaseApi({
    dj_hot: async () => {
      throw new Error('podcast hot unavailable');
    },
  });

  try {
    const { status, body } = await getJson('/api/podcast/hot');

    assert.equal(status, 500);
    assert.equal(body.error, 'podcast hot unavailable');
    assert.deepEqual(body.podcasts, []);
  } finally {
    console.error = originalError;
  }
});

test('/api/podcast/detail requires a podcast id', async () => {
  const { status, body } = await getJson('/api/podcast/detail');

  assert.equal(status, 400);
  assert.deepEqual(body, { error: 'Missing podcast id' });
});

test('/api/podcast/detail maps podcast detail data', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    dj_detail: async opts => {
      calls.push(opts);
      return {
        body: {
          data: {
            id: 903,
            name: 'Detail Radio',
            picUrl: 'https://img.example/detail.jpg',
            desc: 'Detail desc',
            category: '故事',
            programCount: 22,
            subCount: 1001,
            dj: { nickname: 'Detail DJ' },
          },
        },
      };
    },
  });

  const { status, body } = await getJson('/api/podcast/detail?id=903');

  assert.equal(status, 200);
  assert.deepEqual(body.podcast, {
    id: 903,
    rid: 903,
    name: 'Detail Radio',
    cover: 'https://img.example/detail.jpg',
    desc: 'Detail desc',
    djName: 'Detail DJ',
    category: '故事',
    programCount: 22,
    subCount: 1001,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].rid, '903');
});

test('/api/podcast/detail returns an error when upstream detail fails', async () => {
  const originalError = console.error;
  console.error = () => {};
  server.__test.setNeteaseApi({
    dj_detail: async () => {
      throw new Error('podcast detail unavailable');
    },
  });

  try {
    const { status, body } = await getJson('/api/podcast/detail?id=903');

    assert.equal(status, 500);
    assert.equal(body.error, 'podcast detail unavailable');
  } finally {
    console.error = originalError;
  }
});

test('/api/podcast/programs requires a podcast id', async () => {
  const { status, body } = await getJson('/api/podcast/programs');

  assert.equal(status, 400);
  assert.equal(body.error, 'Missing podcast id');
  assert.deepEqual(body.programs, []);
});

test('/api/podcast/programs maps podcast programs', async () => {
  const calls = [];
  server.__test.setNeteaseApi({
    dj_program: async opts => {
      calls.push(opts);
      return {
        body: {
          more: true,
          count: 2,
          programs: [
            {
              id: 9901,
              name: 'Episode One',
              coverUrl: 'https://img.example/episode.jpg',
              duration: 180000,
              description: 'Episode desc',
              createTime: 1710000000000,
              serialNum: 1,
              radio: {
                id: 903,
                name: 'Detail Radio',
                picUrl: 'https://img.example/detail.jpg',
                dj: { nickname: 'Detail DJ' },
              },
              mainSong: {
                id: 8801,
                name: 'Playable Episode',
                ar: [{ id: 44, name: 'Voice Artist' }],
                al: { name: 'Voice Album' },
                fee: 0,
              },
            },
          ],
        },
      };
    },
  });

  const { status, body } = await getJson('/api/podcast/programs?id=903&limit=5&offset=10');

  assert.equal(status, 200);
  assert.deepEqual(body.radio, {
    id: 903,
    rid: 903,
    name: 'Detail Radio',
    cover: 'https://img.example/detail.jpg',
    desc: '',
    djName: 'Detail DJ',
    category: '',
    programCount: 0,
    subCount: 0,
  });
  assert.equal(body.more, true);
  assert.equal(body.total, 2);
  assert.equal(body.programs.length, 1);
  assert.equal(body.programs[0].id, 8801);
  assert.equal(body.programs[0].programId, 9901);
  assert.equal(body.programs[0].name, 'Episode One');
  assert.equal(body.programs[0].artist, 'Detail Radio');
  assert.equal(body.programs[0].artists[0].name, 'Voice Artist');
  assert.equal(body.programs[0].duration, 180000);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].rid, '903');
  assert.equal(calls[0].limit, 10);
  assert.equal(calls[0].offset, 10);
  assert.equal(calls[0].asc, false);
});

test('/api/podcast/programs returns an error when upstream programs fail', async () => {
  const originalError = console.error;
  console.error = () => {};
  server.__test.setNeteaseApi({
    dj_program: async () => {
      throw new Error('podcast programs unavailable');
    },
  });

  try {
    const { status, body } = await getJson('/api/podcast/programs?id=903');

    assert.equal(status, 500);
    assert.equal(body.error, 'podcast programs unavailable');
    assert.deepEqual(body.programs, []);
  } finally {
    console.error = originalError;
  }
});

test('/api/podcast/my returns empty collections when logged out', async () => {
  const { status, body } = await getJson('/api/podcast/my');

  assert.equal(status, 200);
  assert.equal(body.loggedIn, false);
  assert.deepEqual(body.collections, [
    { key: 'collect', title: '收藏播客', sub: '你收藏的播客', itemType: 'radio', count: 0, cover: '' },
    { key: 'created', title: '创建播客', sub: '你创建的播客', itemType: 'radio', count: 0, cover: '' },
    { key: 'liked', title: '喜欢的声音', sub: '收藏或最近喜欢的声音', itemType: 'voice', count: 0, cover: '' },
  ]);
});

test('/api/podcast/my summarizes logged-in podcast collections', async () => {
  const calls = [];
  await loginAs({
    profile: { userId: 9900, nickname: 'Podcast User' },
    api: {
      dj_sublist: async opts => {
        calls.push(['dj_sublist', opts]);
        return { body: { djRadios: [{ id: 911, name: 'Collected Radio', picUrl: 'https://img.example/collect.jpg' }] } };
      },
      user_audio: async opts => {
        calls.push(['user_audio', opts]);
        return { body: { data: [{ id: 912, name: 'Created Radio', picUrl: 'https://img.example/created-radio.jpg' }] } };
      },
      sati_resource_sub_list: async opts => {
        calls.push(['sati_resource_sub_list', opts]);
        return {
          body: {
            data: [
              {
                resource: {
                  id: 9911,
                  name: 'Liked Voice',
                  coverUrl: 'https://img.example/liked-voice.jpg',
                  radio: { id: 913, name: 'Liked Radio' },
                },
              },
            ],
          },
        };
      },
    },
  });

  const { status, body } = await getJson('/api/podcast/my');

  assert.equal(status, 200);
  assert.equal(body.loggedIn, true);
  assert.deepEqual(body.collections, [
    { key: 'collect', title: '收藏播客', sub: '你收藏的播客', itemType: 'radio', count: 1, cover: 'https://img.example/collect.jpg' },
    { key: 'created', title: '创建播客', sub: '你创建的播客', itemType: 'radio', count: 1, cover: 'https://img.example/created-radio.jpg' },
    { key: 'liked', title: '喜欢的声音', sub: '收藏或最近喜欢的声音', itemType: 'voice', count: 1, cover: 'https://img.example/liked-voice.jpg' },
  ]);
  assert.deepEqual(calls.map(call => call[0]), ['dj_sublist', 'user_audio', 'sati_resource_sub_list']);
  assert.equal(calls[1][1].uid, 9900);
});

test('/api/podcast/my keeps available collections when one source fails', async () => {
  const calls = [];
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await loginAs({
      profile: { userId: 9902, nickname: 'Partial Podcast User' },
      api: {
        dj_sublist: async opts => {
          calls.push(['dj_sublist', opts]);
          return { body: { djRadios: [{ id: 915, name: 'Still Collected', picUrl: 'https://img.example/still-collected.jpg' }] } };
        },
        user_audio: async opts => {
          calls.push(['user_audio', opts]);
          throw new Error('created podcasts unavailable');
        },
        sati_resource_sub_list: async opts => {
          calls.push(['sati_resource_sub_list', opts]);
          return { body: { data: [] } };
        },
        record_recent_voice: async opts => {
          calls.push(['record_recent_voice', opts]);
          return {
            body: {
              data: [
                {
                  id: 9912,
                  name: 'Recent Voice',
                  coverUrl: 'https://img.example/recent-voice.jpg',
                  radio: { id: 916, name: 'Recent Radio' },
                },
              ],
            },
          };
        },
      },
    });

    const { status, body } = await getJson('/api/podcast/my');

    assert.equal(status, 200);
    assert.equal(body.loggedIn, true);
    assert.deepEqual(body.collections, [
      { key: 'collect', title: '收藏播客', sub: '你收藏的播客', itemType: 'radio', count: 1, cover: 'https://img.example/still-collected.jpg' },
      { key: 'created', title: '创建播客', sub: '你创建的播客', itemType: 'radio', count: 0, cover: '' },
      { key: 'liked', title: '喜欢的声音', sub: '收藏或最近喜欢的声音', itemType: 'voice', count: 1, cover: 'https://img.example/recent-voice.jpg' },
    ]);
    assert.deepEqual(calls.map(call => call[0]), ['dj_sublist', 'user_audio', 'sati_resource_sub_list', 'record_recent_voice']);
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/podcast/my/items returns logged-out defaults', async () => {
  const { status, body } = await getJson('/api/podcast/my/items?key=collect');

  assert.equal(status, 200);
  assert.deepEqual(body, { loggedIn: false, items: [] });
});

test('/api/podcast/my/items maps collected podcast radios for logged-in users', async () => {
  const calls = [];
  await loginAs({
    profile: { userId: 9901, nickname: 'Podcast Item User' },
    api: {
      dj_sublist: async opts => {
        calls.push(opts);
        return {
          body: {
            djRadios: [
              {
                id: 914,
                name: 'Collected Item Radio',
                picUrl: 'https://img.example/collected-item.jpg',
                category: '访谈',
                dj: { nickname: 'Collected DJ' },
              },
            ],
          },
        };
      },
    },
  });

  const { status, body } = await getJson('/api/podcast/my/items?key=collect&limit=5&offset=3');

  assert.equal(status, 200);
  assert.equal(body.loggedIn, true);
  assert.equal(body.key, 'collect');
  assert.equal(body.itemType, 'radio');
  assert.equal(body.count, 1);
  assert.equal(body.cover, 'https://img.example/collected-item.jpg');
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].id, 914);
  assert.equal(body.items[0].type, 'podcast-radio');
  assert.equal(body.items[0].collectionKey, 'collect');
  assert.equal(body.items[0].artist, 'Collected DJ');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].limit, 8);
  assert.equal(calls[0].offset, 3);
});

test('/api/podcast/my/items returns empty radios when collected payload has no arrays', async () => {
  await loginAs({
    profile: { userId: 9908, nickname: 'Empty Collect Podcast User' },
    api: {
      dj_sublist: async () => ({
        body: {
          djRadios: { count: 2 },
          data: { total: 2 },
          resources: { more: true },
        },
      }),
    },
  });

  const { status, body } = await getJson('/api/podcast/my/items?key=collect');

  assert.equal(status, 200);
  assert.equal(body.loggedIn, true);
  assert.equal(body.key, 'collect');
  assert.equal(body.itemType, 'radio');
  assert.equal(body.count, 0);
  assert.equal(body.cover, '');
  assert.deepEqual(body.items, []);
});

test('/api/podcast/my/items returns empty radios for unknown collection keys', async () => {
  await loginAs({
    profile: { userId: 9907, nickname: 'Unknown Podcast User' },
  });

  const { status, body } = await getJson('/api/podcast/my/items?key=unknown');

  assert.equal(status, 200);
  assert.equal(body.loggedIn, true);
  assert.equal(body.key, 'unknown');
  assert.equal(body.itemType, 'radio');
  assert.equal(body.count, 0);
  assert.equal(body.cover, '');
  assert.deepEqual(body.items, []);
});

test('/api/podcast/my/items maps paid podcast radios for logged-in users', async () => {
  const calls = [];
  await loginAs({
    profile: { userId: 9904, nickname: 'Paid Podcast User' },
    api: {
      dj_paygift: async opts => {
        calls.push(opts);
        return {
          body: {
            data: [
              {
                id: 917,
                name: 'Paid Radio',
                picUrl: 'https://img.example/paid-radio.jpg',
                category: '知识',
                dj: { nickname: 'Paid DJ' },
              },
            ],
          },
        };
      },
    },
  });

  const { status, body } = await getJson('/api/podcast/my/items?key=paid&limit=12&offset=4');

  assert.equal(status, 200);
  assert.equal(body.loggedIn, true);
  assert.equal(body.key, 'paid');
  assert.equal(body.itemType, 'radio');
  assert.equal(body.count, 1);
  assert.equal(body.cover, 'https://img.example/paid-radio.jpg');
  assert.equal(body.items[0].id, 917);
  assert.equal(body.items[0].type, 'podcast-radio');
  assert.equal(body.items[0].collectionKey, 'paid');
  assert.equal(body.items[0].artist, 'Paid DJ');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].limit, 12);
  assert.equal(calls[0].offset, 4);
});

test('/api/podcast/my/items falls back to recent voices for liked podcasts', async () => {
  const calls = [];
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await loginAs({
      profile: { userId: 9905, nickname: 'Liked Podcast User' },
      api: {
        sati_resource_sub_list: async opts => {
          calls.push(['sati_resource_sub_list', opts]);
          throw new Error('liked voices unavailable');
        },
        record_recent_voice: async opts => {
          calls.push(['record_recent_voice', opts]);
          return {
            body: {
              list: [
                {
                  id: 9918,
                  title: 'Recent Liked Voice',
                  cover: 'https://img.example/recent-liked.jpg',
                  durationMs: 88000,
                  radio: { id: 918, radioName: 'Recent Radio' },
                },
              ],
            },
          };
        },
      },
    });

    const { status, body } = await getJson('/api/podcast/my/items?key=liked&limit=7');

    assert.equal(status, 200);
    assert.equal(body.loggedIn, true);
    assert.equal(body.key, 'liked');
    assert.equal(body.itemType, 'voice');
    assert.equal(body.count, 1);
    assert.equal(body.cover, 'https://img.example/recent-liked.jpg');
    assert.equal(body.items[0].id, 9918);
    assert.equal(body.items[0].sourceType, 'podcast-voice');
    assert.equal(body.items[0].artist, 'Recent Radio');
    assert.equal(body.items[0].duration, 88000);
    assert.deepEqual(calls.map(call => call[0]), ['sati_resource_sub_list', 'record_recent_voice']);
    assert.equal(calls[1][1].limit, 8);
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/podcast/my/items returns an empty liked list when all liked podcast sources fail', async () => {
  const calls = [];
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    await loginAs({
      profile: { userId: 9906, nickname: 'Empty Liked Podcast User' },
      api: {
        sati_resource_sub_list: async opts => {
          calls.push(['sati_resource_sub_list', opts]);
          throw new Error('liked voices unavailable');
        },
        record_recent_voice: async opts => {
          calls.push(['record_recent_voice', opts]);
          throw new Error('recent voices unavailable');
        },
      },
    });

    const { status, body } = await getJson('/api/podcast/my/items?key=liked&limit=3');

    assert.equal(status, 200);
    assert.equal(body.loggedIn, true);
    assert.equal(body.key, 'liked');
    assert.equal(body.itemType, 'voice');
    assert.equal(body.count, 0);
    assert.equal(body.cover, '');
    assert.deepEqual(body.items, []);
    assert.deepEqual(calls.map(call => call[0]), ['sati_resource_sub_list', 'record_recent_voice']);
    assert.equal(calls[1][1].limit, 8);
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/podcast/my/items returns an error when the selected source fails', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    await loginAs({
      profile: { userId: 9903, nickname: 'Podcast Item Error User' },
      api: {
        dj_sublist: async () => {
          throw new Error('collected podcasts unavailable');
        },
      },
    });

    const { status, body } = await getJson('/api/podcast/my/items?key=collect');

    assert.equal(status, 500);
    assert.equal(body.error, 'collected podcasts unavailable');
    assert.deepEqual(body.items, []);
  } finally {
    console.error = originalError;
  }
});

test('/api/weather/ip-location maps IP location data', async () => {
  const calls = [];
  setRequestTextResponder(targetUrl => {
    calls.push(targetUrl);
    assert.match(targetUrl, /ip-api\.com/);
    return {
      status: 'success',
      country: '中国',
      regionName: '上海市',
      city: '上海',
      lat: 31.23,
      lon: 121.47,
      timezone: 'Asia/Shanghai',
      query: '203.0.113.1',
    };
  });

  const { status, body } = await getJson('/api/weather/ip-location');

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.location, {
    provider: 'ip-api',
    city: '上海',
    region: '上海市',
    country: '中国',
    latitude: 31.23,
    longitude: 121.47,
    timezone: 'Asia/Shanghai',
    ip: '203.0.113.1',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].includes('lang=zh-CN'), true);
});

test('/api/weather/ip-location reports provider failures', async () => {
  const originalError = console.error;
  console.error = () => {};
  setRequestTextResponder(() => ({
    status: 'fail',
    message: 'private range',
  }));

  try {
    const { status, body } = await getJson('/api/weather/ip-location');

    assert.equal(status, 500);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'private range');
    assert.equal(body.location, null);
  } finally {
    console.error = originalError;
  }
});

test('/api/weather/radio builds a rainy weather radio from coordinates', async () => {
  const weatherCalls = [];
  const searchCalls = [];
  setRequestTextResponder(targetUrl => {
    weatherCalls.push(targetUrl);
    assert.match(targetUrl, /api\.open-meteo\.com/);
    return {
      timezone: 'Asia/Shanghai',
      current: {
        time: '2026-06-30T09:00',
        temperature_2m: 22,
        apparent_temperature: 23,
        relative_humidity_2m: 88,
        is_day: 1,
        precipitation: 1.2,
        rain: 1.2,
        showers: 0,
        snowfall: 0,
        weather_code: 61,
        cloud_cover: 95,
        wind_speed_10m: 12,
        wind_gusts_10m: 18,
      },
    };
  });
  server.__test.setNeteaseApi({
    cloudsearch: async opts => {
      searchCalls.push(opts);
      return {
        body: {
          result: {
            songs: [
              {
                id: 6000 + searchCalls.length,
                name: opts.keywords,
                ar: [{ id: 70 + searchCalls.length, name: searchCalls.length === 1 ? '周杰伦' : 'Rain Artist' }],
                al: { name: 'Weather Album', picUrl: 'https://img.example/weather.jpg' },
                dt: 200000,
                fee: 0,
              },
            ],
          },
        },
      };
    },
    song_detail: async () => ({ body: { songs: [] } }),
  });

  const { status, body } = await getJson('/api/weather/radio?lat=31.23&lon=121.47&city=上海&timezone=Asia/Shanghai');

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.weather.provider, 'open-meteo');
  assert.equal(body.weather.location.name, '上海');
  assert.equal(body.weather.location.latitude, 31.23);
  assert.equal(body.weather.location.longitude, 121.47);
  assert.equal(body.weather.label, '雨');
  assert.equal(body.weather.weatherCode, 61);
  assert.match(body.weather.mood.key, /^rain/);
  assert.equal(body.radio.title, body.weather.mood.title);
  assert.deepEqual(body.radio.seedQueries, ['陈奕迅 阴天快乐', '周杰伦 雨下一整晚', '孙燕姿 遇见', '林宥嘉 说谎']);
  assert.equal(body.radio.songs.length, 6);
  assert.equal(body.radio.songs[0].provider, 'netease');
  assert.equal(body.radio.songs[0].weatherSource, undefined);
  assert.equal(weatherCalls.length, 1);
  assert.equal(weatherCalls[0].includes('latitude=31.23'), true);
  assert.equal(weatherCalls[0].includes('longitude=121.47'), true);
  assert.equal(searchCalls.length, 6);
  assert.deepEqual(searchCalls.slice(0, 4).map(call => call.keywords), body.radio.seedQueries);
});

test('/api/weather/radio resolves city weather into a storm night radio', async () => {
  const weatherCalls = [];
  const searchCalls = [];
  setRequestTextResponder(targetUrl => {
    weatherCalls.push(targetUrl);
    if (targetUrl.includes('geocoding-api.open-meteo.com')) {
      return {
        results: [
          {
            name: '南京',
            country: '中国',
            admin1: '江苏',
            latitude: 32.06,
            longitude: 118.79,
            timezone: 'Asia/Shanghai',
          },
        ],
      };
    }
    assert.match(targetUrl, /api\.open-meteo\.com/);
    return {
      timezone: 'Asia/Shanghai',
      current: {
        time: '2026-06-30T22:00',
        temperature_2m: 19,
        apparent_temperature: 18,
        relative_humidity_2m: 81,
        is_day: 0,
        precipitation: 3.6,
        rain: 2.8,
        showers: 0.8,
        snowfall: 0,
        weather_code: 95,
        cloud_cover: 100,
        wind_speed_10m: 31,
        wind_gusts_10m: 48,
      },
    };
  });
  server.__test.setNeteaseApi({
    cloudsearch: async opts => {
      searchCalls.push(opts);
      return {
        body: {
          result: {
            songs: [
              {
                id: 7100 + searchCalls.length,
                name: opts.keywords,
                ar: [{ id: 90 + searchCalls.length, name: searchCalls.length === 1 ? '方大同' : 'Storm Artist' }],
                al: { name: 'Storm Album', picUrl: 'https://img.example/storm.jpg' },
                dt: 190000,
                fee: 0,
              },
            ],
          },
        },
      };
    },
    song_detail: async () => ({ body: { songs: [] } }),
  });

  const { status, body } = await getJson('/api/weather/radio?city=南京');

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.weather.location.name, '南京');
  assert.equal(body.weather.location.country, '中国');
  assert.equal(body.weather.location.admin1, '江苏');
  assert.equal(body.weather.weatherCode, 95);
  assert.equal(body.weather.label, '雷雨');
  assert.equal(body.weather.mood.key, 'storm-night');
  assert.equal(body.weather.mood.title, '雷雨夜听');
  assert.equal(body.weather.mood.energy, 0.56);
  assert.equal(body.weather.mood.focus, 0.68);
  assert.equal(body.weather.mood.melancholy, 0.62);
  assert.equal(body.weather.mood.keywords[0], '公路 摇滚');
  assert.deepEqual(body.radio.seedQueries, ['陈奕迅 阴天快乐', '周杰伦 雨下一整晚', '孙燕姿 遇见', '林宥嘉 说谎']);
  assert.equal(body.radio.songs.length, 6);
  assert.equal(weatherCalls.length, 2);
  assert.equal(weatherCalls[0].includes('geocoding-api.open-meteo.com'), true);
  assert.equal(weatherCalls[0].includes('%E5%8D%97%E4%BA%AC'), true);
  assert.equal(weatherCalls[1].includes('latitude=32.06'), true);
  assert.equal(weatherCalls[1].includes('longitude=118.79'), true);
  assert.equal(searchCalls.length, 6);
  assert.deepEqual(searchCalls.slice(0, 4).map(call => call.keywords), body.radio.seedQueries);
  assert.deepEqual(searchCalls.slice(4).map(call => call.keywords), ['公路 摇滚', 'windy day playlist']);
});

test('/api/weather/radio builds a snowy night radio from cold weather', async () => {
  const searchCalls = [];
  setRequestTextResponder(targetUrl => {
    assert.match(targetUrl, /api\.open-meteo\.com/);
    return {
      timezone: 'Asia/Shanghai',
      current: {
        time: '2026-12-21T23:00',
        temperature_2m: -2,
        apparent_temperature: -6,
        relative_humidity_2m: 64,
        is_day: 0,
        precipitation: 0,
        rain: 0,
        showers: 0,
        snowfall: 0,
        weather_code: 71,
        cloud_cover: 90,
        wind_speed_10m: 8,
        wind_gusts_10m: 16,
      },
    };
  });
  server.__test.setNeteaseApi({
    cloudsearch: async opts => {
      searchCalls.push(opts);
      return {
        body: {
          result: {
            songs: [
              {
                id: 7200 + searchCalls.length,
                name: opts.keywords,
                ar: [{ id: 120 + searchCalls.length, name: searchCalls.length === 1 ? '李健' : 'Snow Artist' }],
                al: { name: 'Snow Album', picUrl: 'https://img.example/snow.jpg' },
                dt: 205000,
                fee: 0,
              },
            ],
          },
        },
      };
    },
    song_detail: async () => ({ body: { songs: [] } }),
  });

  const { status, body } = await getJson('/api/weather/radio?lat=45.75&lon=126.63&city=哈尔滨&timezone=Asia/Shanghai');

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.weather.label, '雪');
  assert.equal(body.weather.weatherCode, 71);
  assert.equal(body.weather.mood.key, 'snow-night');
  assert.equal(body.weather.mood.title, '冷空气夜听');
  assert.equal(body.weather.mood.energy, 0.34);
  assert.equal(body.weather.mood.focus, 0.72);
  assert.equal(body.weather.mood.keywords[0], '夜晚 R&B');
  assert.deepEqual(body.radio.seedQueries, ['陈奕迅 好久不见', '莫文蔚 阴天', '李健 贝加尔湖畔', '朴树 平凡之路']);
  assert.equal(body.radio.songs.length, 6);
  assert.equal(searchCalls.length, 6);
  assert.deepEqual(searchCalls.slice(4).map(call => call.keywords), ['夜晚 R&B', 'late night jazz']);
});

test('/api/weather/radio uses fallback weather when the provider fails', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  const searchCalls = [];
  setRequestTextResponder(() => {
    throw new Error('weather unavailable');
  });
  server.__test.setNeteaseApi({
    cloudsearch: async opts => {
      searchCalls.push(opts);
      return {
        body: {
          result: {
            songs: [
              {
                id: 7000 + searchCalls.length,
                name: opts.keywords,
                ar: [{ id: 88, name: '陈奕迅' }],
                al: { name: 'Fallback Album', picUrl: 'https://img.example/fallback-weather.jpg' },
                dt: 210000,
                fee: 0,
              },
            ],
          },
        },
      };
    },
    song_detail: async () => ({ body: { songs: [] } }),
  });

  try {
    const { status, body } = await getJson('/api/weather/radio?city=杭州');

    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.weather.location.name, '杭州');
    assert.equal(body.weather.location.fallback, true);
    assert.equal(body.weather.error, 'weather unavailable');
    assert.equal(body.weather.mood.key, 'fallback');
    assert.equal(body.radio.title, '临时电台');
    assert.equal(body.radio.seedQueries.length, 4);
    assert.equal(body.radio.songs.length, 6);
    assert.equal(searchCalls.length, 6);
  } finally {
    console.warn = originalWarn;
  }
});

test('/api/podcast/dj-beatmap rejects invalid audio urls before analysis', async () => {
  const originalFetch = global.fetch;
  let requested = false;
  global.fetch = async () => {
    requested = true;
    return {};
  };

  try {
    const { status, body } = await getJson('/api/podcast/dj-beatmap?url=file:///tmp/audio.mp3');

    assert.equal(status, 400);
    assert.deepEqual(body, { error: 'Invalid audio url' });
    assert.equal(requested, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('/api/podcast/dj-beatmap reports analysis failures', async () => {
  const originalFetch = global.fetch;
  const originalLog = console.log;
  const originalError = console.error;
  const calls = [];
  console.log = () => {};
  console.error = () => {};
  global.fetch = async (targetUrl, opts) => {
    calls.push({ targetUrl, opts });
    return { ok: false, status: 503, body: null };
  };

  try {
    const { status, body } = await getJson('/api/podcast/dj-beatmap?url=' + encodeURIComponent('https://audio.example/fail.mp3') + '&duration=30');

    assert.equal(status, 500);
    assert.deepEqual(body, { ok: false, error: 'Audio fetch failed: 503' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].targetUrl, 'https://audio.example/fail.mp3');
    assert.equal(calls[0].opts.headers.Referer, 'https://music.163.com/');
  } finally {
    global.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
  }
});

test('/api/podcast/dj-beatmap returns an intro map for empty decoded audio', async () => {
  const originalFetch = global.fetch;
  const originalLog = console.log;
  console.log = () => {};
  global.fetch = async () => ({
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        controller.close();
      },
    }),
  });

  try {
    const { status, body } = await getJson('/api/podcast/dj-beatmap?url=' + encodeURIComponent('https://audio.example/empty.mp3') + '&duration=360&intro=120');

    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.map.tempoSource, 'podcast-dj-server-intro-offline');
    assert.equal(body.map.partial, true);
    assert.equal(body.map.fullDuration, 360);
    assert.equal(body.map.partialUntilSec, 0);
    assert.equal(body.map.visualBeatCount, 0);
    assert.equal(body.map.decode.intro, true);
    assert.equal(body.map.decode.requestedDurationSec, 360);
  } finally {
    global.fetch = originalFetch;
    console.log = originalLog;
  }
});

test('/api/audio requires a target URL', async () => {
  const res = await requestRaw('GET', '/api/audio');

  assert.equal(res.status, 400);
  assert.equal(res.body.toString(), 'Missing url');
});

test('/api/audio proxies range requests with music-friendly headers', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (targetUrl, opts) => {
    calls.push({ targetUrl, headers: opts.headers });
    return {
      status: 206,
      headers: new Headers({
        'content-type': 'application/octet-stream',
        'content-length': '3',
        'content-range': 'bytes 0-2/9',
      }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(Buffer.from('abc'));
          controller.close();
        },
      }),
    };
  };

  try {
    const audioUrl = 'https://dl.stream.qq.com/C400song.flac?token=abc';
    const res = await requestRaw(
      'GET',
      '/api/audio?url=' + encodeURIComponent(audioUrl),
      { range: 'bytes=0-2' },
    );

    assert.equal(res.status, 206);
    assert.equal(res.headers['Content-Type'], 'audio/flac');
    assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
    assert.equal(res.headers['Accept-Ranges'], 'bytes');
    assert.equal(res.headers['Content-Length'], '3');
    assert.equal(res.headers['Content-Range'], 'bytes 0-2/9');
    assert.equal(res.body.toString(), 'abc');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].targetUrl, audioUrl);
    assert.equal(calls[0].headers.Range, 'bytes=0-2');
    assert.equal(calls[0].headers.Referer, 'https://y.qq.com/');
  } finally {
    global.fetch = originalFetch;
  }
});

test('/api/audio infers common audio content types from file extensions', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    status: 200,
    headers: new Headers({ 'content-type': 'application/octet-stream' }),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(Buffer.from('ok'));
        controller.close();
      },
    }),
  });

  try {
    const cases = [
      ['https://audio.example/song.mp3', 'audio/mpeg'],
      ['https://audio.example/song.m4a', 'audio/mp4'],
      ['https://audio.example/song.mp4', 'audio/mp4'],
      ['https://audio.example/song.ogg', 'audio/ogg'],
      ['https://audio.example/song.wav', 'audio/wav'],
      ['https://audio.example/song.bin', 'application/octet-stream'],
    ];

    for (const [audioUrl, expectedType] of cases) {
      const res = await requestRaw('GET', '/api/audio?url=' + encodeURIComponent(audioUrl));

      assert.equal(res.status, 200);
      assert.equal(res.headers['Content-Type'], expectedType);
      assert.equal(res.body.toString(), 'ok');
    }
  } finally {
    global.fetch = originalFetch;
  }
});

test('/api/audio returns 500 when the upstream request fails', async () => {
  const originalFetch = global.fetch;
  const originalError = console.error;
  console.error = () => {};
  global.fetch = async () => {
    throw new Error('audio upstream unavailable');
  };

  try {
    const res = await requestRaw('GET', '/api/audio?url=' + encodeURIComponent('https://audio.example/fail.mp3'));

    assert.equal(res.status, 500);
    assert.equal(res.body.length, 0);
  } finally {
    global.fetch = originalFetch;
    console.error = originalError;
  }
});

test('/api/cover rejects invalid URLs before fetching', async () => {
  const originalFetch = global.fetch;
  let requested = false;
  global.fetch = async () => {
    requested = true;
    return {};
  };

  try {
    const res = await requestRaw('GET', '/api/cover?url=file:///etc/passwd');

    assert.equal(res.status, 400);
    assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
    assert.equal(res.body.toString(), 'Invalid cover url');
    assert.equal(requested, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('/api/cover returns 500 when the upstream request fails', async () => {
  const originalFetch = global.fetch;
  const originalError = console.error;
  console.error = () => {};
  global.fetch = async () => {
    throw new Error('cover upstream unavailable');
  };

  try {
    const res = await requestRaw('GET', '/api/cover?url=' + encodeURIComponent('https://img.example/fail.jpg'));

    assert.equal(res.status, 500);
    assert.equal(res.body.length, 0);
  } finally {
    global.fetch = originalFetch;
    console.error = originalError;
  }
});

test('/api/cover streams upstream images with canvas-safe headers', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (targetUrl, opts) => {
    calls.push({ targetUrl, headers: opts.headers });
    return {
      status: 200,
      headers: new Headers({
        'content-type': 'image/png',
        'content-length': '4',
      }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(Buffer.from('png!'));
          controller.close();
        },
      }),
    };
  };

  try {
    const coverUrl = 'https://p1.music.126.net/cover.png';
    const res = await requestRaw('GET', '/api/cover?url=' + encodeURIComponent(coverUrl));

    assert.equal(res.status, 200);
    assert.equal(res.headers['Content-Type'], 'image/png');
    assert.equal(res.headers['Content-Length'], '4');
    assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
    assert.equal(res.headers['Cross-Origin-Resource-Policy'], 'cross-origin');
    assert.equal(res.headers['Cache-Control'], 'public, max-age=86400');
    assert.equal(res.body.toString(), 'png!');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].targetUrl, coverUrl);
    assert.equal(calls[0].headers.Referer, 'https://music.163.com/');
  } finally {
    global.fetch = originalFetch;
  }
});

test('static routes serve app assets, the root page, and missing files', async () => {
  const favicon = await requestRaw('GET', '/favicon.ico');

  assert.equal(favicon.status, 200);
  assert.equal(favicon.headers['Content-Type'], 'image/x-icon');
  assert.ok(favicon.body.length > 0);

  const index = await requestRaw('GET', '/');

  assert.equal(index.status, 200);
  assert.equal(index.headers['Content-Type'], 'text/html; charset=utf-8');
  assert.match(index.body.toString('utf8'), /<html/i);

  const archive = await requestRaw('GET', '/default-user-fx-archive.json');

  assert.equal(archive.status, 200);
  assert.equal(archive.headers['Content-Type'], 'application/json');
  assert.doesNotThrow(() => JSON.parse(archive.body.toString('utf8')));

  const missing = await requestRaw('GET', '/missing-static-test.txt');

  assert.equal(missing.status, 404);
  assert.equal(missing.body.toString(), 'Not Found');
});
