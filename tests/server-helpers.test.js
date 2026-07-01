const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-server-helpers-'));

process.env.PORT = '0';
process.env.HOST = '127.0.0.1';
process.env.NODE_ENV = 'test';
process.env.COOKIE_FILE = path.join(testDir, '.cookie');
process.env.QQ_COOKIE_FILE = path.join(testDir, '.qq-cookie');

const server = require('../server');
const {
  normalizeCookieHeader,
  moveInvalidUpdateFile,
  parseGitHubRepository,
  rawCookieFallback,
  requestText,
  readUpdateConfig,
} = server.__test;

function withEnv(overrides, fn) {
  const keys = Object.keys(overrides);
  const previous = new Map(keys.map(key => [key, process.env[key]]));
  keys.forEach(key => {
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  });
  try {
    return fn();
  } finally {
    previous.forEach((value, key) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
}

test('cookie helpers normalize structured values and preserve raw string fallbacks', () => {
  assert.equal(
    normalizeCookieHeader([
      { name: 'MUSIC_U', value: 'secret' },
      { Path: '/', Domain: 'music.163.com' },
      { __csrf: { value: 'csrf-token' }, ignored: { nested: true }, NMTID: 'abc' },
      'MUSIC_U=overridden; Secure; flag; os=mac',
    ]),
    'MUSIC_U=overridden; __csrf=csrf-token; NMTID=abc; os=mac'
  );

  assert.equal(rawCookieFallback(['a=1', 'b=2']), 'a=1; b=2');
  assert.equal(rawCookieFallback(['a=1', { b: 2 }]), '');
});

test('parseGitHubRepository accepts shorthand and GitHub URLs', () => {
  assert.deepEqual(parseGitHubRepository('owner/repo.git'), { owner: 'owner', repo: 'repo' });
  assert.deepEqual(parseGitHubRepository('git@github.com:Owner.Name/repo-name.git'), {
    owner: 'Owner.Name',
    repo: 'repo-name',
  });
  assert.deepEqual(parseGitHubRepository('https://github.com/owner/repo.git?tab=readme'), {
    owner: 'owner',
    repo: 'repo',
  });
  assert.equal(parseGitHubRepository('not a github repo'), null);
  assert.equal(parseGitHubRepository(''), null);
});

test('readUpdateConfig merges package update settings and environment overrides', () => {
  const pkg = {
    repository: { url: 'https://github.com/pkg-owner/pkg-repo.git' },
    mineradio: {
      update: {
        provider: 'github',
        preview: false,
        preferMirrors: false,
        mirrors: [
          'https://mirror.example.com/',
          'https://mirror.example.com',
          'ftp://ignored.example.com/',
          '',
        ],
      },
    },
  };

  const local = withEnv({
    MINERADIO_UPDATE_REPOSITORY: undefined,
    GITHUB_REPOSITORY: undefined,
    MINERADIO_UPDATE_OWNER: undefined,
    MINERADIO_UPDATE_REPO: undefined,
    MINERADIO_UPDATE_MANIFEST: undefined,
    MINERADIO_UPDATE_MANIFEST_URL: undefined,
    MINERADIO_UPDATE_MANIFEST_FILE: undefined,
    MINERADIO_UPDATE_MIRRORS: undefined,
    MINERADIO_UPDATE_MIRROR: undefined,
  }, () => readUpdateConfig(pkg));

  assert.equal(local.configured, true);
  assert.equal(local.owner, 'pkg-owner');
  assert.equal(local.repo, 'pkg-repo');
  assert.equal(local.preview, false);
  assert.equal(local.preferMirrors, false);
  assert.deepEqual(local.mirrors, ['https://mirror.example.com/']);
  assert.equal(local.manifest, '');

  const overridden = withEnv({
    MINERADIO_UPDATE_REPOSITORY: 'env-owner/env-repo',
    GITHUB_REPOSITORY: undefined,
    MINERADIO_UPDATE_OWNER: 'manual-owner',
    MINERADIO_UPDATE_REPO: 'manual-repo',
    MINERADIO_UPDATE_MANIFEST: 'https://updates.example.com/manifest.json',
    MINERADIO_UPDATE_MANIFEST_URL: undefined,
    MINERADIO_UPDATE_MANIFEST_FILE: undefined,
    MINERADIO_UPDATE_MIRRORS: 'https://a.example.com/, https://A.example.com ; https://b.example.com/',
    MINERADIO_UPDATE_MIRROR: undefined,
  }, () => readUpdateConfig(pkg));

  assert.equal(overridden.configured, true);
  assert.equal(overridden.owner, 'manual-owner');
  assert.equal(overridden.repo, 'manual-repo');
  assert.equal(overridden.manifest, 'https://updates.example.com/manifest.json');
  assert.deepEqual(overridden.mirrors, ['https://a.example.com/', 'https://b.example.com/']);
});

test('requestText performs real HTTP requests and surfaces HTTP errors', async () => {
  const received = [];
  const upstream = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      received.push({
        method: req.method,
        token: req.headers['x-test-token'],
        body,
      });
      if (req.url === '/fail') {
        res.writeHead(503, { 'content-type': 'text/plain' });
        res.end('temporarily unavailable');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok:' + body);
    });
  });

  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const { port } = upstream.address();
  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    const text = await requestText(baseUrl + '/echo', {
      method: 'POST',
      headers: { 'x-test-token': 'abc123' },
    }, 'payload');

    assert.equal(text, 'ok:payload');
    assert.deepEqual(received[0], {
      method: 'POST',
      token: 'abc123',
      body: 'payload',
    });

    await assert.rejects(
      requestText(baseUrl + '/fail'),
      err => {
        assert.equal(err.message, 'HTTP 503');
        assert.equal(err.statusCode, 503);
        assert.equal(err.body, 'temporarily unavailable');
        return true;
      }
    );
  } finally {
    await new Promise(resolve => upstream.close(resolve));
  }
});

test('moveInvalidUpdateFile ignores rename failures for stale cached installers', () => {
  const cached = path.join(testDir, 'stale-installer.exe');
  fs.writeFileSync(cached, 'stale');
  const originalRename = fs.renameSync;
  const originalWarn = console.warn;
  const warnings = [];
  fs.renameSync = (from, to) => {
    if (from === cached) throw new Error('rename denied');
    return originalRename.call(fs, from, to);
  };
  console.warn = (...args) => warnings.push(args.join(' '));

  try {
    assert.doesNotThrow(() => moveInvalidUpdateFile(cached, 'test failure'));
    assert.equal(fs.readFileSync(cached, 'utf8'), 'stale');
    assert.equal(warnings.some(line => line.includes('failed to move invalid cached installer')), true);
  } finally {
    fs.renameSync = originalRename;
    console.warn = originalWarn;
    if (fs.existsSync(cached)) fs.unlinkSync(cached);
  }
});
