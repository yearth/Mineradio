const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  moveInvalidUpdateFile,
  reuseVerifiedInstallerJob,
  sha256Hex,
  sha512Base64,
  sha512Hex,
  verifyUpdateBuffer,
} = require('../server-dist/server/services/update-file-cache');

function memoryFs(files = {}) {
  const state = {
    files: new Map(Object.entries(files)),
    renamed: [],
    warnings: [],
  };
  return {
    state,
    existsSync(filePath) {
      return state.files.has(filePath);
    },
    readFileSync(filePath) {
      if (!state.files.has(filePath)) throw new Error('ENOENT');
      return state.files.get(filePath);
    },
    renameSync(from, to) {
      if (!state.files.has(from)) throw new Error('ENOENT');
      state.files.set(to, state.files.get(from));
      state.files.delete(from);
      state.renamed.push([from, to]);
    },
    statSync(filePath) {
      return { size: state.files.get(filePath).length };
    },
  };
}

const pathApi = {
  dirname(filePath) {
    return filePath.split('/').slice(0, -1).join('/') || '/';
  },
  extname(filePath) {
    const name = filePath.split('/').pop();
    const index = name.lastIndexOf('.');
    return index > 0 ? name.slice(index) : '';
  },
  basename(filePath, ext = '') {
    const name = filePath.split('/').pop();
    return ext && name.endsWith(ext) ? name.slice(0, -ext.length) : name;
  },
  join(...parts) {
    return parts.join('/').replace(/\/+/g, '/');
  },
};

test('hash helpers preserve legacy sha512 encodings and sha256 hex', () => {
  const buffer = Buffer.from('installer package');

  assert.equal(sha256Hex(buffer), crypto.createHash('sha256').update(buffer).digest('hex'));
  assert.equal(sha512Base64(buffer), crypto.createHash('sha512').update(buffer).digest('base64'));
  assert.equal(sha512Hex(buffer), crypto.createHash('sha512').update(buffer).digest('hex'));
});

test('verifyUpdateBuffer accepts expected size, sha256, sha512 base64, and sha512 hex', () => {
  const buffer = Buffer.from('installer package');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const sha512B64 = crypto.createHash('sha512').update(buffer).digest('base64');
  const sha512HexDigest = crypto.createHash('sha512').update(buffer).digest('hex');

  assert.doesNotThrow(() => verifyUpdateBuffer(buffer, {
    expectedSize: buffer.length,
    sha256: 'sha256:' + sha256,
    sha512: 'sha512:' + sha512B64,
  }));
  assert.doesNotThrow(() => verifyUpdateBuffer(buffer, {
    total: buffer.length,
    sha512: sha512HexDigest.toUpperCase(),
  }));
});

test('verifyUpdateBuffer preserves legacy mismatch errors', () => {
  const buffer = Buffer.from('installer package');

  assert.throws(
    () => verifyUpdateBuffer(buffer, { expectedSize: buffer.length + 1 }),
    err => err && err.code === 'UPDATE_SIZE_MISMATCH' && /Expected/.test(err.message)
  );
  assert.throws(
    () => verifyUpdateBuffer(buffer, { sha256: 'deadbeef' }),
    err => err && err.code === 'UPDATE_SHA256_MISMATCH'
  );
  assert.throws(
    () => verifyUpdateBuffer(buffer, { sha512: 'not-a-valid-digest' }),
    err => err && err.code === 'UPDATE_SHA512_MISMATCH'
  );
});

test('moveInvalidUpdateFile renames cached installers with timestamped invalid suffix', () => {
  const fsApi = memoryFs({ '/cache/Mineradio-1.2.0-Setup.exe': Buffer.from('bad') });
  const logger = {
    warn(...args) {
      fsApi.state.warnings.push(args);
    },
  };

  moveInvalidUpdateFile('/cache/Mineradio-1.2.0-Setup.exe', 'bad hash', {
    fs: fsApi,
    path: pathApi,
    now: () => 12345,
    logger,
  });

  assert.equal(fsApi.state.files.has('/cache/Mineradio-1.2.0-Setup.exe'), false);
  assert.equal(fsApi.state.files.has('/cache/Mineradio-1.2.0-Setup.invalid-12345.exe'), true);
  assert.equal(fsApi.state.warnings.length, 1);
});

test('moveInvalidUpdateFile ignores missing files and rename failures', () => {
  const fsApi = memoryFs({});
  const logger = {
    warnings: [],
    warn(...args) {
      this.warnings.push(args);
    },
  };

  assert.doesNotThrow(() => moveInvalidUpdateFile('/missing.bin', 'missing', {
    fs: fsApi,
    path: pathApi,
    logger,
  }));

  const failingFs = memoryFs({ '/cache/app': Buffer.from('bad') });
  failingFs.renameSync = () => {
    throw new Error('rename failed');
  };

  assert.doesNotThrow(() => moveInvalidUpdateFile('/cache/app', 'bad', {
    fs: failingFs,
    path: pathApi,
    logger,
    now: () => 9,
  }));
});

test('reuseVerifiedInstallerJob returns a cached ready job and registers it', () => {
  const buffer = Buffer.from('installer package');
  const fsApi = memoryFs({ '/cache/app.exe': buffer });
  const jobs = new Map();
  let trimmed = 0;

  const job = reuseVerifiedInstallerJob({
    filePath: '/cache/app.exe',
    expectedSize: buffer.length,
    sha256: sha256Hex(buffer),
    attempts: 3,
    version: '1.2.0',
    downloadUrl: 'https://example.com/app.exe',
    downloadCandidates: [{ url: 'https://example.com/app.exe' }],
    releaseUrl: 'https://example.com/releases/v1.2.0',
  }, {
    fs: fsApi,
    path: pathApi,
    jobs,
    trimJobs() {
      trimmed += 1;
    },
    now: () => 123456789,
    random: () => 0.123456789,
  });

  assert.equal(job.status, 'ready');
  assert.equal(job.id, 'cached-21i3v9-4fzzzx');
  assert.equal(job.progress, 100);
  assert.equal(job.received, buffer.length);
  assert.equal(job.total, buffer.length);
  assert.equal(job.sourceLabel, '本地缓存');
  assert.equal(job.message, '安装包已下载，可直接打开安装');
  assert.equal(job.fileName, 'app.exe');
  assert.equal(job.cached, true);
  assert.equal(jobs.get(job.id), job);
  assert.equal(trimmed, 1);
});

test('reuseVerifiedInstallerJob rejects unverifiable or invalid cache files', () => {
  const fsApi = memoryFs({ '/cache/app.exe': Buffer.from('bad') });
  const moved = [];

  assert.equal(reuseVerifiedInstallerJob(null, { fs: fsApi, path: pathApi }), null);
  assert.equal(reuseVerifiedInstallerJob({ filePath: '/missing.exe', expectedSize: 1 }, { fs: fsApi, path: pathApi }), null);
  assert.equal(reuseVerifiedInstallerJob({ filePath: '/cache/app.exe' }, { fs: fsApi, path: pathApi }), null);
  assert.equal(reuseVerifiedInstallerJob({
    filePath: '/cache/app.exe',
    expectedSize: 999,
  }, {
    fs: fsApi,
    path: pathApi,
    jobs: new Map(),
    trimJobs() {},
    moveInvalid(filePath, reason) {
      moved.push([filePath, reason]);
    },
  }), null);

  assert.equal(moved.length, 1);
  assert.equal(moved[0][0], '/cache/app.exe');
  assert.match(moved[0][1], /Expected 999 bytes/);
});
