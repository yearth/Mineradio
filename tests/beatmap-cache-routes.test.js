const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-beatmap-cache-'));
const cacheDir = path.join(testDir, 'beatmaps');

process.env.PORT = '0';
process.env.HOST = '127.0.0.1';
process.env.NODE_ENV = 'test';
process.env.COOKIE_FILE = path.join(testDir, '.cookie');
process.env.QQ_COOKIE_FILE = path.join(testDir, '.qq-cookie');
process.env.MINERADIO_BEAT_CACHE_DIR = cacheDir;

const server = require('../server');

test.afterEach(() => {
  if (server.__test) server.__test.resetMusicRuntime();
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

test('/api/beatmap/cache/status reports the configured disk cache directory', async () => {
  const { status, body } = await getJson('/api/beatmap/cache/status');

  assert.equal(status, 200);
  assert.equal(body.enabled, true);
  assert.equal(body.dir, cacheDir);
  assert.equal(body.mode, 'disk');
  assert.equal(body.reason, '');
});

test('/api/beatmap/cache returns misses, writes compact entries, and reads hits', async () => {
  const key = 'netease:track/123?quality=hires';
  const miss = await getJson('/api/beatmap/cache?key=' + encodeURIComponent(key));

  assert.equal(miss.status, 200);
  assert.deepEqual(miss.body, { ok: true, hit: false, key });

  const map = {
    duration: 12,
    beats: [{ time: 0.5, strength: 0.7 }],
    pulseBeats: [],
  };
  const saved = await postJson('/api/beatmap/cache', {
    key,
    provider: 'netease',
    title: 'A'.repeat(200),
    artist: 'Cache Artist',
    mode: 'dj',
    map,
    ignored: 'not persisted',
  });

  assert.equal(saved.status, 200);
  assert.equal(saved.body.ok, true);
  assert.equal(saved.body.key, key);
  assert.equal(saved.body.dir, cacheDir);
  assert.equal(typeof saved.body.savedAt, 'number');

  const files = fs.readdirSync(cacheDir).filter(name => name.endsWith('.json'));
  assert.equal(files.length, 1);
  assert.match(files[0], /^netease_track_123_quality_hires-[a-f0-9]{40}\.json$/);

  const raw = JSON.parse(fs.readFileSync(path.join(cacheDir, files[0]), 'utf8'));
  assert.equal(raw.v, 1);
  assert.equal(raw.key, key);
  assert.equal(raw.meta.provider, 'netease');
  assert.equal(raw.meta.title.length, 160);
  assert.equal(raw.meta.artist, 'Cache Artist');
  assert.equal(raw.meta.mode, 'dj');
  assert.deepEqual(raw.map, map);
  assert.equal(Object.prototype.hasOwnProperty.call(raw, 'ignored'), false);

  const hit = await getJson('/api/beatmap/cache?key=' + encodeURIComponent(key));
  assert.equal(hit.status, 200);
  assert.equal(hit.body.ok, true);
  assert.equal(hit.body.hit, true);
  assert.equal(hit.body.key, key);
  assert.deepEqual(hit.body.meta, raw.meta);
  assert.deepEqual(hit.body.map, map);
  assert.equal(hit.body.savedAt, raw.savedAt);
});

test('/api/beatmap/cache rejects invalid writes and unsupported methods', async () => {
  const invalid = await postJson('/api/beatmap/cache', { key: 'missing-map' });

  assert.equal(invalid.status, 200);
  assert.deepEqual(invalid.body, { ok: false, error: 'INVALID_BEATMAP_CACHE_PAYLOAD' });

  const method = await requestJson('DELETE', '/api/beatmap/cache');

  assert.equal(method.status, 405);
  assert.deepEqual(method.body, { ok: false, error: 'METHOD_NOT_ALLOWED' });
});
