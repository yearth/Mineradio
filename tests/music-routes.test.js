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

async function getJson(pathname) {
  return requestJson('GET', pathname);
}

async function postJson(pathname, body) {
  return requestJson('POST', pathname, body);
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

test('/api/song/like/check requires login', async () => {
  const { status, body } = await getJson('/api/song/like/check?ids=101,102');

  assert.equal(status, 401);
  assert.equal(body.error, 'LOGIN_REQUIRED');
  assert.equal(body.loggedIn, false);
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
