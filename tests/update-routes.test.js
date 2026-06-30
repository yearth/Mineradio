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

const server = require('../server');

test.afterEach(() => {
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

test('/api/update/patch does not start a patch job for the preview fallback', async () => {
  const { status, body } = await getJson('/api/update/patch');

  assert.equal(status, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'NO_UPDATE_AVAILABLE');
});
