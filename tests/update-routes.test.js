const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');

process.env.PORT = '0';
process.env.HOST = '127.0.0.1';
process.env.NODE_ENV = 'test';
process.env.MINERADIO_UPDATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-update-routes-'));

const originalFetch = global.fetch;
const server = require('../server');
const PATCH_TEST_FILE = path.join(__dirname, '..', 'public', '.mineradio-patch-test.txt');

test.afterEach(() => {
  global.fetch = originalFetch;
  if (fs.existsSync(PATCH_TEST_FILE)) fs.unlinkSync(PATCH_TEST_FILE);
  if (server.__test) server.__test.resetUpdateRuntime();
});

async function getJson(pathname) {
  return new Promise((resolve, reject) => {
    const req = new Readable({ read() { this.push(null); } });
    req.url = pathname;
    req.method = 'GET';
    req.headers = {};
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

function writeUpdateManifest(name, data) {
  const manifestPath = path.join(process.env.MINERADIO_UPDATE_DIR, name);
  fs.writeFileSync(manifestPath, JSON.stringify(data));
  return manifestPath;
}

function manifestWithInstaller(version, assetOverrides) {
  assetOverrides = assetOverrides || {};
  return {
    version,
    release: {
      name: `Mineradio v${version}`,
      downloadUrl: `https://example.com/Mineradio-${version}-Setup.exe`,
      asset: {
        name: `Mineradio-${version}-Setup.exe`,
        size: assetOverrides.size || 12345,
        sha256: assetOverrides.sha256 || 'sha256:ABCDEF',
      },
      notes: ['修复播放状态同步'],
    },
  };
}

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function writeCachedInstaller(fileName, content) {
  const downloadDir = path.join(process.env.MINERADIO_UPDATE_DIR, 'downloads');
  fs.mkdirSync(downloadDir, { recursive: true });
  const filePath = path.join(downloadDir, fileName);
  fs.writeFileSync(filePath, content);
  return filePath;
}

function fakeDownloadResponse(content) {
  return {
    ok: true,
    headers: {
      get(name) {
        return String(name || '').toLowerCase() === 'content-length' ? String(content.length) : '';
      },
    },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(content));
        controller.close();
      },
    }),
  };
}

function fakeDownloadFetch(content) {
  global.fetch = async () => fakeDownloadResponse(content);
}

function fakeJsonResponse(data) {
  return {
    ok: true,
    status: 200,
    headers: { get() { return ''; } },
    json: async () => data,
  };
}

function fakeTextResponse(text) {
  return {
    ok: true,
    status: 200,
    headers: { get() { return ''; } },
    text: async () => text,
  };
}

function fakeHttpResponse(status) {
  return {
    ok: false,
    status,
    headers: { get() { return ''; } },
  };
}

function fakeFetchSequence(responses) {
  const queue = responses.slice();
  const calls = [];
  global.fetch = async url => {
    calls.push(String(url || ''));
    const next = queue.shift();
    if (typeof next === 'function') return next(url);
    return next || fakeHttpResponse(500);
  };
  return calls;
}

async function waitForUpdateStatus(pathname, done) {
  for (let i = 0; i < 30; i++) {
    const result = await getJson(pathname);
    if (done(result.body)) return result;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  return getJson(pathname);
}

function manifestWithPatch(version) {
  return {
    version,
    release: {
      name: `Mineradio v${version}`,
      downloadUrl: `https://example.com/Mineradio-${version}-Setup.exe`,
      patchAvailable: true,
      patch: {
        name: `Mineradio-1.1.1-to-${version}.patch.json`,
        size: 2345,
        downloadUrl: `https://example.com/Mineradio-1.1.1-to-${version}.patch.json`,
        from: '1.1.1',
        to: version,
        sha256: 'sha256:FACEFEED',
      },
      notes: ['快速补丁'],
    },
  };
}

function manifestWithPatchPayload(version, payload) {
  const raw = Buffer.from(JSON.stringify(payload));
  const manifest = manifestWithPatch(version);
  manifest.release.patch.size = raw.length;
  manifest.release.patch.sha256 = 'sha256:' + sha256Hex(raw);
  return { manifest, raw };
}

test('/api/update/latest returns the non-Windows preview fallback', async () => {
  const { status, body } = await getJson('/api/update/latest');

  assert.equal(status, 200);
  assert.equal(body.configured, true);
  assert.equal(body.preview, true);
  assert.equal(body.updateAvailable, false);
  assert.equal(body.currentVersion, '1.1.1');
  assert.equal(body.latestVersion, '1.1.1');
  assert.equal(body.release.downloadUrl, '');
  assert.match(body.reason, /macOS 预览版暂不启用 Windows 更新通道/);
});

test('/api/update/latest reads manifest updates on the Windows update path', async () => {
  const manifestPath = writeUpdateManifest('manifest.json', manifestWithInstaller('1.2.0'));

  assert.equal(typeof server.__test.setUpdatePlatform, 'function');
  assert.equal(typeof server.__test.setUpdateManifest, 'function');
  server.__test.setUpdatePlatform('win32');
  server.__test.setUpdateManifest(manifestPath);

  const { status, body } = await getJson('/api/update/latest');

  assert.equal(status, 200);
  assert.equal(body.configured, true);
  assert.equal(body.preview, false);
  assert.equal(body.updateAvailable, true);
  assert.equal(body.latestVersion, '1.2.0');
  assert.equal(body.release.downloadUrl, 'https://example.com/Mineradio-1.2.0-Setup.exe');
  assert.equal(body.release.asset.sha256, 'abcdef');
  assert.deepEqual(body.release.notes, ['修复播放状态同步']);
});

test('/api/update/latest reads remote manifest updates with Mineradio user agent', async () => {
  const calls = [];
  global.fetch = async (targetUrl, opts) => {
    calls.push({ targetUrl: String(targetUrl), opts });
    return fakeJsonResponse(manifestWithInstaller('1.2.1'));
  };

  server.__test.setUpdatePlatform('win32');
  server.__test.setUpdateManifest('https://updates.example.com/mineradio/manifest.json');

  const { status, body } = await getJson('/api/update/latest');

  assert.equal(status, 200);
  assert.equal(body.configured, true);
  assert.equal(body.preview, false);
  assert.equal(body.updateAvailable, true);
  assert.equal(body.latestVersion, '1.2.1');
  assert.equal(body.release.asset.name, 'Mineradio-1.2.1-Setup.exe');
  assert.equal(body.source, 'manifest');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].targetUrl, 'https://updates.example.com/mineradio/manifest.json');
  assert.equal(calls[0].opts.headers['User-Agent'], 'Mineradio/1.1.1');
});

test('/api/update/latest reads the latest GitHub release on the Windows update path', async () => {
  const calls = fakeFetchSequence([
    fakeJsonResponse({
      tag_name: 'v1.3.0',
      name: 'Mineradio v1.3.0',
      published_at: '2026-06-29T10:00:00Z',
      html_url: 'https://github.com/XxHuberrr/Mineradio/releases/tag/v1.3.0',
      body: '## Changes\n- Better playback\n- Faster updates\nhttps://example.com/full-log',
      assets: [
        {
          name: 'Source code.zip',
          size: 100,
          content_type: 'application/zip',
          browser_download_url: 'https://github.com/XxHuberrr/Mineradio/archive/refs/tags/v1.3.0.zip',
        },
        {
          name: 'Mineradio-1.3.0-Setup.exe',
          size: 45678,
          content_type: 'application/octet-stream',
          digest: 'sha256:DEADBEEF',
          browser_download_url: 'https://github.com/XxHuberrr/Mineradio/releases/download/v1.3.0/Mineradio-1.3.0-Setup.exe',
        },
        {
          name: 'Mineradio-1.1.1-to-1.3.0.patch.json',
          size: 789,
          content_type: 'application/json',
          browser_download_url: 'https://github.com/XxHuberrr/Mineradio/releases/download/v1.3.0/Mineradio-1.1.1-to-1.3.0.patch.json',
        },
      ],
    }),
  ]);

  server.__test.setUpdatePlatform('win32');

  const { status, body } = await getJson('/api/update/latest');

  assert.equal(status, 200);
  assert.equal(body.configured, true);
  assert.equal(body.preview, false);
  assert.equal(body.updateAvailable, true);
  assert.equal(body.latestVersion, '1.3.0');
  assert.equal(body.release.asset.name, 'Mineradio-1.3.0-Setup.exe');
  assert.equal(body.release.asset.size, 45678);
  assert.equal(body.release.asset.sha256, 'deadbeef');
  assert.equal(body.release.patch.name, 'Mineradio-1.1.1-to-1.3.0.patch.json');
  assert.equal(body.release.patchAvailable, true);
  assert.deepEqual(body.release.notes, ['Better playback', 'Faster updates']);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /api\.github\.com\/repos\/XxHuberrr\/Mineradio\/releases\/latest/);
});

test('/api/update/latest falls back to latest.yml when the GitHub release API fails', async () => {
  const calls = fakeFetchSequence([
    fakeHttpResponse(500),
    fakeTextResponse([
      'version: 1.4.0',
      'path: Mineradio-1.4.0-Setup.exe',
      'sha512: abc123',
      'size: 654321',
      'releaseDate: 2026-06-30T09:00:00.000Z',
    ].join('\n')),
  ]);

  server.__test.setUpdatePlatform('win32');

  const { status, body } = await getJson('/api/update/latest');

  assert.equal(status, 200);
  assert.equal(body.configured, true);
  assert.equal(body.preview, false);
  assert.equal(body.updateAvailable, true);
  assert.equal(body.latestVersion, '1.4.0');
  assert.equal(body.source, 'latest-yml');
  assert.equal(body.reason, 'GitHub Releases 500');
  assert.equal(body.release.asset.name, 'Mineradio-1.4.0-Setup.exe');
  assert.equal(body.release.asset.size, 654321);
  assert.equal(body.release.asset.sha512, 'abc123');
  assert.equal(body.release.patchAvailable, false);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /api\.github\.com\/repos\/XxHuberrr\/Mineradio\/releases\/latest/);
  assert.match(calls[1], /latest\.yml/);
});

test('/api/update/download creates an installer job from a Windows manifest without starting a test download', async () => {
  const manifestPath = writeUpdateManifest('manifest-download.json', manifestWithInstaller('1.2.0'));

  assert.equal(typeof server.__test.setUpdatePlatform, 'function');
  assert.equal(typeof server.__test.setUpdateManifest, 'function');
  assert.equal(typeof server.__test.setUpdateAutoDownload, 'function');
  server.__test.setUpdatePlatform('win32');
  server.__test.setUpdateManifest(manifestPath);
  server.__test.setUpdateAutoDownload(false);

  const { status, body } = await getJson('/api/update/download');

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, 'queued');
  assert.equal(body.mode, 'installer');
  assert.equal(body.fileName, 'Mineradio-1.2.0-Setup.exe');
  assert.equal(body.version, '1.2.0');
  assert.equal(body.total, 12345);
  assert.equal(body.attempts > 0, true);
  assert.equal(body.filePath, '');

  const lookup = await getJson('/api/update/download/status?id=' + encodeURIComponent(body.id));
  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.id, body.id);
  assert.equal(lookup.body.status, 'queued');
});

test('/api/update/download reuses a verified cached installer', async () => {
  const content = Buffer.from('cached installer package');
  const fileName = 'Mineradio-1.2.1-Setup.exe';
  const filePath = writeCachedInstaller(fileName, content);
  const manifestPath = writeUpdateManifest('manifest-cached-download.json', manifestWithInstaller('1.2.1', {
    size: content.length,
    sha256: 'sha256:' + sha256Hex(content),
  }));

  server.__test.setUpdatePlatform('win32');
  server.__test.setUpdateManifest(manifestPath);
  server.__test.setUpdateAutoDownload(false);

  const { status, body } = await getJson('/api/update/download');

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, 'ready');
  assert.equal(body.cached, true);
  assert.equal(body.fileName, fileName);
  assert.equal(body.filePath, filePath);
  assert.equal(body.received, content.length);
  assert.equal(body.total, content.length);
});

test('/api/update/download moves an invalid cached installer aside before queuing a new job', async () => {
  const fileName = 'Mineradio-1.2.2-Setup.exe';
  const filePath = writeCachedInstaller(fileName, Buffer.from('stale cached package'));
  const manifestPath = writeUpdateManifest('manifest-invalid-cache-download.json', manifestWithInstaller('1.2.2', {
    size: 999,
    sha256: 'sha256:' + sha256Hex(Buffer.from('expected package')),
  }));

  server.__test.setUpdatePlatform('win32');
  server.__test.setUpdateManifest(manifestPath);
  server.__test.setUpdateAutoDownload(false);

  const warn = console.warn;
  console.warn = () => {};
  let result;
  try {
    result = await getJson('/api/update/download');
  } finally {
    console.warn = warn;
  }
  const { status, body } = result;

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, 'queued');
  assert.equal(body.cached, false);
  assert.equal(body.filePath, '');
  assert.equal(fs.existsSync(filePath), false);
  const invalidFiles = fs.readdirSync(path.dirname(filePath))
    .filter(name => name.startsWith('Mineradio-1.2.2-Setup.invalid-'));
  assert.equal(invalidFiles.length, 1);
});

test('/api/update/download marks installer ready after a verified download', async () => {
  const content = Buffer.from('fresh installer package');
  const manifestPath = writeUpdateManifest('manifest-download-ready.json', manifestWithInstaller('1.2.3', {
    size: content.length,
    sha256: 'sha256:' + sha256Hex(content),
  }));
  fakeDownloadFetch(content);

  server.__test.setUpdatePlatform('win32');
  server.__test.setUpdateManifest(manifestPath);

  const started = await getJson('/api/update/download');
  assert.equal(started.status, 200);
  assert.equal(started.body.ok, true);
  assert.equal(started.body.mode, 'installer');

  const lookup = await waitForUpdateStatus(
    '/api/update/download/status?id=' + encodeURIComponent(started.body.id),
    body => body.status === 'ready'
  );

  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.status, 'ready');
  assert.equal(lookup.body.progress, 100);
  assert.equal(lookup.body.fileName, 'Mineradio-1.2.3-Setup.exe');
  assert.equal(lookup.body.received, content.length);
  assert.equal(lookup.body.total, content.length);
  assert.equal(fs.readFileSync(lookup.body.filePath).toString(), content.toString());
});

test('/api/update/download reports an error when downloaded installer sha256 mismatches', async () => {
  const content = Buffer.from('tampered installer package');
  const manifestPath = writeUpdateManifest('manifest-download-hash-error.json', manifestWithInstaller('1.2.4', {
    size: content.length,
    sha256: 'sha256:' + sha256Hex(Buffer.from('expected installer package')),
  }));
  fakeDownloadFetch(content);

  server.__test.setUpdatePlatform('win32');
  server.__test.setUpdateManifest(manifestPath);

  const started = await getJson('/api/update/download');
  assert.equal(started.status, 200);
  assert.equal(started.body.ok, true);

  const lookup = await waitForUpdateStatus(
    '/api/update/download/status?id=' + encodeURIComponent(started.body.id),
    body => body.status === 'error'
  );

  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.ok, false);
  assert.equal(lookup.body.status, 'error');
  assert.equal(lookup.body.error, 'UPDATE_SHA256_MISMATCH');
  assert.match(lookup.body.errorReason, /文件校验失败/);
  assert.equal(lookup.body.filePath, '');
});

test('/api/update/download reports an error when downloaded installer size mismatches', async () => {
  const content = Buffer.from('short installer package');
  const manifestPath = writeUpdateManifest('manifest-download-size-error.json', manifestWithInstaller('1.2.5', {
    size: content.length + 10,
    sha256: 'sha256:' + sha256Hex(content),
  }));
  fakeDownloadFetch(content);

  server.__test.setUpdatePlatform('win32');
  server.__test.setUpdateManifest(manifestPath);

  const started = await getJson('/api/update/download');
  assert.equal(started.status, 200);
  assert.equal(started.body.ok, true);

  const lookup = await waitForUpdateStatus(
    '/api/update/download/status?id=' + encodeURIComponent(started.body.id),
    body => body.status === 'error'
  );

  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.ok, false);
  assert.equal(lookup.body.status, 'error');
  assert.equal(lookup.body.error, 'UPDATE_SIZE_MISMATCH');
  assert.match(lookup.body.errorReason, /下载文件大小不一致/);
  assert.equal(lookup.body.filePath, '');
});

test('/api/update/download switches to the next candidate after an HTTP failure', async () => {
  const content = Buffer.from('fallback installer package');
  const manifestPath = writeUpdateManifest('manifest-download-fallback.json', manifestWithInstaller('1.2.6', {
    size: content.length,
    sha256: 'sha256:' + sha256Hex(content),
  }));
  const calls = fakeFetchSequence([
    fakeHttpResponse(404),
    fakeDownloadResponse(content),
  ]);

  server.__test.setUpdatePlatform('win32');
  server.__test.setUpdateManifest(manifestPath);

  const started = await getJson('/api/update/download');
  assert.equal(started.status, 200);
  assert.equal(started.body.ok, true);

  const lookup = await waitForUpdateStatus(
    '/api/update/download/status?id=' + encodeURIComponent(started.body.id),
    body => body.status === 'ready'
  );

  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.status, 'ready');
  assert.equal(lookup.body.failedAttempts.length, 1);
  assert.match(lookup.body.failedAttempts[0].reason, /更新文件不存在/);
  assert.equal(calls.length, 2);
  assert.equal(fs.readFileSync(lookup.body.filePath).toString(), content.toString());
});

test('/api/update/download reports an error after all candidates fail', async () => {
  const manifestPath = writeUpdateManifest('manifest-download-all-fail.json', manifestWithInstaller('1.2.7', {
    size: 123,
    sha256: 'sha256:' + sha256Hex(Buffer.from('never downloaded')),
  }));
  const calls = fakeFetchSequence([
    fakeHttpResponse(500),
    fakeHttpResponse(404),
    fakeHttpResponse(403),
    fakeHttpResponse(500),
  ]);

  server.__test.setUpdatePlatform('win32');
  server.__test.setUpdateManifest(manifestPath);

  const started = await getJson('/api/update/download');
  assert.equal(started.status, 200);
  assert.equal(started.body.ok, true);

  const lookup = await waitForUpdateStatus(
    '/api/update/download/status?id=' + encodeURIComponent(started.body.id),
    body => body.status === 'error'
  );

  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.ok, false);
  assert.equal(lookup.body.status, 'error');
  assert.equal(lookup.body.error, 'HTTP_500');
  assert.match(lookup.body.errorReason, /服务器异常/);
  assert.equal(calls.length > 1, true);
  assert.equal(lookup.body.failedAttempts.length, Math.min(calls.length, 6));
  assert.equal(lookup.body.filePath, '');
});

test('/api/update/download does not start a Windows installer job for the preview fallback', async () => {
  const { status, body } = await getJson('/api/update/download');

  assert.equal(status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'NO_UPDATE_AVAILABLE');
});

test('/api/update/patch creates a patch job from a Windows manifest without applying a test patch', async () => {
  const manifestPath = writeUpdateManifest('manifest-patch.json', manifestWithPatch('1.2.0'));

  assert.equal(typeof server.__test.setUpdatePlatform, 'function');
  assert.equal(typeof server.__test.setUpdateManifest, 'function');
  assert.equal(typeof server.__test.setUpdateAutoPatch, 'function');
  server.__test.setUpdatePlatform('win32');
  server.__test.setUpdateManifest(manifestPath);
  server.__test.setUpdateAutoPatch(false);

  const { status, body } = await getJson('/api/update/patch');

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, 'queued');
  assert.equal(body.mode, 'patch');
  assert.equal(body.fileName, 'Mineradio-1.1.1-to-1.2.0.patch.json');
  assert.equal(body.version, '1.2.0');
  assert.equal(body.total, 2345);
  assert.equal(body.restartRequired, true);
  assert.equal(body.filePath, '');

  const lookup = await getJson('/api/update/patch/status?id=' + encodeURIComponent(body.id));
  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.id, body.id);
  assert.equal(lookup.body.status, 'queued');
});

test('/api/update/patch rejects unsafe patch file paths', async () => {
  const payload = {
    type: 'mineradio-resource-patch',
    from: '1.1.1',
    to: '1.2.8',
    files: [
      { path: '../package.json', content: 'unsafe write' },
    ],
  };
  const { manifest, raw } = manifestWithPatchPayload('1.2.8', payload);
  const manifestPath = writeUpdateManifest('manifest-patch-unsafe-path.json', manifest);
  fakeDownloadFetch(raw);

  server.__test.setUpdatePlatform('win32');
  server.__test.setUpdateManifest(manifestPath);

  const started = await getJson('/api/update/patch');
  assert.equal(started.status, 200);
  assert.equal(started.body.ok, true);

  const lookup = await waitForUpdateStatus(
    '/api/update/patch/status?id=' + encodeURIComponent(started.body.id),
    body => body.status === 'error'
  );

  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.ok, false);
  assert.equal(lookup.body.status, 'error');
  assert.equal(lookup.body.error, 'UPDATE_FAILED');
  assert.match(lookup.body.errorDetail, /INVALID_PATCH_FILE/);
  assert.match(lookup.body.message, /快速补丁失败/);
  assert.equal(lookup.body.filePath, '');
});

test('/api/update/patch applies an allowed public file patch', async () => {
  const content = 'patched public content';
  const payload = {
    type: 'mineradio-resource-patch',
    from: '1.1.1',
    to: '1.2.9',
    restartRequired: false,
    files: [
      {
        path: 'public/.mineradio-patch-test.txt',
        content,
        sha256: sha256Hex(Buffer.from(content)),
      },
    ],
  };
  const { manifest, raw } = manifestWithPatchPayload('1.2.9', payload);
  const manifestPath = writeUpdateManifest('manifest-patch-public-file.json', manifest);
  fakeDownloadFetch(raw);

  server.__test.setUpdatePlatform('win32');
  server.__test.setUpdateManifest(manifestPath);

  const started = await getJson('/api/update/patch');
  assert.equal(started.status, 200);
  assert.equal(started.body.ok, true);

  const lookup = await waitForUpdateStatus(
    '/api/update/patch/status?id=' + encodeURIComponent(started.body.id),
    body => body.status === 'ready'
  );

  assert.equal(lookup.status, 200);
  assert.equal(lookup.body.ok, true);
  assert.equal(lookup.body.status, 'ready');
  assert.equal(lookup.body.mode, 'patch');
  assert.equal(lookup.body.progress, 100);
  assert.equal(lookup.body.version, '1.2.9');
  assert.equal(lookup.body.restartRequired, false);
  assert.equal(fs.readFileSync(PATCH_TEST_FILE, 'utf8'), content);
});

test('/api/update/patch does not start a patch job for the preview fallback', async () => {
  const { status, body } = await getJson('/api/update/patch');

  assert.equal(status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'NO_UPDATE_AVAILABLE');
});
